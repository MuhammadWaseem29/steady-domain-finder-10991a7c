/** Server-only implementation of the public REST API (v1). */
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  corsHeaders,
  logApiRequest,
  type ApiCaller,
  type ApiResponseMeta,
} from "@/lib/api-auth.server";
import { API_ENDPOINTS } from "@/lib/api-spec";

type Ctx = {
  url: URL;
  segments: string[];
  method: string;
  request: Request;
  caller: ApiCaller;
  meta: ApiResponseMeta;
};

function num(url: URL, key: string, def: number, min: number, max: number): number {
  const raw = Number(url.searchParams.get(key));
  if (!Number.isFinite(raw)) return def;
  return Math.min(Math.max(Math.trunc(raw), min), max);
}

function sinceFrom(url: URL): string {
  const iso = url.searchParams.get("since");
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const hours = num(url, "hours", 24, 1, 24 * 365);
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function requireWrite(ctx: Ctx): Response | null {
  if (ctx.caller.scopes.includes("write")) return null;
  return apiError(
    403,
    "insufficient_scope",
    "This endpoint requires an API key with the `write` scope.",
    ctx.meta,
  );
}

export async function handleApiV1(request: Request, splat: string): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const segments = splat.split("/").filter(Boolean);
  const url = new URL(request.url);
  const baseMeta: ApiResponseMeta = { requestId };

  if (segments.length === 0) {
    return apiJson(
      {
        data: {
          version: "1",
          docs: `${url.origin}/docs/api`,
          openapi: `${url.origin}/api/v1/openapi.json`,
          auth: "Authorization: Bearer chs_live_…",
          endpoints: API_ENDPOINTS.map((e) => `${e.method} ${e.path}`),
        },
      },
      200,
      baseMeta,
    );
  }

  if (segments.length === 1 && segments[0] === "openapi.json") {
    const { buildOpenApiDocument } = await import("@/lib/openapi");
    return Response.json(buildOpenApiDocument(url.origin), {
      headers: { ...corsHeaders(), "Cache-Control": "public, max-age=300" },
    });
  }

  const auth = await authenticateApiRequest(request, requestId);
  if ("error" in auth) return auth.error;

  const meta: ApiResponseMeta = { requestId };
  const ctx: Ctx = { url, segments, method: request.method, request, caller: auth.caller, meta };

  let response: Response;
  try {
    const [head] = ctx.segments;
    if (head === "domains") response = await domainsRoute(ctx);
    else if (head === "subdomains") response = await subdomainsRoute(ctx);
    else if (head === "platforms") response = await platformsRoute(ctx);
    else if (head === "scans") response = await scansRoute(ctx);
    else if (head === "stats") response = await statsRoute(ctx);
    else if (head === "export") response = await exportRoute(ctx);
    else if (head === "me") response = await meRoute(ctx);
    else response = apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`, meta);
  } catch (e) {
    console.error("[api/v1]", e);
    response = apiError(
      500,
      "server_error",
      e instanceof Error ? e.message : "Unexpected error",
      meta,
    );
  }

  void logApiRequest({
    caller: auth.caller,
    method: request.method,
    path: `/${segments.join("/")}`,
    status: response.status,
    durationMs: Date.now() - startedAt,
    requestId,
  });

  return response;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function meRoute(ctx: Ctx): Promise<Response> {
  const db = await admin();
  const [{ data: profile }, { data: usage }] = await Promise.all([
    db.from("profiles").select("id, email, display_name").eq("id", ctx.caller.userId).maybeSingle(),
    db.rpc("api_usage_summary", { _user_id: ctx.caller.userId }),
  ]);
  const mine = (usage ?? []).find((u) => u.key_id === ctx.caller.keyId) ?? null;
  return apiJson(
    {
      data: {
        user_id: ctx.caller.userId,
        profile: profile ?? null,
        key: { id: ctx.caller.keyId, name: ctx.caller.name, scopes: ctx.caller.scopes },
        usage: mine
          ? {
              requests_1h: mine.requests_1h,
              requests_24h: mine.requests_24h,
              requests_7d: mine.requests_7d,
              error_rate_24h: mine.error_rate_24h,
              last_request_at: mine.last_request_at,
            }
          : null,
      },
    },
    200,
    ctx.meta,
  );
}

async function domainsRoute(ctx: Ctx): Promise<Response> {
  const db = await admin();
  const [, name, sub, subSub] = ctx.segments;

  if (!name) {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
    const limit = num(ctx.url, "limit", 100, 1, 1000);
    const offset = num(ctx.url, "offset", 0, 0, 5_000_000);
    const search = (ctx.url.searchParams.get("search") ?? "").trim();
    const platform = ctx.url.searchParams.get("platform");
    const enabled = ctx.url.searchParams.get("enabled");
    const sortRaw = ctx.url.searchParams.get("sort") ?? "domain";
    const sortable = [
      "domain",
      "total_subdomains",
      "new_subdomains_last_scan",
      "last_scanned_at",
    ] as const;
    const sort = (sortable as readonly string[]).includes(sortRaw) ? sortRaw : "domain";

    let query = db
      .from("domains")
      .select(
        "id, domain, enabled, total_subdomains, new_subdomains_last_scan, last_scanned_at, last_scan_status, platform_id",
        { count: "exact" },
      )
      .order(sort, { ascending: sort === "domain" })
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike("domain", `%${search}%`);
    if (enabled === "true" || enabled === "false") query = query.eq("enabled", enabled === "true");
    if (platform) {
      const { data: p } = await db.from("platforms").select("id").eq("slug", platform).maybeSingle();
      if (!p)
        return apiError(404, "unknown_platform", `No platform with slug "${platform}".`, ctx.meta);
      query = query.eq("platform_id", p.id);
    }

    const { data, error, count } = await query;
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data, meta: { limit, offset, sort, total: count ?? null } }, 200, ctx.meta);
  }

  const { data: domain } = await db
    .from("domains")
    .select(
      "id, domain, enabled, total_subdomains, new_subdomains_last_scan, last_scanned_at, last_scan_status, platform_id, created_at",
    )
    .eq("domain", name.toLowerCase())
    .maybeSingle();
  if (!domain) return apiError(404, "not_found", `No tracked domain "${name}".`, ctx.meta);

  if (!sub) {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
    const { data: stats } = await db.rpc("domain_subdomain_stats", { _domain_id: domain.id });
    const row = Array.isArray(stats) ? stats[0] : stats;
    return apiJson({ data: { ...domain, stats: row ?? null } }, 200, ctx.meta);
  }

  if (sub === "subdomains" && subSub === "new") {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
    const since = sinceFrom(ctx.url);
    const limit = num(ctx.url, "limit", 500, 1, 2000);
    const { data, error } = await db.rpc("domain_new_subs", {
      _domain_id: domain.id,
      since,
      lim: limit,
    });
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson(
      {
        data: data ?? [],
        meta: { domain: domain.domain, since, limit, count: (data ?? []).length },
      },
      200,
      ctx.meta,
    );
  }

  if (sub === "subdomains") {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
    const limit = num(ctx.url, "limit", 100, 1, 1000);
    const offset = num(ctx.url, "offset", 0, 0, 5_000_000);
    const rawFilter = ctx.url.searchParams.get("filter");
    const filter = rawFilter === "new" || rawFilter === "inactive" ? rawFilter : "all";
    const search = (ctx.url.searchParams.get("search") ?? "").trim() || undefined;

    const [{ data: rows, error }, { data: total }] = await Promise.all([
      db.rpc("domain_subdomains_page", {
        _domain_id: domain.id,
        ...(search ? { _search: search } : {}),
        _filter: filter,
        _limit: limit,
        _offset: offset,
      }),
      db.rpc("domain_subdomains_count", {
        _domain_id: domain.id,
        ...(search ? { _search: search } : {}),
        _filter: filter,
      }),
    ]);
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson(
      {
        data: rows ?? [],
        meta: { domain: domain.domain, limit, offset, filter, total: total ?? null },
      },
      200,
      ctx.meta,
    );
  }

  return apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`, ctx.meta);
}

async function subdomainsRoute(ctx: Ctx): Promise<Response> {
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
  const db = await admin();
  const sub = ctx.segments[1];

  if (sub === "search") {
    const q = (ctx.url.searchParams.get("q") ?? "").trim();
    if (q.length < 2)
      return apiError(400, "invalid_query", "Provide `q` with at least 2 characters.", ctx.meta);
    const limit = num(ctx.url, "limit", 100, 1, 1000);
    const offset = num(ctx.url, "offset", 0, 0, 1_000_000);
    const { data, error } = await db.rpc("search_subdomains", { q, lim: limit, off: offset });
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: data ?? [], meta: { q, limit, offset } }, 200, ctx.meta);
  }

  if (sub !== "new") {
    return apiError(404, "not_found", "Use /subdomains/new or /subdomains/search.", ctx.meta);
  }

  const since = sinceFrom(ctx.url);
  const limit = num(ctx.url, "limit", 500, 1, 2000);
  const beforeTs = ctx.url.searchParams.get("before_ts");
  const beforeId = ctx.url.searchParams.get("before_id");

  const { data, error } = await db.rpc("new_subs_page", {
    since,
    ...(beforeTs ? { before_ts: beforeTs } : {}),
    ...(beforeId ? { before_id: beforeId } : {}),
    lim: limit,
  });
  if (error) return apiError(500, "query_failed", error.message, ctx.meta);

  const rows = data ?? [];
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  return apiJson(
    {
      data: rows,
      meta: {
        since,
        limit,
        next_cursor: last ? { before_ts: last.first_seen_at, before_id: last.id } : null,
      },
    },
    200,
    ctx.meta,
  );
}

async function platformsRoute(ctx: Ctx): Promise<Response> {
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
  const db = await admin();
  const [, slug, sub, subSub] = ctx.segments;

  if (!slug) {
    const { data, error } = await db.rpc("platform_stats");
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: data ?? [] }, 200, ctx.meta);
  }

  const { data: platform } = await db
    .from("platforms")
    .select("id, slug, name, color, website")
    .eq("slug", slug)
    .maybeSingle();
  if (!platform) return apiError(404, "not_found", `No platform "${slug}".`, ctx.meta);

  if (!sub) return apiJson({ data: platform }, 200, ctx.meta);

  if (sub === "domains") {
    const limit = num(ctx.url, "limit", 200, 1, 1000);
    const offset = num(ctx.url, "offset", 0, 0, 1_000_000);
    const { data, error, count } = await db
      .from("domains")
      .select("id, domain, total_subdomains, new_subdomains_last_scan, last_scanned_at", {
        count: "exact",
      })
      .eq("platform_id", platform.id)
      .order("domain", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: data ?? [], meta: { limit, offset, total: count ?? null } }, 200, ctx.meta);
  }

  if (sub === "subdomains" && !subSub) {
    const limit = num(ctx.url, "limit", 1000, 1, 10000);
    const activeOnly = ctx.url.searchParams.get("active") !== "false";
    const format = (ctx.url.searchParams.get("format") ?? "json").toLowerCase();
    const cursor = ctx.url.searchParams.get("cursor");
    let afterDomain: string | null = null;
    let afterHost: string | null = null;
    if (cursor) {
      try {
        const [d, h] = atob(cursor.replace(/-/g, "+").replace(/_/g, "/")).split("|");
        afterDomain = d ?? null;
        afterHost = h ?? "";
      } catch {
        return apiError(400, "invalid_cursor", "The cursor value is malformed.", ctx.meta);
      }
    }
    const { data, error } = await db.rpc("platform_subdomains_page", {
      _platform_id: platform.id,
      _lim: limit,
      _active_only: activeOnly,
      ...(afterDomain ? { _after_domain: afterDomain, _after_host: afterHost ?? "" } : {}),
    });
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    const rows = (data ?? []) as Array<{
      domain_id: string;
      domain: string;
      host: string;
      is_active: boolean;
      first_seen_at: string;
      last_seen_at: string;
    }>;
    const last = rows.length === limit ? rows[rows.length - 1] : null;
    const nextCursor = last
      ? btoa(`${last.domain_id}|${last.host}`).replace(/\+/g, "-").replace(/\//g, "_")
      : null;

    if (format === "txt") {
      const headers = new Headers({
        ...corsHeaders(),
        "Content-Type": "text/plain; charset=utf-8",
        "X-Request-Id": ctx.meta.requestId,
      });
      if (nextCursor) headers.set("X-Next-Cursor", nextCursor);
      return new Response(rows.map((r) => r.host).join("\n"), { headers });
    }

    return apiJson(
      {
        data: rows.map((r) => ({
          host: r.host,
          domain: r.domain,
          is_active: r.is_active,
          first_seen_at: r.first_seen_at,
          last_seen_at: r.last_seen_at,
        })),
        meta: {
          platform: platform.slug,
          limit,
          count: rows.length,
          active_only: activeOnly,
          next_cursor: nextCursor,
          has_more: Boolean(nextCursor),
        },
      },
      200,
      ctx.meta,
    );
  }

  if (sub === "subdomains" && subSub === "new") {
    const since = sinceFrom(ctx.url);
    const limit = num(ctx.url, "limit", 500, 1, 2000);
    const { data, error } = await db.rpc("platform_recent_subdomains", {
      _platform_id: platform.id,
      since,
      lim: limit,
    });
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson(
      { data: data ?? [], meta: { platform: platform.slug, since, limit } },
      200,
      ctx.meta,
    );
  }

  return apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`, ctx.meta);
}

async function scansRoute(ctx: Ctx): Promise<Response> {
  const db = await admin();
  const sub = ctx.segments[1];

  if (ctx.method === "GET") {
    if (sub === "status") {
      const [{ data: health }, { data: cycle }] = await Promise.all([
        db.rpc("scan_cycle_health"),
        db.rpc("domain_cycle_counts", { cycle_minutes: 120 }),
      ]);
      return apiJson(
        {
          data: {
            health: Array.isArray(health) ? (health[0] ?? null) : health,
            cycle: Array.isArray(cycle) ? (cycle[0] ?? null) : cycle,
          },
        },
        200,
        ctx.meta,
      );
    }

    if (sub) {
      if (!/^[0-9a-f-]{36}$/i.test(sub))
        return apiError(400, "invalid_id", "Scan id must be a UUID.", ctx.meta);
      const { data, error } = await db
        .from("scans")
        .select(
          "id, domain_id, trigger, status, started_at, finished_at, total_returned, new_count, removed_count, error_message, domains(domain)",
        )
        .eq("id", sub)
        .maybeSingle();
      if (error) return apiError(500, "query_failed", error.message, ctx.meta);
      if (!data) return apiError(404, "not_found", `No scan "${sub}".`, ctx.meta);
      const { domains, ...scan } = data as typeof data & { domains?: { domain: string } | null };
      return apiJson({ data: { ...scan, domain: domains?.domain ?? null } }, 200, ctx.meta);
    }

    const limit = num(ctx.url, "limit", 50, 1, 500);
    const offset = num(ctx.url, "offset", 0, 0, 1_000_000);
    const domain = ctx.url.searchParams.get("domain");
    const platform = ctx.url.searchParams.get("platform");
    const status = ctx.url.searchParams.get("status");

    let query = db
      .from("scans")
      .select(
        "id, domain_id, trigger, status, started_at, finished_at, total_returned, new_count, removed_count, error_message",
        { count: "exact" },
      )
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["running", "success", "error"].includes(status)) query = query.eq("status", status);

    if (domain) {
      const { data: d } = await db
        .from("domains")
        .select("id")
        .eq("domain", domain.toLowerCase())
        .maybeSingle();
      if (!d) return apiError(404, "not_found", `No tracked domain "${domain}".`, ctx.meta);
      query = query.eq("domain_id", d.id);
    } else if (platform) {
      const { data: p } = await db.from("platforms").select("id").eq("slug", platform).maybeSingle();
      if (!p) return apiError(404, "unknown_platform", `No platform "${platform}".`, ctx.meta);
      const { data: ids } = await db
        .from("domains")
        .select("id")
        .eq("platform_id", p.id)
        .limit(1000);
      query = query.in("domain_id", (ids ?? []).map((d) => d.id));
    }

    const { data, error, count } = await query;
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: data ?? [], meta: { limit, offset, total: count ?? null } }, 200, ctx.meta);
  }

  if (ctx.method !== "POST")
    return apiError(405, "method_not_allowed", "Use GET or POST.", ctx.meta);

  const denied = requireWrite(ctx);
  if (denied) return denied;

  if (sub === "rescan-all") {
    const { data, error } = await db.rpc("mark_all_domains_due");
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: { queued_domains: data ?? 0 } }, 202, ctx.meta);
  }

  if (sub)
    return apiError(404, "not_found", "Use POST /scans or POST /scans/rescan-all.", ctx.meta);

  let body: { domain?: unknown } = {};
  try {
    body = (await ctx.request.json()) as { domain?: unknown };
  } catch {
    return apiError(400, "invalid_body", 'Send JSON: { "domain": "example.com" }', ctx.meta);
  }
  const target = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(target)) {
    return apiError(400, "invalid_domain", "Provide a valid root domain.", ctx.meta);
  }

  const { data: domainRow } = await db
    .from("domains")
    .select("id, domain")
    .eq("domain", target)
    .maybeSingle();
  if (!domainRow) return apiError(404, "not_found", `No tracked domain "${target}".`, ctx.meta);

  const { queueManualScan } = await import("@/lib/chaos.server");
  const result = await queueManualScan(domainRow.id);
  return apiJson({ data: { domain: domainRow.domain, ...result } }, 202, ctx.meta);
}

async function statsRoute(ctx: Ctx): Promise<Response> {
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
  const db = await admin();
  const sub = ctx.segments[1];

  if (!sub) {
    const [{ data: counts }, { data: platforms }, { data: total }] = await Promise.all([
      db.rpc("new_subdomain_counts"),
      db.rpc("platform_stats"),
      db.from("subdomains").select("*", { count: "exact", head: true }),
    ]);
    void total;
    const row = Array.isArray(counts) ? (counts[0] ?? null) : counts;
    return apiJson({ data: { new: row, platforms: platforms ?? [] } }, 200, ctx.meta);
  }

  if (sub === "timeseries") {
    const bucketRaw = ctx.url.searchParams.get("bucket") ?? "hour";
    const bucket = ["hour", "day", "week", "month"].includes(bucketRaw) ? bucketRaw : "hour";
    const since = sinceFrom(ctx.url);
    const { data, error } = await db.rpc("discovery_timeseries", { bucket, since });
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: data ?? [], meta: { bucket, since } }, 200, ctx.meta);
  }

  if (sub === "top-domains") {
    const since = sinceFrom(ctx.url);
    const limit = num(ctx.url, "limit", 20, 1, 200);
    const { data, error } = await db.rpc("top_domains_by_new", { since, lim: limit });
    if (error) return apiError(500, "query_failed", error.message, ctx.meta);
    return apiJson({ data: data ?? [], meta: { since, limit } }, 200, ctx.meta);
  }

  return apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`, ctx.meta);
}

async function exportRoute(ctx: Ctx): Promise<Response> {
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.", ctx.meta);
  const forward = new URL(`${ctx.url.origin}/api/public/export`);
  for (const key of ["platform", "domain", "scope", "hours", "search", "format"]) {
    const value = ctx.url.searchParams.get(key);
    if (value) forward.searchParams.set(key, value);
  }
  const upstream = await fetch(forward.toString());
  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  headers.set("X-Request-Id", ctx.meta.requestId);
  return new Response(upstream.body, { status: upstream.status, headers });
}

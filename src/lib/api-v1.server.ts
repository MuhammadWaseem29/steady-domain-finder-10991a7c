/** Server-only implementation of the public REST API (v1). */
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  corsHeaders,
  requireApiAdmin,
  requireScope,
  type ApiCaller,
} from "@/lib/api-auth.server";


type Ctx = {
  url: URL;
  segments: string[];
  method: string;
  request: Request;
  caller: ApiCaller;
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

export async function handleApiV1(request: Request, splat: string): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const segments = splat.split("/").filter(Boolean);
  const url = new URL(request.url);

  if (segments.length === 0) {
    return apiJson({
      data: {
        version: "1",
        docs: `${url.origin}/docs/api`,
        auth: "Authorization: Bearer chs_live_…",
        endpoints: [
          "GET /domains",
          "GET /domains/{domain}",
          "GET /domains/{domain}/subdomains",
          "GET /subdomains/new",
          "GET /platforms",
          "GET /platforms/{slug}/domains",
          "GET /scans",
          "GET /export",
          "POST /scans",
          "POST /scans/rescan-all",
        ],
      },
    });
  }

  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const ctx: Ctx = { url, segments, method: request.method, request, caller: auth.caller };

  try {
    const [head] = ctx.segments;
    if (head === "domains") return await domainsRoute(ctx);
    if (head === "subdomains") return await subdomainsRoute(ctx);
    if (head === "platforms") return await platformsRoute(ctx);
    if (head === "scans") return await scansRoute(ctx);
    if (head === "export") return await exportRoute(ctx);
    if (head === "me") return await meRoute(ctx);
    return apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`);
  } catch (e) {
    console.error("[api/v1]", e);
    return apiError(500, "server_error", e instanceof Error ? e.message : "Unexpected error");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function meRoute(ctx: Ctx): Promise<Response> {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", ctx.caller.userId)
    .maybeSingle();
  return apiJson({ data: { user_id: ctx.caller.userId, profile: data ?? null } });
}

async function domainsRoute(ctx: Ctx): Promise<Response> {
  const db = await admin();
  const [, name, sub] = ctx.segments;

  if (!name) {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
    const limit = num(ctx.url, "limit", 100, 1, 1000);
    const offset = num(ctx.url, "offset", 0, 0, 5_000_000);
    const search = (ctx.url.searchParams.get("search") ?? "").trim();
    const platform = ctx.url.searchParams.get("platform");

    let query = db
      .from("domains")
      .select(
        "id, domain, enabled, total_subdomains, new_subdomains_last_scan, last_scanned_at, last_scan_status, platform_id",
        { count: "exact" },
      )
      .order("domain", { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike("domain", `%${search}%`);
    if (platform) {
      const { data: p } = await db.from("platforms").select("id").eq("slug", platform).maybeSingle();
      if (!p) return apiError(404, "unknown_platform", `No platform with slug "${platform}".`);
      query = query.eq("platform_id", p.id);
    }

    const { data, error, count } = await query;
    if (error) return apiError(500, "query_failed", error.message);
    return apiJson({ data, meta: { limit, offset, total: count ?? null } });
  }

  const { data: domain } = await db
    .from("domains")
    .select(
      "id, domain, enabled, total_subdomains, new_subdomains_last_scan, last_scanned_at, last_scan_status, platform_id, created_at",
    )
    .eq("domain", name.toLowerCase())
    .maybeSingle();
  if (!domain) return apiError(404, "not_found", `No tracked domain "${name}".`);

  if (!sub) {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
    const { data: stats } = await db.rpc("domain_subdomain_stats", { _domain_id: domain.id });
    const row = Array.isArray(stats) ? stats[0] : stats;
    return apiJson({ data: { ...domain, stats: row ?? null } });
  }

  if (sub === "subdomains") {
    if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
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
    if (error) return apiError(500, "query_failed", error.message);
    return apiJson({
      data: rows ?? [],
      meta: { domain: domain.domain, limit, offset, filter, total: total ?? null },
    });
  }

  return apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`);
}

async function subdomainsRoute(ctx: Ctx): Promise<Response> {
  if (ctx.segments[1] !== "new") {
    return apiError(404, "not_found", "Use /subdomains/new.");
  }
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");

  const db = await admin();
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
  if (error) return apiError(500, "query_failed", error.message);

  const rows = data ?? [];
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  return apiJson({
    data: rows,
    meta: {
      since,
      limit,
      next_cursor: last ? { before_ts: last.first_seen_at, before_id: last.id } : null,
    },
  });
}

async function platformsRoute(ctx: Ctx): Promise<Response> {
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const db = await admin();
  const [, slug, sub] = ctx.segments;

  if (!slug) {
    const { data, error } = await db.rpc("platform_stats");
    if (error) return apiError(500, "query_failed", error.message);
    return apiJson({ data: data ?? [] });
  }

  const { data: platform } = await db
    .from("platforms")
    .select("id, slug, name, color, website")
    .eq("slug", slug)
    .maybeSingle();
  if (!platform) return apiError(404, "not_found", `No platform "${slug}".`);

  if (!sub) return apiJson({ data: platform });

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
    if (error) return apiError(500, "query_failed", error.message);
    return apiJson({ data: data ?? [], meta: { limit, offset, total: count ?? null } });
  }

  return apiError(404, "not_found", `Unknown endpoint /${ctx.segments.join("/")}`);
}

async function scansRoute(ctx: Ctx): Promise<Response> {
  const db = await admin();
  const sub = ctx.segments[1];

  if (ctx.method === "GET") {
    if (sub) return apiError(404, "not_found", "Use GET /scans.");
    const limit = num(ctx.url, "limit", 50, 1, 500);
    const offset = num(ctx.url, "offset", 0, 0, 1_000_000);
    const domain = ctx.url.searchParams.get("domain");

    let query = db
      .from("scans")
      .select(
        "id, domain_id, trigger, status, started_at, finished_at, total_returned, new_count, removed_count, error_message",
        { count: "exact" },
      )
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (domain) {
      const { data: d } = await db
        .from("domains")
        .select("id")
        .eq("domain", domain.toLowerCase())
        .maybeSingle();
      if (!d) return apiError(404, "not_found", `No tracked domain "${domain}".`);
      query = query.eq("domain_id", d.id);
    }

    const { data, error, count } = await query;
    if (error) return apiError(500, "query_failed", error.message);
    return apiJson({ data: data ?? [], meta: { limit, offset, total: count ?? null } });
  }

  if (ctx.method !== "POST") return apiError(405, "method_not_allowed", "Use GET or POST.");

  const scopeError = requireScope(ctx.caller, "write");
  if (scopeError) return scopeError;

  if (sub === "rescan-all") {
    const adminError = await requireApiAdmin(ctx.caller);
    if (adminError) return adminError;
    const { data, error } = await db.rpc("mark_all_domains_due");
    if (error) return apiError(500, "query_failed", error.message);
    return apiJson({ data: { queued_domains: data ?? 0 } }, 202);
  }

  if (sub) return apiError(404, "not_found", "Use POST /scans or POST /scans/rescan-all.");


  let body: { domain?: unknown } = {};
  try {
    body = (await ctx.request.json()) as { domain?: unknown };
  } catch {
    return apiError(400, "invalid_body", 'Send JSON: { "domain": "example.com" }');
  }
  const target = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(target)) {
    return apiError(400, "invalid_domain", "Provide a valid root domain.");
  }

  const { data: domainRow } = await db
    .from("domains")
    .select("id, domain")
    .eq("domain", target)
    .maybeSingle();
  if (!domainRow) return apiError(404, "not_found", `No tracked domain "${target}".`);

  const { queueManualScan } = await import("@/lib/chaos.server");
  const result = await queueManualScan(domainRow.id);
  return apiJson({ data: { domain: domainRow.domain, ...result } }, 202);
}

async function exportRoute(ctx: Ctx): Promise<Response> {
  if (ctx.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const forward = new URL(`${ctx.url.origin}/api/public/export`);
  for (const key of ["platform", "domain", "scope", "hours", "search", "format"]) {
    const value = ctx.url.searchParams.get(key);
    if (value) forward.searchParams.set(key, value);
  }
  const upstream = await fetch(forward.toString());
  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(upstream.body, { status: upstream.status, headers });
}

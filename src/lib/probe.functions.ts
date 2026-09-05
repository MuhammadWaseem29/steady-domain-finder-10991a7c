import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const createJobSchema = z.object({
  domain: z.string().trim().toLowerCase().min(1).max(255).optional(),
  platformSlug: z.string().trim().toLowerCase().max(60).optional(),
  program: z.string().trim().toLowerCase().max(255).optional(),
  scope: z.enum(["all", "new", "active"]).default("all"),
  search: z.string().trim().max(200).optional(),
  everything: z.boolean().optional(),
});

export const createProbeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createJobSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.domain && !data.platformSlug && !data.everything) {
      throw new Error("domain or platformSlug required");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let domainId: string | null = null;
    if (data.domain) {
      const { data: d } = await supabaseAdmin
        .from("domains")
        .select("id")
        .eq("domain", data.domain)
        .maybeSingle();
      if (!d) throw new Error("Unknown domain");
      domainId = d.id;
    }

    const { data: job, error } = await supabaseAdmin
      .from("probe_jobs")
      .insert({
        domain_id: domainId,
        platform_slug: domainId ? null : (data.platformSlug ?? null),
        program: data.program ?? null,
        scope: data.scope,
        search: data.search || null,
        requested_by: context.userId,
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);

    // Counting every host across every platform would take longer than the
    // probe itself, so a whole-database job reports progress without a total.
    if (data.everything && !data.domain && !data.platformSlug) {
      const { processProbeJobs: kick } = await import("@/lib/probe.server");
      void kick(20000).catch(() => undefined);
      return { id: job.id, total: 0 };
    }

    // Count targets so the UI can show a denominator.
    const { probeJobTargets } = await import("@/lib/probe.server");
    const total = await probeJobTargets({
      domain_id: domainId,
      platform_slug: data.platformSlug ?? null,
      program: data.program ?? null,
      scope: data.scope,
      search: data.search || null,
    }).catch(() => 0);
    await supabaseAdmin.from("probe_jobs").update({ total_hosts: total }).eq("id", job.id);

    // Kick the first pass immediately so results start within seconds.
    const { processProbeJobs } = await import("@/lib/probe.server");
    void processProbeJobs(20000).catch(() => undefined);

    return { id: job.id, total };
  });

export const probeJobStatus = createServerFn({ method: "GET" })
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: job } = await sb
      .from("probe_jobs")
      .select(
        "id, status, total_hosts, probed_hosts, live_hosts, scope, domain_id, platform_slug, program, created_at, started_at, finished_at, error_message",
      )
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) return null;
    let domain: string | null = null;
    if (job.domain_id) {
      const { data: d } = await sb.from("domains").select("domain").eq("id", job.domain_id).maybeSingle();
      domain = d?.domain ?? null;
    }
    return { ...job, domain };
  });

const livePageSchema = z.object({
  domain: z.string().trim().toLowerCase().optional(),
  platformSlug: z.string().trim().toLowerCase().optional(),
  program: z.string().trim().toLowerCase().optional(),
  search: z.string().trim().max(200).optional(),
  preset: z.enum(["all", "ok", "redirect", "auth", "interesting", "takeover"]).default("all"),
  status: z.number().int().min(100).max(599).optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

export const liveHostsPage = createServerFn({ method: "GET" })
  .inputValidator((input) => livePageSchema.parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();

    let domainIds: string[] | null = null;
    if (data.domain) {
      const { data: d } = await sb.from("domains").select("id").eq("domain", data.domain).maybeSingle();
      domainIds = d ? [d.id] : [];
    } else if (data.platformSlug) {
      const { data: p } = await sb.from("platforms").select("id").eq("slug", data.platformSlug).maybeSingle();
      if (!p) return { rows: [], total: 0 };
      let dq = sb.from("domains").select("id").eq("platform_id", p.id);
      if (data.program) dq = dq.ilike("domain", `%${data.program}%`);
      const ids: string[] = [];
      for (let page = 0; page < 100; page++) {
        const { data: ds } = await dq.range(page * 1000, page * 1000 + 999);
        ids.push(...(ds ?? []).map((x) => x.id));
        if (!ds || ds.length < 1000) break;
      }
      domainIds = ids;
    }

    let q = sb
      .from("probe_results")
      .select(
        "host, url, final_url, status_code, title, content_length, response_time_ms, webserver, technologies, cdn, ip, asn, cname, takeover_risk, takeover_service, takeover_evidence, probed_at",
        { count: "exact" },
      )
      .order("probed_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    // Dangling takeover candidates often don't answer at all, so that view
    // must not be restricted to hosts that responded.
    if (data.preset === "takeover") q = q.eq("takeover_risk", true);
    else q = q.eq("failed", false);

    if (domainIds) {
      if (!domainIds.length) return { rows: [], total: 0 };
      q = q.in("domain_id", domainIds);
    }
    if (data.search) q = q.or(`host.ilike.%${data.search}%,title.ilike.%${data.search}%`);
    if (data.status) q = q.eq("status_code", data.status);
    if (data.preset === "ok") q = q.eq("status_code", 200);
    if (data.preset === "redirect") q = q.gte("status_code", 300).lt("status_code", 400);
    if (data.preset === "auth") q = q.in("status_code", [401, 403]);
    if (data.preset === "interesting")
      q = q.in("status_code", [200, 301, 302, 401, 403, 500]).not("title", "is", null);

    const { data: rows, count } = await q;
    return { rows: rows ?? [], total: count ?? 0 };
  });

const recentLiveSchema = z.object({
  hours: z.number().int().min(1).max(24 * 365).default(24),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

export type RecentLiveRow = {
  host: string;
  url: string;
  status_code: number | null;
  title: string | null;
  cname: string | null;
  takeover_risk: boolean;
  takeover_service: string | null;
  probed_at: string;
  domain: string | null;
  platform_name: string | null;
  platform_slug: string | null;
  platform_color: string | null;
};

export const recentLivePage = createServerFn({ method: "GET" })
  .inputValidator((input) => recentLiveSchema.parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const since = new Date(Date.now() - data.hours * 3600_000).toISOString();
    let q = sb
      .from("probe_results")
      .select(
        "host, url, status_code, title, cname, takeover_risk, takeover_service, probed_at, domains(domain, platforms(name, slug, color))",
        { count: "exact" },
      )
      .eq("failed", false)
      .gte("probed_at", since)
      .order("probed_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.search) q = q.or(`host.ilike.%${data.search}%,title.ilike.%${data.search}%`);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const mapped: RecentLiveRow[] = (rows ?? []).map((r) => {
      const d = r.domains as unknown as {
        domain: string;
        platforms: { name: string; slug: string; color: string } | null;
      } | null;
      return {
        host: r.host,
        url: r.url,
        status_code: r.status_code,
        title: r.title,
        cname: r.cname,
        takeover_risk: r.takeover_risk,
        takeover_service: r.takeover_service,
        probed_at: r.probed_at,
        domain: d?.domain ?? null,
        platform_name: d?.platforms?.name ?? null,
        platform_slug: d?.platforms?.slug ?? null,
        platform_color: d?.platforms?.color ?? null,
      };
    });
    return { rows: mapped, total: count ?? 0 };
  });

export const recentLiveAnalytics = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        hours: z.number().int().min(1).max(24 * 365).default(24),
        bucket: z.enum(["hour", "day"]).default("hour"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const now = Date.now();
    const since = new Date(now - data.hours * 3600_000).toISOString();

    const countSince = async (iso: string | null) => {
      let q = sb
        .from("probe_results")
        .select("id", { count: "exact", head: true })
        .eq("failed", false);
      if (iso) q = q.gte("probed_at", iso);
      const { count } = await q;
      return count ?? 0;
    };

    const [total, hour, day, week, month, current, doubleWindow] = await Promise.all([
      countSince(null),
      countSince(new Date(now - 3600_000).toISOString()),
      countSince(new Date(now - 24 * 3600_000).toISOString()),
      countSince(new Date(now - 7 * 24 * 3600_000).toISOString()),
      countSince(new Date(now - 30 * 24 * 3600_000).toISOString()),
      countSince(since),
      countSince(new Date(now - data.hours * 2 * 3600_000).toISOString()),
    ]);

    // Sample up to 10k rows in the window for series / status / platform aggregates.
    const { data: sample } = await sb
      .from("probe_results")
      .select("probed_at, status_code, domains(domain, platforms(name, color))")
      .eq("failed", false)
      .gte("probed_at", since)
      .order("probed_at", { ascending: false })
      .limit(10000);

    const bucketMs = data.bucket === "hour" ? 3600_000 : 24 * 3600_000;
    const seriesMap = new Map<number, number>();
    const statusMap = new Map<string, number>();
    const platformMap = new Map<string, { value: number; color: string | null }>();
    const domainMap = new Map<string, number>();
    let latest: string | null = null;
    for (const r of sample ?? []) {
      if (!latest) latest = r.probed_at;
      const b = Math.floor(new Date(r.probed_at).getTime() / bucketMs) * bucketMs;
      seriesMap.set(b, (seriesMap.get(b) ?? 0) + 1);
      const code = r.status_code ?? 0;
      const group =
        code >= 200 && code < 300
          ? "2xx"
          : code >= 300 && code < 400
            ? "3xx"
            : code === 401 || code === 403
              ? "401/403"
              : code >= 400 && code < 500
                ? "4xx"
                : code >= 500
                  ? "5xx"
                  : "other";
      statusMap.set(group, (statusMap.get(group) ?? 0) + 1);
      const d = r.domains as unknown as {
        domain: string;
        platforms: { name: string; color: string } | null;
      } | null;
      if (d?.domain) {
        domainMap.set(d.domain, (domainMap.get(d.domain) ?? 0) + 1);
        const pname = d.platforms?.name ?? "Other";
        const cur = platformMap.get(pname) ?? { value: 0, color: d.platforms?.color ?? null };
        cur.value += 1;
        platformMap.set(pname, cur);
      }
    }

    const series = [...seriesMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ts, c]) => ({ ts: new Date(ts).toISOString(), count: c }));
    const status = [...statusMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    const platforms = [...platformMap.entries()]
      .map(([label, v]) => ({ label, value: v.value, ...(v.color ? { color: v.color } : {}) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const topDomains = [...domainMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      total,
      windows: { hour, day, week, month },
      perHour: data.hours > 0 ? Math.round((current / data.hours) * 10) / 10 : 0,
      latestAt: latest,
      current,
      previous: Math.max(doubleWindow - current, 0),
      series,
      status,
      platforms,
      topDomains,
    };
  });

export const recentProbeJobs = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: jobs } = await sb
      .from("probe_jobs")
      .select(
        "id, status, total_hosts, probed_hosts, live_hosts, scope, domain_id, platform_slug, program, created_at, finished_at",
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 20, 50));
    return jobs ?? [];
  });

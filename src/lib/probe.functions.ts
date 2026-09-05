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
    if (data.preset === "ok") q = q.eq("status_code", 200);
    if (data.preset === "redirect") q = q.gte("status_code", 300).lt("status_code", 400);
    if (data.preset === "auth") q = q.in("status_code", [401, 403]);
    if (data.preset === "interesting")
      q = q.in("status_code", [200, 301, 302, 401, 403, 500]).not("title", "is", null);

    const { data: rows, count } = await q;
    return { rows: rows ?? [], total: count ?? 0 };
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

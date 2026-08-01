import { createServerFn } from "@tanstack/react-start";

export type RecentSubsAnalytics = {
  overview: {
    totalNew: number;
    programsActive: number;
    domainsActive: number;
    latestAt: string | null;
    perHour: number;
  };
  series: { ts: string; new_subdomains: number }[];
  scans: { ts: string; scans: number; errors: number; new_found: number }[];
  top: { domain: string; new_count: number }[];
  labels: { prefix: string; c: number }[];
  heatmap: { dow: number; hour: number; c: number }[];
  platforms: {
    platform_id: string;
    slug: string;
    name: string;
    color: string | null;
    new_count: number;
    domains_affected: number;
    last_seen: string | null;
  }[];
  total: number;
  previous: number;
  windows: { hour: number; day: number; week: number; month: number };
};

/**
 * All heavy aggregates for /recentsubs in one server round-trip.
 * Runs with the service role so the big scans are not cut off by the
 * short anon statement timeout.
 */
export const getRecentSubsAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: { hours: number; bucket: string }) => ({
    hours: Math.max(1, Math.min(Number(data.hours) || 24, 24 * 365)),
    bucket: ["hour", "day", "week", "month"].includes(data.bucket) ? data.bucket : "day",
  }))
  .handler(async ({ data }): Promise<RecentSubsAnalytics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = Date.now();
    const since = new Date(now - data.hours * 3600_000).toISOString();
    const prevStart = new Date(now - data.hours * 2 * 3600_000).toISOString();
    const heatSince = new Date(now - Math.max(data.hours, 24 * 7) * 3600_000).toISOString();

    const call = async <T>(fn: string, args: Record<string, unknown>, fallback: T): Promise<T> => {
      const { data: rows, error } = await supabaseAdmin.rpc(fn as never, args as never);
      if (error) return fallback;
      return (rows ?? fallback) as T;
    };

    const [overviewRows, series, scans, top, labels, heatmap, platforms, total, windowRows] =
      await Promise.all([
        call<{ total_new: number; programs_active: number; domains_active: number; latest_at: string | null; per_hour: number }[]>(
          "recent_subs_overview",
          { since },
          [],
        ),
        call<{ ts: string; new_subdomains: number }[]>(
          "discovery_timeseries",
          { bucket: data.bucket, since },
          [],
        ),
        call<{ ts: string; scans: number; errors: number; new_found: number }[]>(
          "scan_timeseries",
          { bucket: data.bucket, since },
          [],
        ),
        call<{ domain: string; new_count: number }[]>(
          "top_domains_by_new",
          { since, lim: 12 },
          [],
        ),
        call<{ prefix: string; c: number }[]>(
          "new_subs_label_breakdown",
          { since, lim: 14 },
          [],
        ),
        call<{ dow: number; hour: number; c: number }[]>(
          "new_subs_hour_heatmap",
          { since: heatSince },
          [],
        ),
        call<RecentSubsAnalytics["platforms"]>("platform_updates", { since }, []),
        call<number>("count_new_subs", { since }, 0),
        call<{ last_hour: number; last_day: number; last_week: number; last_month: number }[]>(
          "new_subdomain_counts",
          {},
          [],
        ),
      ]);

    const { count: prevCount } = await supabaseAdmin
      .from("subdomains")
      .select("id", { count: "estimated", head: true })
      .gte("first_seen_at", prevStart)
      .lt("first_seen_at", since);

    const o = overviewRows[0];
    const w = windowRows[0];

    return {
      overview: {
        totalNew: Number(o?.total_new ?? 0),
        programsActive: Number(o?.programs_active ?? 0),
        domainsActive: Number(o?.domains_active ?? 0),
        latestAt: o?.latest_at ?? null,
        perHour: Number(o?.per_hour ?? 0),
      },
      series: (series ?? []).map((r) => ({ ts: r.ts, new_subdomains: Number(r.new_subdomains) })),
      scans: (scans ?? []).map((r) => ({
        ts: r.ts,
        scans: Number(r.scans),
        errors: Number(r.errors),
        new_found: Number(r.new_found),
      })),
      top: (top ?? []).map((r) => ({ domain: r.domain, new_count: Number(r.new_count) })),
      labels: (labels ?? []).map((r) => ({ prefix: r.prefix, c: Number(r.c) })),
      heatmap: (heatmap ?? []).map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        c: Number(r.c),
      })),
      platforms: (platforms ?? []).map((p) => ({
        platform_id: p.platform_id,
        slug: p.slug,
        name: p.name,
        color: p.color ?? null,
        new_count: Number(p.new_count),
        domains_affected: Number(p.domains_affected),
        last_seen: p.last_seen ?? null,
      })),
      total: Number(total ?? 0),
      previous: prevCount ?? 0,
      windows: {
        hour: Number(w?.last_hour ?? 0),
        day: Number(w?.last_day ?? 0),
        week: Number(w?.last_week ?? 0),
        month: Number(w?.last_month ?? 0),
      },
    };
  });

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DomainRow = {
  id: string;
  domain: string;
  enabled: boolean;
  last_scanned_at: string | null;
  last_scan_status: string | null;
  total_subdomains: number;
  new_subdomains_last_scan: number;
  created_at: string;
  platform_id?: string | null;

};

export type SubdomainRow = {
  id: string;
  host: string;
  label: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
};

export type ScanRow = {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_returned: number;
  new_count: number;
  removed_count: number;
  error_message: string | null;
};

export type RecentSubdomain = {
  id: string;
  host: string;
  first_seen_at: string;
  domains: { domain: string } | null;
};

export type PlatformStat = {
  platform_id: string;
  slug: string;
  name: string;
  color: string | null;
  domain_count: number;
  subdomain_count: number;
  new_24h: number;
};

const DOMAIN_COLS =
  "id, domain, enabled, last_scanned_at, last_scan_status, total_subdomains, new_subdomains_last_scan, created_at, platform_id";

export const PAGE_SIZE = 50;

export const domainsPageQuery = (search: string, page: number, platformId?: string) =>
  queryOptions({
    queryKey: ["domains", search, page, platformId ?? "all"],
    queryFn: async (): Promise<{ rows: DomainRow[]; total: number }> => {
      let q = supabase
        .from("domains")
        .select(DOMAIN_COLS, { count: "exact" })
        .order("total_subdomains", { ascending: false })
        .order("domain", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike("domain", `%${search.trim()}%`);
      if (platformId) q = q.eq("platform_id", platformId);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DomainRow[], total: count ?? 0 };
    },
    refetchInterval: 60_000,
  });

export const platformsQuery = queryOptions({
  queryKey: ["platform-stats"],
  queryFn: async (): Promise<PlatformStat[]> => {
    const { data, error } = await supabase.rpc("platform_stats");
    if (error) throw new Error(error.message);
    return (data ?? []) as PlatformStat[];
  },
  refetchInterval: 60_000,
});

export type Bucket = "hour" | "day" | "week" | "month";

export const RANGES = {
  "24h": { hours: 24, bucket: "hour" as Bucket, label: "Last 24 hours" },
  "7d": { hours: 24 * 7, bucket: "day" as Bucket, label: "Last 7 days" },
  "30d": { hours: 24 * 30, bucket: "day" as Bucket, label: "Last 30 days" },
  "6m": { hours: 24 * 182, bucket: "week" as Bucket, label: "Last 6 months" },
  "1y": { hours: 24 * 365, bucket: "month" as Bucket, label: "Last year" },
};

export type RangeKey = keyof typeof RANGES;

const sinceIso = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

export const discoveryTimeseriesQuery = (range: RangeKey) =>
  queryOptions({
    queryKey: ["discovery-ts", range],
    queryFn: async (): Promise<{ ts: string; new_subdomains: number }[]> => {
      const { hours, bucket } = RANGES[range];
      const { data, error } = await supabase.rpc("discovery_timeseries", {
        bucket,
        since: sinceIso(hours),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as { ts: string; new_subdomains: number }[];
    },
    refetchInterval: 60_000,
  });

export const scanTimeseriesQuery = (range: RangeKey) =>
  queryOptions({
    queryKey: ["scan-ts", range],
    queryFn: async (): Promise<
      { ts: string; scans: number; errors: number; new_found: number }[]
    > => {
      const { hours, bucket } = RANGES[range];
      const { data, error } = await supabase.rpc("scan_timeseries", {
        bucket,
        since: sinceIso(hours),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as { ts: string; scans: number; errors: number; new_found: number }[];
    },
    refetchInterval: 60_000,
  });

export const topDomainsQuery = (range: RangeKey, limit = 12) =>
  queryOptions({
    queryKey: ["top-domains", range, limit],
    queryFn: async (): Promise<{ domain: string; new_count: number }[]> => {
      const { data, error } = await supabase.rpc("top_domains_by_new", {
        since: sinceIso(RANGES[range].hours),
        lim: limit,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as { domain: string; new_count: number }[];
    },
    refetchInterval: 60_000,
  });

export const newSubdomainsQuery = (range: RangeKey, limit = 500) =>
  queryOptions({
    queryKey: ["new-subs", range, limit],
    queryFn: async (): Promise<RecentSubdomain[]> => {
      const { data, error } = await supabase
        .from("subdomains")
        .select("id, host, first_seen_at, domains(domain)")
        .gte("first_seen_at", sinceIso(RANGES[range].hours))
        .order("first_seen_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RecentSubdomain[];
    },
    refetchInterval: 30_000,
  });

export const windowCountsQuery = queryOptions({
  queryKey: ["window-counts"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("new_subdomain_counts");
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as
      | {
          last_hour: number;
          last_day: number;
          last_week: number;
          last_month: number;
          last_half_year: number;
        }
      | undefined;
    return {
      hour: Number(row?.last_hour ?? 0),
      day: Number(row?.last_day ?? 0),
      week: Number(row?.last_week ?? 0),
      month: Number(row?.last_month ?? 0),
      halfYear: Number(row?.last_half_year ?? 0),
    };
  },
  refetchInterval: 60_000,
});

export const recentSubsOverviewQuery = (hours: number) =>
  queryOptions({
    queryKey: ["recent-subs-overview", hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recent_subs_overview", {
        since: sinceIso(hours),
      });
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0] as
        | {
            total_new: number;
            programs_active: number;
            domains_active: number;
            latest_at: string | null;
            per_hour: number;
          }
        | undefined;
      return {
        totalNew: Number(row?.total_new ?? 0),
        programsActive: Number(row?.programs_active ?? 0),
        domainsActive: Number(row?.domains_active ?? 0),
        latestAt: row?.latest_at ?? null,
        perHour: Number(row?.per_hour ?? 0),
      };
    },
    refetchInterval: 15_000,
  });



export const globalStatsQuery = queryOptions({
  queryKey: ["global-stats"],
  queryFn: async () => {
    const [domainCount, subCount, scannedCount, recentNew] = await Promise.all([
      supabase.from("domains").select("id", { count: "exact", head: true }),
      supabase.from("subdomains").select("id", { count: "planned", head: true }),
      supabase
        .from("domains")
        .select("id", { count: "exact", head: true })
        .not("last_scanned_at", "is", null),
      supabase.rpc("new_subdomain_counts"),
    ]);
    return {
      domains: domainCount.count ?? 0,
      subdomains: subCount.count ?? 0,
      scanned: scannedCount.count ?? 0,
      newLast24h: Number((recentNew.data as { last_day: number }[] | null)?.[0]?.last_day ?? 0),

    };
  },
  refetchInterval: 30_000,
});

export const recentSubdomainsQuery = (limit = 100) =>
  queryOptions({
    queryKey: ["recent-subdomains", limit],
    queryFn: async (): Promise<RecentSubdomain[]> => {
      const { data, error } = await supabase
        .from("subdomains")
        .select("id, host, first_seen_at, domains(domain)")
        .order("first_seen_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RecentSubdomain[];
    },
    refetchInterval: 10_000,
  });

export const domainQuery = (domain: string) =>
  queryOptions({
    queryKey: ["domain", domain],
    queryFn: async (): Promise<DomainRow | null> => {
      const { data, error } = await supabase
        .from("domains")
        .select(
          "id, domain, enabled, last_scanned_at, last_scan_status, total_subdomains, new_subdomains_last_scan, created_at",
        )
        .eq("domain", domain)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    refetchInterval: 60_000,
  });

export type DomainSubStats = {
  total: number;
  new_24h: number;
  new_7d: number;
  active: number;
  inactive: number;
  latest_seen: string | null;
};

export const domainStatsQuery = (domainId: string | undefined) =>
  queryOptions({
    queryKey: ["domain-sub-stats", domainId],
    enabled: Boolean(domainId),
    queryFn: async (): Promise<DomainSubStats> => {
      const { data, error } = await supabase.rpc("domain_subdomain_stats", {
        _domain_id: domainId!,
      });
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0] as DomainSubStats | undefined;
      return {
        total: Number(row?.total ?? 0),
        new_24h: Number(row?.new_24h ?? 0),
        new_7d: Number(row?.new_7d ?? 0),
        active: Number(row?.active ?? 0),
        inactive: Number(row?.inactive ?? 0),
        latest_seen: row?.latest_seen ?? null,
      };
    },
    refetchInterval: 60_000,
  });

export const SUBS_PAGE_SIZE = 100;

export const domainSubdomainsPageQuery = (
  domainId: string | undefined,
  search: string,
  filter: string,
  page: number,
) =>
  queryOptions({
    queryKey: ["domain-subs-page", domainId, search, filter, page],
    enabled: Boolean(domainId),
    queryFn: async (): Promise<SubdomainRow[]> => {
      const term = search.trim();
      const { data, error } = await supabase.rpc("domain_subdomains_page", {
        _domain_id: domainId!,
        _filter: filter,
        _limit: SUBS_PAGE_SIZE,
        _offset: page * SUBS_PAGE_SIZE,
        ...(term ? { _search: term } : {}),
      });

      if (error) throw new Error(error.message);
      return (data ?? []) as SubdomainRow[];
    },
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

export const domainSubCountQuery = (
  domainId: string | undefined,
  search: string,
  filter: string,
) =>
  queryOptions({
    queryKey: ["domain-subs-count", domainId, search, filter],
    enabled: Boolean(domainId),
    queryFn: async (): Promise<number> => {
      const term = search.trim();
      const { data, error } = await supabase.rpc("domain_subdomains_count", {
        _domain_id: domainId!,
        _filter: filter,
        ...(term ? { _search: term } : {}),
      });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });



export const scansQuery = (domainId: string | undefined) =>
  queryOptions({
    queryKey: ["scans", domainId],
    enabled: Boolean(domainId),
    queryFn: async (): Promise<ScanRow[]> => {
      const { data, error } = await supabase
        .from("scans")
        .select(
          "id, trigger, status, started_at, finished_at, total_returned, new_count, removed_count, error_message",
        )
        .eq("domain_id", domainId!)
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

export const scanHealthQuery = queryOptions({
  queryKey: ["scan-health"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("scan_cycle_health");
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as
      | {
          total_domains: number;
          scanned_30m: number;
          never_scanned: number;
          oldest_scan: string | null;
          newest_scan: string | null;
          running_scans: number;
          errors_1h: number;
          new_subs_30m: number;
        }
      | undefined;
    return {
      totalDomains: Number(row?.total_domains ?? 0),
      scanned30m: Number(row?.scanned_30m ?? 0),
      neverScanned: Number(row?.never_scanned ?? 0),
      oldestScan: row?.oldest_scan ?? null,
      newestScan: row?.newest_scan ?? null,
      runningScans: Number(row?.running_scans ?? 0),
      errors1h: Number(row?.errors_1h ?? 0),
      newSubs30m: Number(row?.new_subs_30m ?? 0),
    };
  },
  refetchInterval: 10_000,
});

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${Math.max(secs, 0)}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h ago`;
}

/** Exact wall-clock timestamp, e.g. "31 Jul 2026, 18:12:44". */
export function exactTime(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Exact clock time only, e.g. "18:12:44". */
export function clockTime(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}


export function isNew(iso: string, withinHours = 24): boolean {
  return Date.now() - new Date(iso).getTime() < withinHours * 3600_000;
}

export function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatTick(iso: string, bucket: string) {
  const d = new Date(iso);
  if (bucket === "hour")
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (bucket === "month")
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------------- Live scan activity ---------------- */

export type RunningScan = {
  scan_id: string;
  domain: string;
  platform_name: string | null;
  platform_slug: string | null;
  platform_color: string | null;
  trigger: string;
  started_at: string;
  elapsed_seconds: number;
};

export const runningScansQuery = (limit = 60) =>
  queryOptions({
    queryKey: ["running-scans", limit],
    queryFn: async (): Promise<RunningScan[]> => {
      const { data, error } = await supabase.rpc("running_scans_detail", { lim: limit });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RunningScan[];
    },
    refetchInterval: 5_000,
  });

export const scanActivityQuery = queryOptions({
  queryKey: ["scan-activity"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("scan_activity_summary");
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as
      | {
          running: number;
          claimed_5m: number;
          finished_5m: number;
          new_subs_5m: number;
          new_subs_1h: number;
        }
      | undefined;
    return {
      running: Number(row?.running ?? 0),
      claimed5m: Number(row?.claimed_5m ?? 0),
      finished5m: Number(row?.finished_5m ?? 0),
      newSubs5m: Number(row?.new_subs_5m ?? 0),
      newSubs1h: Number(row?.new_subs_1h ?? 0),
    };
  },
  refetchInterval: 5_000,
});

/* ---------------- Program updates ---------------- */

export type PlatformUpdate = {
  platform_id: string;
  slug: string;
  name: string;
  color: string | null;
  new_count: number;
  domains_affected: number;
  last_seen: string | null;
};

export const UPDATE_RANGES = {
  "1h": { hours: 1, label: "Last hour" },
  "24h": { hours: 24, label: "Last 24 hours" },
  "7d": { hours: 24 * 7, label: "Last 7 days" },
  "30d": { hours: 24 * 30, label: "Last 30 days" },
};

export type UpdateRangeKey = keyof typeof UPDATE_RANGES;

export const platformUpdatesQuery = (range: UpdateRangeKey) =>
  queryOptions({
    queryKey: ["platform-updates", range],
    queryFn: async (): Promise<PlatformUpdate[]> => {
      const { data, error } = await supabase.rpc("platform_updates", {
        since: sinceIso(UPDATE_RANGES[range].hours),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PlatformUpdate[];
    },
    refetchInterval: 15_000,
  });

export type PlatformRecentSub = {
  host: string;
  domain: string;
  first_seen_at: string;
};

export const platformRecentSubsQuery = (
  platformId: string | undefined,
  range: UpdateRangeKey,
  limit = 200,
) =>
  queryOptions({
    queryKey: ["platform-recent-subs", platformId, range, limit],
    enabled: Boolean(platformId),
    queryFn: async (): Promise<PlatformRecentSub[]> => {
      const { data, error } = await supabase.rpc("platform_recent_subdomains", {
        _platform_id: platformId!,
        since: sinceIso(UPDATE_RANGES[range].hours),
        lim: limit,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PlatformRecentSub[];
    },
    refetchInterval: 15_000,
  });

export const recentNewSubsQuery = (range: UpdateRangeKey, limit = 300) =>
  queryOptions({
    queryKey: ["updates-new-subs", range, limit],
    queryFn: async (): Promise<RecentSubdomain[]> => {
      const { data, error } = await supabase
        .from("subdomains")
        .select("id, host, first_seen_at, domains(domain)")
        .gte("first_seen_at", sinceIso(UPDATE_RANGES[range].hours))
        .order("first_seen_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RecentSubdomain[];
    },
    refetchInterval: 15_000,
  });

// ---------------------------------------------------------------------------
// Recent-subs analytics (unlimited feed + extra breakdowns)
// ---------------------------------------------------------------------------

export type NewSubRow = {
  id: string;
  host: string;
  domain: string;
  first_seen_at: string;
};

export const NEW_SUBS_PAGE = 500;

export const newSubsCountQuery = (hours: number) =>
  queryOptions({
    queryKey: ["new-subs-count", hours],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("count_new_subs", { since: sinceIso(hours) });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    refetchInterval: 30_000,
  });

export const newSubsPreviousCountQuery = (hours: number) =>
  queryOptions({
    queryKey: ["new-subs-count-prev", hours],
    queryFn: async (): Promise<number> => {
      const now = Date.now();
      const start = new Date(now - hours * 2 * 3600_000).toISOString();
      const end = new Date(now - hours * 3600_000).toISOString();
      const { count, error } = await supabase
        .from("subdomains")
        .select("id", { count: "estimated", head: true })
        .gte("first_seen_at", start)
        .lt("first_seen_at", end);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    refetchInterval: 120_000,
  });

export const newSubsInfiniteOptions = (hours: number) => ({
  queryKey: ["new-subs-infinite", hours] as const,
  initialPageParam: null as { ts: string; id: string } | null,
  queryFn: async ({
    pageParam,
  }: {
    pageParam: { ts: string; id: string } | null;
  }): Promise<NewSubRow[]> => {
    const { data, error } = await supabase.rpc("new_subs_page", {
      since: sinceIso(hours),
      ...(pageParam ? { before_ts: pageParam.ts, before_id: pageParam.id } : {}),
      lim: NEW_SUBS_PAGE,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as NewSubRow[];
  },
  getNextPageParam: (last: NewSubRow[]) => {
    if (last.length < NEW_SUBS_PAGE) return undefined;
    const tail = last[last.length - 1]!;
    return { ts: tail.first_seen_at, id: tail.id };
  },
  refetchInterval: 30_000,
});

export const heatmapQuery = (hours: number) =>
  queryOptions({
    queryKey: ["new-subs-heatmap", hours],
    queryFn: async (): Promise<{ dow: number; hour: number; c: number }[]> => {
      const { data, error } = await supabase.rpc("new_subs_hour_heatmap", {
        since: sinceIso(hours),
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as { dow: number; hour: number; c: number }[];
    },
    refetchInterval: 120_000,
  });

export const labelBreakdownQuery = (hours: number, limit = 14) =>
  queryOptions({
    queryKey: ["new-subs-labels", hours, limit],
    queryFn: async (): Promise<{ prefix: string; c: number }[]> => {
      const { data, error } = await supabase.rpc("new_subs_label_breakdown", {
        since: sinceIso(hours),
        lim: limit,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as { prefix: string; c: number }[];
    },
    refetchInterval: 120_000,
  });

export const INTERESTING_PATTERNS = [
  "admin",
  "internal",
  "intranet",
  "stage",
  "staging",
  "dev",
  "test",
  "uat",
  "vpn",
  "jenkins",
  "git",
  "jira",
  "grafana",
  "kibana",
  "s3",
  "api",
  "auth",
  "sso",
  "db",
  "backup",
  "legacy",
  "old",
];

export const isInteresting = (host: string) => {
  const h = host.toLowerCase();
  return INTERESTING_PATTERNS.some((p) => h.split(".").some((part) => part === p || part.startsWith(p)));
};

// ---------------------------------------------------------------------------
// Chaos-style updates table (/chaos_updates)
// ---------------------------------------------------------------------------

export type DomainUpdateRow = {
  id: string;
  domain: string;
  total_subdomains: number;
  new_count: number;
  last_seen: string | null;
  last_scanned_at: string | null;
  platform_id: string | null;
  platform_slug: string | null;
  platform_name: string | null;
  platform_color: string | null;
};

export type UpdatesSort = "new" | "total" | "domain";
export const UPDATES_PAGE_SIZE = 50;

export const chaosUpdatesPageQuery = (opts: {
  range: UpdateRangeKey;
  search: string;
  platformId?: string | undefined;
  sort: UpdatesSort;
  dir: "asc" | "desc";
  page: number;
}) =>
  queryOptions({
    queryKey: [
      "chaos-updates",
      opts.range,
      opts.search,
      opts.platformId ?? "all",
      opts.sort,
      opts.dir,
      opts.page,
    ],
    queryFn: async (): Promise<DomainUpdateRow[]> => {
      const { data, error } = await supabase.rpc("domain_updates_page", {
        _since: sinceIso(UPDATE_RANGES[opts.range].hours),
        _search: opts.search.trim() || undefined,
        _platform_id: opts.platformId ?? undefined,
        _sort: opts.sort,
        _dir: opts.dir,
        _limit: UPDATES_PAGE_SIZE,
        _offset: opts.page * UPDATES_PAGE_SIZE,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as DomainUpdateRow[];
    },
    refetchInterval: 30_000,
  });

export const chaosUpdatesCountQuery = (search: string, platformId?: string | undefined) =>
  queryOptions({
    queryKey: ["chaos-updates-count", search, platformId ?? "all"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("domain_updates_count", {
        _search: search.trim() || undefined,
        _platform_id: platformId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    refetchInterval: 60_000,
  });

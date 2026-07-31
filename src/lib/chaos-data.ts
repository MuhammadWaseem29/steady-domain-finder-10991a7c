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

const DOMAIN_COLS =
  "id, domain, enabled, last_scanned_at, last_scan_status, total_subdomains, new_subdomains_last_scan, created_at";

export const PAGE_SIZE = 50;

export const domainsPageQuery = (search: string, page: number) =>
  queryOptions({
    queryKey: ["domains", search, page],
    queryFn: async (): Promise<{ rows: DomainRow[]; total: number }> => {
      let q = supabase
        .from("domains")
        .select(DOMAIN_COLS, { count: "exact" })
        .order("total_subdomains", { ascending: false })
        .order("domain", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike("domain", `%${search.trim()}%`);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { rows: data ?? [], total: count ?? 0 };
    },
    refetchInterval: 60_000,
  });

export const globalStatsQuery = queryOptions({
  queryKey: ["global-stats"],
  queryFn: async () => {
    const [domainCount, subCount, scannedCount, recentNew] = await Promise.all([
      supabase.from("domains").select("id", { count: "exact", head: true }),
      supabase.from("subdomains").select("id", { count: "exact", head: true }),
      supabase
        .from("domains")
        .select("id", { count: "exact", head: true })
        .not("last_scanned_at", "is", null),
      supabase
        .from("subdomains")
        .select("id", { count: "exact", head: true })
        .gte("first_seen_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
    ]);
    return {
      domains: domainCount.count ?? 0,
      subdomains: subCount.count ?? 0,
      scanned: scannedCount.count ?? 0,
      newLast24h: recentNew.count ?? 0,
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
    refetchInterval: 30_000,
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

export const subdomainsQuery = (domainId: string | undefined) =>
  queryOptions({
    queryKey: ["subdomains", domainId],
    enabled: Boolean(domainId),
    queryFn: async (): Promise<SubdomainRow[]> => {
      const all: SubdomainRow[] = [];
      const pageSize = 1000;
      for (let page = 0; page < 60; page++) {
        const { data, error } = await supabase
          .from("subdomains")
          .select("id, host, label, first_seen_at, last_seen_at, is_active")
          .eq("domain_id", domainId!)
          .order("first_seen_at", { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw new Error(error.message);
        all.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return all;
    },
    refetchInterval: 60_000,
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
    refetchInterval: 60_000,
  });

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

import { LiveTime } from "@/components/site/live-time";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Copy, Download, Loader2, ArrowLeft, Search } from "lucide-react";
import { SiteShell, Stat } from "@/components/site/chrome";
import {
  domainQuery,
  domainStatsQuery,
  domainSubdomainsPageQuery,
  domainSubCountQuery,
  SUBS_PAGE_SIZE,
  scansQuery,
  timeAgo,
  isNew,
} from "@/lib/chaos-data";

import { getScanJobStatus, runScanNow } from "@/lib/chaos.functions";

export const Route = createFileRoute("/domain/$domain")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.domain} subdomains — Chaos` },
      {
        name: "description",
        content: `Every subdomain discovered for ${params.domain}, refreshed hourly with new-host diffing, copy and export.`,
      },
      { property: "og:title", content: `${params.domain} subdomains — Chaos` },
      {
        property: "og:description",
        content: `Hourly Chaos subdomain monitoring for ${params.domain}.`,
      },
    ],
  }),
  component: DomainDetail,
});

type Filter = "all" | "new" | "inactive";

function DomainDetail() {
  const { domain } = Route.useParams();
  const qc = useQueryClient();
  const { data: row } = useQuery(domainQuery(domain));
  const { data: scans } = useQuery(scansQuery(row?.id));
  const scan = useServerFn(runScanNow);
  const getScanStatus = useServerFn(getScanJobStatus);

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debouncedQ, filter]);

  const { data: stats } = useQuery(domainStatsQuery(row?.id));
  const { data: pageRows, isLoading } = useQuery(
    domainSubdomainsPageQuery(row?.id, debouncedQ, filter, page),
  );
  const { data: matchCount } = useQuery(domainSubCountQuery(row?.id, debouncedQ, filter));
  const announcedJob = useRef<string | null>(null);

  const { data: scanJob } = useQuery({
    queryKey: ["scan-job", row?.id],
    enabled: Boolean(row?.id),
    queryFn: () => getScanStatus({ data: { domainId: row?.id ?? "" } }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "fetching" || status === "processing" ? 3000 : 15000;
    },
  });

  useEffect(() => {
    if (!scanJob || announcedJob.current === scanJob.id) return;
    if (scanJob.status === "success") {
      announcedJob.current = scanJob.id;
      toast.success(`Scan complete — ${scanJob.newCount.toLocaleString()} new subdomains`);
      void qc.invalidateQueries();
    } else if (scanJob.status === "error") {
      announcedJob.current = scanJob.id;
      toast.error(scanJob.error ?? "Scan failed");
    }
  }, [qc, scanJob]);

  const navigate = useNavigate();

  const scanMutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error("Domain not found");
      return scan({ data: { domainId: row.id } });
    },
    onSuccess: (res) => {
      if (res.status === "error") toast.error(res.error ?? "Scan failed");
      else
        toast.success("Scan queued — running in the background", {
          description: "Track it on the Queue page",
          action: { label: "View queue", onClick: () => navigate({ to: "/queue" }) },
        });
      void qc.invalidateQueries({ queryKey: ["scan-job", row?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scanActive = scanJob?.status === "queued" || scanJob?.status === "fetching" || scanJob?.status === "processing";
  const scanPercent = scanJob?.total ? Math.min(100, Math.round((scanJob.processed / scanJob.total) * 100)) : 0;

  const rows = pageRows ?? [];
  const filteredTotal =
    matchCount ?? (filter === "all" && !debouncedQ.trim() ? (stats?.total ?? 0) : rows.length);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / SUBS_PAGE_SIZE));

  const exportUrl = (format: "txt" | "csv" | "json") => {
    const params = new URLSearchParams({ domain, format });
    if (filter === "new") params.set("scope", "new");
    if (filter === "inactive") params.set("scope", "inactive");
    if (debouncedQ.trim()) params.set("search", debouncedQ.trim());
    return `/api/public/export?${params.toString()}`;
  };

  const copy = async () => {
    const id = toast.loading(`Fetching ${filteredTotal.toLocaleString()} hosts…`);
    try {
      const res = await fetch(exportUrl("txt"));
      const text = await res.text();
      await navigator.clipboard.writeText(text.trim());
      toast.success(`Copied ${text.trim().split("\n").filter(Boolean).length.toLocaleString()} hosts`, { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed", { id });
    }
  };

  const exportAs = (format: "txt" | "csv" | "json") => {
    window.location.href = exportUrl(format);
    toast.success(`Exporting ${filteredTotal.toLocaleString()} hosts as ${format}`);
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Link
          to="/dashboard"
          className="label-mono inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to monitor
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-4xl font-extrabold">{domain}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last scanned <LiveTime iso={row?.last_scanned_at ?? null} mode="full" /> · full re-scan sweep every 30 minutes
            </p>
          </div>
          <button
            onClick={() => scanMutation.mutate()}
            disabled={!row || scanMutation.isPending || scanActive}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {scanMutation.isPending || scanActive ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {scanMutation.isPending ? "Queueing…" : scanJob?.status === "queued" ? "Queued" : scanJob?.status === "fetching" ? "Fetching…" : scanJob?.status === "processing" ? `Saving ${scanPercent}%` : "Scan now"}
          </button>
        </div>

        {scanActive && (
          <div className="mt-5" role="status" aria-live="polite">
            <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
              <span>{scanJob.status === "queued" ? "Waiting for scanner" : scanJob.status === "fetching" ? "Fetching all hosts from Chaos" : "Saving discovered hosts"}</span>
              {scanJob.total > 0 && <span>{scanJob.processed.toLocaleString()} / {scanJob.total.toLocaleString()}</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${scanJob.status === "fetching" ? 8 : scanPercent}%` }} />
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Total subdomains" value={(stats?.total ?? row?.total_subdomains ?? 0).toLocaleString()} />
          <Stat label="New (24h)" value={(stats?.new_24h ?? 0).toLocaleString()} />
          <Stat
            label="New last scan"
            value={(row?.new_subdomains_last_scan ?? 0).toLocaleString()}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(["all", "new", "inactive"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`label-mono rounded-full border px-3 py-1.5 transition-colors ${
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="filter hosts…"
              className="w-56 rounded-full border border-input bg-background py-2 pr-4 pl-9 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={copy}
            className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
          >
            <Copy className="size-3" /> Copy all
          </button>
          {(["txt", "csv", "json"] as const).map((f) => (
            <button
              key={f}
              onClick={() => exportAs(f)}
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              <Download className="size-3" /> {f}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Page {(page + 1).toLocaleString()} of {totalPages.toLocaleString()} ·{" "}
          {filteredTotal.toLocaleString()} hosts match
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Host</th>
                <th className="px-5 py-3 font-medium">First seen</th>
                <th className="px-5 py-3 font-medium">Last seen</th>
                <th className="px-5 py-3 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-5 py-2.5 font-mono">
                    {s.host}
                    {isNew(s.first_seen_at) && (
                      <span className="label-mono ml-2 rounded-full bg-success/10 px-2 py-0.5 text-success">
                        new
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    <LiveTime iso={s.first_seen_at} />
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    <LiveTime iso={s.last_seen_at} />
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`label-mono rounded-full px-2 py-0.5 ${
                        s.is_active
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.is_active ? "active" : "gone"}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>
                    {isLoading ? "Loading…" : "No subdomains match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredTotal > SUBS_PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="label-mono rounded-full border border-border px-4 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              Prev
            </button>
            <span className="label-mono text-muted-foreground">
              {(page * SUBS_PAGE_SIZE + 1).toLocaleString()}–
              {Math.min((page + 1) * SUBS_PAGE_SIZE, filteredTotal).toLocaleString()} of{" "}
              {filteredTotal.toLocaleString()}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="label-mono rounded-full border border-border px-4 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        <h2 className="mt-12 text-2xl font-bold">Scan history</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Started</th>
                <th className="px-5 py-3 font-medium">Trigger</th>
                <th className="px-5 py-3 font-medium">Returned</th>
                <th className="px-5 py-3 font-medium">New</th>
                <th className="px-5 py-3 font-medium">Removed</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(scans ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-5 py-2.5 text-muted-foreground"><LiveTime iso={s.started_at} mode="full" /></td>
                  <td className="px-5 py-2.5 font-mono">{s.trigger}</td>
                  <td className="px-5 py-2.5 tabular-nums">{s.total_returned}</td>
                  <td className="px-5 py-2.5 tabular-nums text-success">+{s.new_count}</td>
                  <td className="px-5 py-2.5 tabular-nums text-muted-foreground">
                    -{s.removed_count}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`label-mono rounded-full px-2 py-0.5 ${
                        s.status === "success"
                          ? "bg-success/10 text-success"
                          : s.status === "error"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(scans ?? []).length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                    No scans recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SiteShell>
  );
}

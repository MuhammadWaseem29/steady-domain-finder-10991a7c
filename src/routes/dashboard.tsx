import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Plus, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteShell, Stat } from "@/components/site/chrome";
import {
  domainsPageQuery,
  globalStatsQuery,
  recentSubdomainsQuery,
  timeAgo,
  PAGE_SIZE,
} from "@/lib/chaos-data";
import { runScanNow, addDomains } from "@/lib/chaos.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Monitor — Chaos subdomain tracking" },
      {
        name: "description",
        content:
          "Track thousands of root domains, trigger manual Chaos rescans and watch newly discovered subdomains appear every hour.",
      },
      { property: "og:title", content: "Monitor — Chaos subdomain tracking" },
      {
        property: "og:description",
        content: "Hourly subdomain monitoring dashboard for every tracked root domain.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");

  const { data: stats } = useQuery(globalStatsQuery);
  const { data: pageData, isLoading } = useQuery(domainsPageQuery(search, page));
  const { data: recent } = useQuery(recentSubdomainsQuery(40));

  const scan = useServerFn(runScanNow);
  const add = useServerFn(addDomains);

  const scanMutation = useMutation({
    mutationFn: (domainId: string) => scan({ data: { domainId } }),
    onSuccess: (res) => {
      if (res.status === "error") toast.error(res.error ?? "Scan failed");
      else toast.success(`Scan complete — ${res.newCount ?? 0} new subdomains`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: (domains: string) => add({ data: { domains } }),
    onSuccess: (res) => {
      toast.success(`${res.added} domain(s) queued for scanning`);
      setInput("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-muted-foreground">Dashboard</p>
        <h1 className="mt-2 text-4xl font-extrabold">Subdomain monitor</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every enabled root domain is rescanned on a rolling cycle that completes every hour. New
          hosts are diffed against everything ever seen.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Root domains" value={(stats?.domains ?? 0).toLocaleString()} />
          <Stat label="Domains scanned" value={(stats?.scanned ?? 0).toLocaleString()} />
          <Stat label="Subdomains stored" value={(stats?.subdomains ?? 0).toLocaleString()} />
          <Stat label="New (24h)" value={(stats?.newLast24h ?? 0).toLocaleString()} />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="label-mono text-muted-foreground">Add root domains</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="example.com, another.com"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => addMutation.mutate(input)}
              disabled={!input.trim() || addMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Paste the contents of a root_domains.txt file — separated by spaces, commas or new
            lines.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Recently added subdomains</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Newest hosts discovered across every monitored root domain.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(recent ?? []).map((s) => (
              <Link
                key={s.id}
                to="/domain/$domain"
                params={{ domain: s.domains?.domain ?? "" }}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-2.5 transition-colors hover:bg-accent"
              >
                <span className="truncate font-mono text-sm">{s.host}</span>
                <span className="label-mono shrink-0 text-muted-foreground">
                  {timeAgo(s.first_seen_at)}
                </span>
              </Link>
            ))}
            {(recent ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No subdomains discovered yet.</p>
            )}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Root domains</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="search domains…"
              className="w-64 rounded-full border border-input bg-background py-2 pr-4 pl-9 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Domain</th>
                <th className="px-5 py-3 font-medium">Subdomains</th>
                <th className="px-5 py-3 font-medium">New</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link
                      to="/domain/$domain"
                      params={{ domain: d.domain }}
                      className="font-mono hover:underline"
                    >
                      {d.domain}
                    </Link>
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {d.total_subdomains.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {d.new_subdomains_last_scan > 0 ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
                        +{d.new_subdomains_last_scan}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={d.last_scan_status} />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {timeAgo(d.last_scanned_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => scanMutation.mutate(d.id)}
                      disabled={scanMutation.isPending}
                      className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {scanMutation.isPending && scanMutation.variables === d.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      Scan
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                    {isLoading ? "Loading…" : "No domains match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {pages.toLocaleString()} · {total.toLocaleString()} domains
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="label-mono inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-3" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => (p + 1 < pages ? p + 1 : p))}
              disabled={page + 1 >= pages}
              className="label-mono inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              Next <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    success: "bg-success/10 text-success",
    running: "bg-brand/10 text-brand",
    error: "bg-destructive/10 text-destructive",
  };
  const cls = map[status ?? ""] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`label-mono rounded-full px-2 py-0.5 ${cls}`}>{status ?? "pending"}</span>
  );
}

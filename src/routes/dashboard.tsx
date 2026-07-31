import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  Plus,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
} from "lucide-react";
import { SiteShell, Stat } from "@/components/site/chrome";
import { DiscoveryAreaChart } from "@/components/site/charts";
import {
  domainsPageQuery,
  globalStatsQuery,
  recentSubdomainsQuery,
  platformsQuery,
  discoveryTimeseriesQuery,
  windowCountsQuery,
  formatTick,
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
  const [platformSlug, setPlatformSlug] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [copying, setCopying] = useState(false);

  const { data: stats } = useQuery(globalStatsQuery);
  const { data: counts } = useQuery(windowCountsQuery);
  const { data: platforms } = useQuery(platformsQuery);
  const { data: series } = useQuery(discoveryTimeseriesQuery("7d"));
  const { data: pageData, isLoading } = useQuery(
    domainsPageQuery(search, page, filterPlatform || undefined),
  );
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
    mutationFn: (domains: string) =>
      add({ data: { domains, platformSlug: platformSlug || undefined } }),
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

  const chart = (series ?? []).map((p) => ({
    label: formatTick(p.ts, "day"),
    value: Number(p.new_subdomains),
  }));

  const copyEverything = async () => {
    setCopying(true);
    try {
      const res = await fetch("/api/public/export?scope=all");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${text.trim() ? text.trim().split("\n").length : 0} subdomains`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  };

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
          <Stat label="Root domains" value={(stats?.domains ?? 0).toLocaleString()} index={0} />
          <Stat label="Domains scanned" value={(stats?.scanned ?? 0).toLocaleString()} index={1} />
          <Stat
            label="Subdomains stored"
            value={(stats?.subdomains ?? 0).toLocaleString()}
            index={2}
          />
          <Stat
            label="New (24h)"
            value={(stats?.newLast24h ?? 0).toLocaleString()}
            hint={`${(counts?.hour ?? 0).toLocaleString()} in the last hour`}
            index={3}
          />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label-mono text-muted-foreground">Discovery — last 7 days</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyEverything}
                disabled={copying}
                className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-50"
              >
                {copying ? <Loader2 className="size-3 animate-spin" /> : <Copy className="size-3" />}
                Copy ALL subdomains
              </button>
              <a
                href="/api/public/export?scope=all"
                className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
              >
                <Download className="size-3" /> Download all .txt
              </a>
              <a
                href="/api/public/export?scope=new&hours=24"
                className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
              >
                <Download className="size-3" /> New 24h .txt
              </a>
            </div>
          </div>
          <div className="mt-4">
            <DiscoveryAreaChart data={chart} />
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="label-mono text-muted-foreground">Add root domains</p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              placeholder={"example.com\nanother.com"}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-3">
              <select
                value={platformSlug}
                onChange={(e) => setPlatformSlug(e.target.value)}
                className="h-fit rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No platform</option>
                {(platforms ?? []).map((p) => (
                  <option key={p.platform_id} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => addMutation.mutate(input)}
                disabled={!input.trim() || addMutation.isPending}
                className="inline-flex h-fit items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            One domain or a whole root_domains.txt paste — separated by spaces, commas or new
            lines. Pick a platform to file them under that program.
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
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:bg-accent"
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
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterPlatform}
              onChange={(e) => {
                setFilterPlatform(e.target.value);
                setPage(0);
              }}
              className="rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All platforms</option>
              {(platforms ?? []).map((p) => (
                <option key={p.platform_id} value={p.platform_id}>
                  {p.name}
                </option>
              ))}
            </select>
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

        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
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
                    {editRow?.id === d.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={editRow.domain}
                          onChange={(e) =>
                            setEditRow((r) => (r ? { ...r, domain: e.target.value } : r))
                          }
                          className="w-52 rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <select
                          value={editRow.platformId}
                          onChange={(e) =>
                            setEditRow((r) => (r ? { ...r, platformId: e.target.value } : r))
                          }
                          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">No platform</option>
                          {(platforms ?? []).map((p) => (
                            <option key={p.platform_id} value={p.platform_id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <Link
                        to="/domain/$domain"
                        params={{ domain: d.domain }}
                        className="font-mono hover:underline"
                      >
                        {d.domain}
                      </Link>
                    )}
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
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {editRow?.id === d.id ? (
                        <>
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: d.id,
                                domain: editRow.domain.trim().toLowerCase(),
                                platformId: editRow.platformId || null,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="label-mono inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            Save
                          </button>
                          <button
                            onClick={() => setEditRow(null)}
                            className="grid size-8 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
                            aria-label="Cancel edit"
                          >
                            <X className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
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
                          <button
                            onClick={() =>
                              setEditRow({
                                id: d.id,
                                domain: d.domain,
                                platformId: d.platform_id ?? "",
                              })
                            }
                            aria-label={`Edit ${d.domain}`}
                            className="grid size-8 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirmId === d.id) deleteMutation.mutate(d.id);
                              else setConfirmId(d.id);
                            }}
                            aria-label={`Delete ${d.domain}`}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
                              confirmId === d.id
                                ? "label-mono border-destructive bg-destructive/10 text-destructive"
                                : "grid size-8 place-items-center border-border px-0 py-0 text-destructive hover:bg-destructive/10"
                            }`}
                          >
                            {deleteMutation.isPending && deleteMutation.variables === d.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            {confirmId === d.id && "Confirm"}
                          </button>
                        </>
                      )}
                    </div>
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

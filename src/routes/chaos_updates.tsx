import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDownUp,
  Download,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { SiteShell, Stat } from "@/components/site/chrome";
import { CountUp, EASE_SIGNATURE, Skeleton } from "@/components/site/motion";
import {
  UPDATE_RANGES,
  UPDATES_PAGE_SIZE,
  type UpdateRangeKey,
  type UpdatesSort,
  chaosUpdatesCountQuery,
  chaosUpdatesPageQuery,
  platformsQuery,
  timeAgo,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/chaos_updates")({
  head: () => ({
    meta: [
      { title: "Chaos updates — companies with new subdomains" },
      {
        name: "description",
        content:
          "Browse every tracked company by new subdomains found in the last hour, day, week or month. Search, filter by platform, sort and download per-company host lists.",
      },
      { property: "og:title", content: "Chaos updates — companies with new subdomains" },
      {
        property: "og:description",
        content:
          "One row per root domain: new finds, total subdomains, bug bounty platform and instant downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChaosUpdatesPage,
});

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K` : String(n);

function SortHead({
  label,
  value,
  sort,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  value: UpdatesSort;
  sort: UpdatesSort;
  dir: "asc" | "desc";
  onSort: (s: UpdatesSort) => void;
  align?: "left" | "right";
}) {
  const active = sort === value;
  return (
    <button
      onClick={() => onSort(value)}
      className={`label-mono inline-flex items-center gap-1.5 transition-colors hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${align === "right" ? "justify-end" : ""}`}
    >
      {label}
      <ArrowDownUp
        className={`size-3 transition-transform ${active && dir === "asc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function ChaosUpdatesPage() {
  const [range, setRange] = useState<UpdateRangeKey>("24h");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [platformId, setPlatformId] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<UpdatesSort>("new");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: platforms } = useQuery(platformsQuery);
  const {
    data: rows,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery(chaosUpdatesPageQuery({ range, search, platformId, sort, dir, page }));
  const { data: total } = useQuery(chaosUpdatesCountQuery(search, platformId));

  const list = rows ?? [];
  const pages = Math.max(1, Math.ceil((total ?? 0) / UPDATES_PAGE_SIZE));

  const summary = useMemo(
    () => ({
      withNew: list.filter((r) => Number(r.new_count) > 0).length,
      newHosts: list.reduce((a, r) => a + Number(r.new_count), 0),
      subs: list.reduce((a, r) => a + Number(r.total_subdomains ?? 0), 0),
    }),
    [list],
  );

  const onSort = (s: UpdatesSort) => {
    if (s === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(s);
      setDir(s === "domain" ? "asc" : "desc");
    }
    setPage(0);
  };

  const hours = UPDATE_RANGES[range].hours;

  const exportUrl = (domain: string, scope: "all" | "new") =>
    `/api/public/export?domain=${encodeURIComponent(domain)}&scope=${scope}&hours=${hours}&format=txt`;

  const copyPage = async () => {
    if (!list.length) {
      toast.error("Nothing to copy yet");
      return;
    }
    await navigator.clipboard.writeText(list.map((r) => r.domain).join("\n"));
    toast.success(`Copied ${list.length} companies`);
  };

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="label-mono text-muted-foreground">Chaos updates</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Which companies just found new subdomains
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          One row per tracked root domain — new finds inside your window, total subdomains, the
          bug bounty platform it belongs to, and a one-click download.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Companies with new finds" value={summary.withNew} index={0} />
          <Stat label="New hosts on this page" value={summary.newHosts} index={1} />
          <Stat label="Subdomains on this page" value={summary.subs} index={2} />
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search company"
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(UPDATE_RANGES) as UpdateRangeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setRange(key);
                    setPage(0);
                  }}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    range === key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {UPDATE_RANGES[key].label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Updated {timeAgo(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)}
              </button>
              <button
                onClick={copyPage}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
              >
                Copy companies
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-border p-4">
            <button
              onClick={() => {
                setPlatformId(undefined);
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                !platformId ? "border-foreground bg-foreground text-background" : "border-border hover:bg-accent"
              }`}
            >
              All platforms
            </button>
            {(platforms ?? []).map((p) => (
              <button
                key={p.platform_id}
                onClick={() => {
                  setPlatformId(p.platform_id);
                  setPage(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  platformId === p.platform_id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: p.color ?? "hsl(var(--muted-foreground))" }}
                />
                {p.name}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3">
                    <SortHead label="Company" value="domain" sort={sort} dir={dir} onSort={onSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHead label="New" value="new" sort={sort} dir={dir} onSort={onSort} align="right" />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHead
                      label="Subdomains"
                      value="total"
                      sort={sort}
                      dir={dir}
                      onSort={onSort}
                      align="right"
                    />
                  </th>
                  <th className="label-mono px-4 py-3 text-muted-foreground">Platform</th>
                  <th className="label-mono px-4 py-3 text-right text-muted-foreground">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  : list.map((r, i) => {
                      const news = Number(r.new_count);
                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.25,
                            delay: Math.min(i, 12) * 0.02,
                            ease: EASE_SIGNATURE,
                          }}
                          className="hover:bg-accent/40"
                        >
                          <td className="px-4 py-3">
                            <Link
                              to="/domain/$domain"
                              params={{ domain: r.domain }}
                              className="font-medium hover:underline"
                            >
                              {r.domain}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              last find {timeAgo(r.last_seen)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {news > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-success">
                                <ArrowUp className="size-3" />
                                {compact(news)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            <CountUp value={Number(r.total_subdomains ?? 0)} />
                          </td>
                          <td className="px-4 py-3">
                            {r.platform_name ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                                style={{ borderColor: r.platform_color ?? undefined }}
                              >
                                <span
                                  className="size-2 rounded-full"
                                  style={{
                                    background: r.platform_color ?? "hsl(var(--muted-foreground))",
                                  }}
                                />
                                {r.platform_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {news > 0 && (
                                <a
                                  href={exportUrl(r.domain, "new")}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-success/40 px-2.5 py-1.5 text-xs text-success hover:bg-success/10"
                                >
                                  <Download className="size-3.5" /> New
                                </a>
                              )}
                              <a
                                href={exportUrl(r.domain, "all")}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
                              >
                                <Download className="size-3.5" /> All
                              </a>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!isLoading && list.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No companies match this filter.</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs text-muted-foreground">
            <span>
              Page {page + 1} of {pages} · {(total ?? 0).toLocaleString()} companies
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </button>
              <button
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

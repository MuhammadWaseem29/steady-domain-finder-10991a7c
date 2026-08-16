import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { SiteShell, Stat } from "@/components/site/chrome";
import { CountUp, EASE_SIGNATURE, Skeleton } from "@/components/site/motion";
import {
  UPDATES_PAGE_SIZES,
  UPDATE_WINDOWS,
  type DomainUpdateRow,
  type UpdateWindowKey,
  type UpdatesFilters,
  type UpdatesSort,
  chaosUpdatesCountQuery,
  chaosUpdatesPageQuery,
  chaosUpdatesSummaryQuery,
  domainNewSubsQuery,
  platformsQuery,
  resolveWindow,
  timeAgo,
  updatesSparklineQuery,
} from "@/lib/chaos-data";

type UpdatesSearch = {
  w: UpdateWindowKey;
  from?: string;
  to?: string;
  q: string;
  kw: string;
  pf?: string;
  sort: UpdatesSort;
  dir: "asc" | "desc";
  page: number;
  size: number;
  onlyNew: boolean;
  dense: boolean;
  auto: number;
};

const str = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
const num = (v: unknown, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

export const Route = createFileRoute("/chaos_updates")({
  validateSearch: (search: Record<string, unknown>): UpdatesSearch => ({
    w: str(search.w, "24h") as UpdateWindowKey,
    ...(str(search.from) ? { from: str(search.from) } : {}),
    ...(str(search.to) ? { to: str(search.to) } : {}),
    q: str(search.q),
    kw: str(search.kw),
    ...(str(search.pf) ? { pf: str(search.pf) } : {}),
    sort: (["new", "total", "domain"].includes(str(search.sort))
      ? str(search.sort)
      : "new") as UpdatesSort,
    dir: str(search.dir) === "asc" ? "asc" : "desc",
    page: Math.max(0, num(search.page, 0)),
    size: UPDATES_PAGE_SIZES.includes(num(search.size, 50)) ? num(search.size, 50) : 50,
    onlyNew: search.onlyNew === true || search.onlyNew === "true",
    dense: search.dense === true || search.dense === "true",
    auto: num(search.auto, 0),
  }),
  head: () => ({
    meta: [
      { title: "Chaos updates — companies with new subdomains" },
      {
        name: "description",
        content:
          "Track every company that just found new subdomains. Any time window from 1 hour to 6 months, keyword filters, bulk copy and TXT/CSV/JSON exports of new hosts.",
      },
      { property: "og:title", content: "Chaos updates — companies with new subdomains" },
      {
        property: "og:description",
        content:
          "One row per root domain: new finds, total subdomains, bug bounty platform, inline host preview and instant downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChaosUpdatesPage,
});

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K` : String(n);

const AUTO_OPTIONS = [
  { v: 0, label: "Off" },
  { v: 30, label: "30s" },
  { v: 120, label: "2m" },
  { v: 300, label: "5m" },
];

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

function ExpandedHosts({
  domainId,
  since,
  domain,
}: {
  domainId: string;
  since: string;
  domain: string;
}) {
  const { data, isLoading } = useQuery(domainNewSubsQuery(domainId, since, 60));
  const hosts = data ?? [];
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : hosts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No new hosts for {domain} in this window.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="label-mono text-muted-foreground">
              Newest {hosts.length} host{hosts.length === 1 ? "" : "s"}
            </p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(hosts.map((h) => h.host).join("\n"));
                toast.success(`Copied ${hosts.length} hosts`);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              <Copy className="size-3" /> Copy shown
            </button>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {hosts.map((h) => (
              <li key={h.id} className="flex items-center gap-2 font-mono text-xs">
                <span className="truncate">{h.host}</span>
                <a
                  href={`https://${h.host}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                >
                  https
                </a>
                <a
                  href={`http://${h.host}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                >
                  http
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ChaosUpdatesPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const set = (patch: Partial<UpdatesSearch>, resetPage = true) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 0 } : {}) }),
      replace: true,
    });

  const [searchInput, setSearchInput] = useState(s.q);
  const [keywordInput, setKeywordInput] = useState(s.kw);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== s.q) set({ q: searchInput });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (keywordInput !== s.kw) set({ kw: keywordInput });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordInput]);

  const win = useMemo(() => resolveWindow(s.w, s.from, s.to), [s.w, s.from, s.to]);

  const filters: UpdatesFilters = {
    since: win.since,
    search: s.q,
    platformId: s.pf,
    keyword: s.kw,
    onlyNew: s.onlyNew,
  };

  const refetchInterval = s.auto > 0 ? s.auto * 1000 : false;

  const { data: platforms } = useQuery(platformsQuery);
  const {
    data: rows,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    ...chaosUpdatesPageQuery({
      ...filters,
      sort: s.sort,
      dir: s.dir,
      page: s.page,
      pageSize: s.size,
    }),
    refetchInterval,
  });
  const { data: total } = useQuery({ ...chaosUpdatesCountQuery(filters), refetchInterval });
  const { data: summary } = useQuery({ ...chaosUpdatesSummaryQuery(filters), refetchInterval });
  const { data: spark } = useQuery(updatesSparklineQuery(win.since, win.hours));

  const list: DomainUpdateRow[] = rows ?? [];
  const pages = Math.max(1, Math.ceil((total ?? 0) / s.size));

  const movers = useMemo(
    () =>
      [...list]
        .filter((r) => Number(r.new_count) > 0)
        .sort((a, b) => Number(b.new_count) - Number(a.new_count))
        .slice(0, 5),
    [list],
  );

  const onSort = (sortKey: UpdatesSort) => {
    if (sortKey === s.sort) set({ dir: s.dir === "desc" ? "asc" : "desc" });
    else set({ sort: sortKey, dir: sortKey === "domain" ? "asc" : "desc" });
  };

  const exportParams = (
    opts: { scope: "all" | "new"; format?: string; domains?: string[] } = { scope: "new" },
  ) => {
    const p = new URLSearchParams();
    p.set("scope", opts.scope);
    p.set("format", opts.format ?? "txt");
    if (opts.scope === "new") {
      p.set("since", win.since);
      if (win.until) p.set("until", win.until);
    }
    if (opts.domains?.length) p.set("domains", opts.domains.join(","));
    else if (s.pf) {
      const slug = (platforms ?? []).find((pl) => pl.platform_id === s.pf)?.slug;
      if (slug) p.set("platform", slug);
    }
    if (s.kw.trim()) p.set("keyword", s.kw.trim());
    return `/api/public/export?${p.toString()}`;
  };

  const copyFromExport = async (url: string, label: string) => {
    setBusy(true);
    const toastId = toast.loading(`Fetching ${label}…`);
    try {
      const res = await fetch(url);
      const text = (await res.text()).trim();
      if (!text) {
        toast.error("Nothing to copy for this window", { id: toastId });
        return;
      }
      const lines = text.split("\n").filter(Boolean);
      if (lines.length > 200_000) {
        toast.error(`${lines.length.toLocaleString()} hosts is too many to copy — use download`, {
          id: toastId,
        });
        return;
      }
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(`Copied ${lines.length.toLocaleString()} hosts`, { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const selectedDomains = list.filter((r) => selected.includes(r.id)).map((r) => r.domain);
  const allOnPageSelected = list.length > 0 && list.every((r) => selected.includes(r.id));

  const pad = s.dense ? "px-3 py-1.5" : "px-4 py-3";

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-10">
        <p className="label-mono text-muted-foreground">Chaos updates</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Which companies just found new subdomains
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          One row per tracked root domain — new finds inside your window, total subdomains, the bug
          bounty platform it belongs to, and one-click copy or download of every new host.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Companies in view" value={summary?.companies ?? 0} index={0} />
          <Stat label="With new finds" value={summary?.companies_with_new ?? 0} index={1} />
          <Stat label={`New hosts (${win.label})`} value={summary?.new_hosts ?? 0} index={2} />
          <Stat label="Total subdomains" value={summary?.total_subdomains ?? 0} index={3} />
        </div>

        {(spark?.length ?? 0) > 1 && (
          <div className="mt-4 h-24 rounded-lg border border-border bg-card p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id="updSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="ts" hide />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                />
                <Area
                  type="monotone"
                  dataKey="new_subdomains"
                  stroke="hsl(var(--success))"
                  fill="url(#updSpark)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {movers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="label-mono text-muted-foreground">Top movers</span>
            {movers.map((m) => (
              <Link
                key={m.id}
                to="/domain/$domain"
                params={{ domain: m.domain }}
                className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success hover:bg-success/20"
              >
                {m.domain}
                <span className="font-mono font-semibold">+{compact(Number(m.new_count))}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-lg border border-border bg-card">
          {/* window switcher */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-4">
            <span className="label-mono mr-1 text-muted-foreground">Window</span>
            {(Object.keys(UPDATE_WINDOWS) as (keyof typeof UPDATE_WINDOWS)[]).map((key) => (
              <button
                key={key}
                onClick={() => set({ w: key })}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  s.w === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-accent"
                }`}
              >
                {UPDATE_WINDOWS[key].label}
              </button>
            ))}
            <button
              onClick={() =>
                set({
                  w: "custom",
                  from:
                    s.from ?? new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 16),
                })
              }
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                s.w === "custom"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-accent"
              }`}
            >
              Custom
            </button>
            {s.w === "custom" && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="datetime-local"
                  value={(s.from ?? "").slice(0, 16)}
                  onChange={(e) => set({ from: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1.5"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  type="datetime-local"
                  value={(s.to ?? "").slice(0, 16)}
                  onChange={(e) => set({ to: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1.5"
                />
                <span className="text-muted-foreground">{win.label}</span>
              </div>
            )}
          </div>

          {/* search + toggles */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search company"
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-foreground"
              />
            </div>
            <div className="relative min-w-[180px] flex-1">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Host keyword (dev, api, staging…)"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
              />
              {keywordInput && (
                <button
                  onClick={() => setKeywordInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={s.onlyNew}
                onChange={(e) => set({ onlyNew: e.target.checked })}
                className="accent-current"
              />
              Only with new finds
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={s.dense}
                onChange={(e) => set({ dense: e.target.checked }, false)}
                className="accent-current"
              />
              Compact
            </label>
            <select
              value={s.size}
              onChange={(e) => set({ size: Number(e.target.value) })}
              className="rounded-md border border-border bg-background px-2 py-2 text-xs"
            >
              {UPDATES_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <select
              value={s.auto}
              onChange={(e) => set({ auto: Number(e.target.value) }, false)}
              className="rounded-md border border-border bg-background px-2 py-2 text-xs"
            >
              {AUTO_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  Auto-refresh {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Updated {timeAgo(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)}
            </button>
          </div>

          {/* platform chips */}
          <div className="flex flex-wrap gap-1.5 border-b border-border p-4">
            <button
              onClick={() => set({ pf: undefined })}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                !s.pf
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-accent"
              }`}
            >
              All platforms
            </button>
            {(platforms ?? []).map((p) => (
              <button
                key={p.platform_id}
                onClick={() => set({ pf: p.platform_id })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  s.pf === p.platform_id
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

          {/* bulk actions */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4 text-xs">
            <span className="label-mono text-muted-foreground">Bulk</span>
            <button
              disabled={busy}
              onClick={() => copyFromExport(exportParams({ scope: "new" }), "new hosts")}
              className="inline-flex items-center gap-1.5 rounded-md border border-success/40 px-3 py-1.5 text-success hover:bg-success/10 disabled:opacity-50"
            >
              <Copy className="size-3.5" /> Copy all new subs ({win.label})
            </button>
            <a
              href={exportParams({ scope: "new" })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              <Download className="size-3.5" /> New .txt
            </a>
            <a
              href={exportParams({ scope: "new", format: "csv" })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              <Download className="size-3.5" /> New .csv
            </a>
            <a
              href={exportParams({ scope: "new", format: "json" })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              <Download className="size-3.5" /> New .json
            </a>
            <a
              href={exportParams({ scope: "all" })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              <Download className="size-3.5" /> All subs
            </a>
            <button
              disabled={busy || !list.length}
              onClick={async () => {
                await navigator.clipboard.writeText(list.map((r) => r.domain).join("\n"));
                toast.success(`Copied ${list.length} companies`);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50"
            >
              <Copy className="size-3.5" /> Copy companies
            </button>
          </div>

          <AnimatePresence>
            {selected.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-2 overflow-hidden border-b border-border bg-accent/40 p-4 text-xs"
              >
                <span className="font-medium">{selected.length} selected</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    copyFromExport(
                      exportParams({ scope: "new", domains: selectedDomains }),
                      "selected new hosts",
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-background disabled:opacity-50"
                >
                  <Copy className="size-3.5" /> Copy new hosts
                </button>
                <a
                  href={exportParams({ scope: "new", domains: selectedDomains })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-background"
                >
                  <Download className="size-3.5" /> Download new
                </a>
                <a
                  href={exportParams({ scope: "all", domains: selectedDomains })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-background"
                >
                  <Download className="size-3.5" /> Download all
                </a>
                <button
                  onClick={() => setSelected([])}
                  className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" /> Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-left">
                  <th className={`${pad} w-8`}>
                    <button
                      onClick={() =>
                        setSelected(allOnPageSelected ? [] : list.map((r) => r.id))
                      }
                      className="flex size-4 items-center justify-center rounded border border-border"
                      aria-label="Select all on page"
                    >
                      {allOnPageSelected && <Check className="size-3" />}
                    </button>
                  </th>
                  <th className={pad}>
                    <SortHead
                      label="Company"
                      value="domain"
                      sort={s.sort}
                      dir={s.dir}
                      onSort={onSort}
                    />
                  </th>
                  <th className={`${pad} text-right`}>
                    <SortHead
                      label="New"
                      value="new"
                      sort={s.sort}
                      dir={s.dir}
                      onSort={onSort}
                      align="right"
                    />
                  </th>
                  <th className={`${pad} text-right`}>
                    <SortHead
                      label="Subdomains"
                      value="total"
                      sort={s.sort}
                      dir={s.dir}
                      onSort={onSort}
                      align="right"
                    />
                  </th>
                  <th className={`label-mono ${pad} text-muted-foreground`}>Platform</th>
                  <th className={`label-mono ${pad} text-right text-muted-foreground`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className={pad}>
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  : list.map((r, i) => {
                      const news = Number(r.new_count);
                      const isSel = selected.includes(r.id);
                      const open = expanded === r.id;
                      return (
                        <>
                          <motion.tr
                            key={r.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.25,
                              delay: Math.min(i, 12) * 0.02,
                              ease: EASE_SIGNATURE,
                            }}
                            className={`hover:bg-accent/40 ${isSel ? "bg-accent/30" : ""}`}
                          >
                            <td className={pad}>
                              <button
                                onClick={() =>
                                  setSelected((prev) =>
                                    prev.includes(r.id)
                                      ? prev.filter((x) => x !== r.id)
                                      : [...prev, r.id],
                                  )
                                }
                                className="flex size-4 items-center justify-center rounded border border-border"
                                aria-label={`Select ${r.domain}`}
                              >
                                {isSel && <Check className="size-3" />}
                              </button>
                            </td>
                            <td className={pad}>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setExpanded(open ? null : r.id)}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Toggle new hosts"
                                >
                                  <ChevronDown
                                    className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                                  />
                                </button>
                                <div>
                                  <Link
                                    to="/domain/$domain"
                                    params={{ domain: r.domain }}
                                    className="font-medium hover:underline"
                                  >
                                    {r.domain}
                                  </Link>
                                  {!s.dense && (
                                    <p className="text-xs text-muted-foreground">
                                      last find {timeAgo(r.last_seen)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={`${pad} text-right`}>
                              {news > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-success">
                                  <ArrowUp className="size-3" />
                                  {compact(news)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className={`${pad} text-right font-mono tabular-nums`}>
                              <CountUp value={Number(r.total_subdomains ?? 0)} />
                            </td>
                            <td className={pad}>
                              {r.platform_name ? (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                                  style={{ borderColor: r.platform_color ?? undefined }}
                                >
                                  <span
                                    className="size-2 rounded-full"
                                    style={{
                                      background:
                                        r.platform_color ?? "hsl(var(--muted-foreground))",
                                    }}
                                  />
                                  {r.platform_name}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className={pad}>
                              <div className="flex justify-end gap-2">
                                {news > 0 && (
                                  <>
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        copyFromExport(
                                          exportParams({ scope: "new", domains: [r.domain] }),
                                          `${r.domain} new hosts`,
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-md border border-success/40 px-2.5 py-1.5 text-xs text-success hover:bg-success/10 disabled:opacity-50"
                                    >
                                      <Copy className="size-3.5" /> New
                                    </button>
                                    <a
                                      href={exportParams({ scope: "new", domains: [r.domain] })}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-success/40 px-2.5 py-1.5 text-xs text-success hover:bg-success/10"
                                    >
                                      <Download className="size-3.5" />
                                    </a>
                                  </>
                                )}
                                <a
                                  href={exportParams({ scope: "all", domains: [r.domain] })}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
                                >
                                  <Download className="size-3.5" /> All
                                </a>
                              </div>
                            </td>
                          </motion.tr>
                          {open && (
                            <tr key={`${r.id}-x`}>
                              <td colSpan={6} className="px-4 pb-4">
                                <ExpandedHosts
                                  domainId={r.id}
                                  since={win.since}
                                  domain={r.domain}
                                />
                              </td>
                            </tr>
                          )}
                        </>
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
              Page {s.page + 1} of {pages} · {(total ?? 0).toLocaleString()} companies
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={s.page === 0}
                onClick={() => set({ page: Math.max(0, s.page - 1) }, false)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </button>
              <input
                type="number"
                min={1}
                max={pages}
                value={s.page + 1}
                onChange={(e) =>
                  set(
                    {
                      page: Math.min(
                        pages - 1,
                        Math.max(0, Number(e.target.value || 1) - 1),
                      ),
                    },
                    false,
                  )
                }
                className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-center"
              />
              <button
                disabled={s.page + 1 >= pages}
                onClick={() => set({ page: s.page + 1 }, false)}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Flame,
  Gauge,
  Layers,
  Loader2,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { SiteShell } from "@/components/site/chrome";
import { LiveScanActivity } from "@/components/site/live-scans";
import { CountUp, EASE_SIGNATURE, Skeleton, Spotlight } from "@/components/site/motion";
import {
  CumulativeLineChart,
  DiscoveryAreaChart,
  DiscoveryHeatmap,
  HorizontalBars,
  ShareDonut,
} from "@/components/site/charts";
import { getRecentSubsAnalytics } from "@/lib/analytics.functions";
import {
  UPDATE_RANGES,
  type UpdateRangeKey,
  type RangeKey,
  type NewSubRow,
  isInteresting,
  newSubsInfiniteOptions,
  download,
  formatTick,
  timeAgo,
  RANGES,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/recentsubs")({
  head: () => ({
    meta: [
      { title: "Recent subdomains — live discovery analytics" },
      {
        name: "description",
        content:
          "Real-time analytics for newly discovered subdomains: discovery trends, heatmaps, program share, high-value hosts and an unlimited live feed with copy and export.",
      },
      { property: "og:title", content: "Recent subdomains — live discovery analytics" },
      {
        property: "og:description",
        content:
          "Charts, KPIs and every subdomain discovered in the last hour, day, week or month — no limits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecentSubsPage,
});

const CHART_RANGE: Record<UpdateRangeKey, RangeKey> = {
  "1h": "24h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
};

function copyList(lines: string[], label: string) {
  if (!lines.length) {
    toast.error("Nothing to copy yet");
    return;
  }
  navigator.clipboard.writeText(lines.join("\n"));
  toast.success(`Copied ${lines.length.toLocaleString()} ${label}`);
}

function Kpi({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tone,
  index,
  delta,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  tone: string;
  index: number;
  delta?: number | null;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: EASE_SIGNATURE }}
    >
      <Spotlight className="hover-lift h-full rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="grid size-8 place-items-center rounded-md"
              style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}
            >
              <Icon className="size-4" />
            </span>
            <span className="chip-mono text-muted-foreground">{label}</span>
          </div>
          {typeof delta === "number" ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium"
              style={{ color: up ? "var(--color-chart-2)" : "var(--color-destructive)" }}
            >
              {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {Math.abs(delta)}%
            </span>
          ) : null}
        </div>
        <div className="mt-3 font-mono text-3xl font-semibold tracking-tight">
          <CountUp value={value} />
          {suffix ? <span className="ml-1 text-base text-muted-foreground">{suffix}</span> : null}
        </div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </Spotlight>
    </motion.div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: EASE_SIGNATURE }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
    >
      {children}
    </button>
  );
}

function RecentSubsPage() {
  const [range, setRange] = useState<UpdateRangeKey>("24h");
  const hours = UPDATE_RANGES[range].hours;
  const chartRange = CHART_RANGE[range];

  const analytics = useQuery({
    queryKey: ["recentsubs-analytics", hours, RANGES[chartRange].bucket],
    queryFn: () =>
      getRecentSubsAnalytics({ data: { hours, bucket: RANGES[chartRange].bucket } }),
    refetchInterval: 60_000,
  });
  const a = analytics.data;
  const loading = analytics.isLoading;

  const feed = useInfiniteQuery(newSubsInfiniteOptions(hours));

  const [search, setSearch] = useState("");
  const [prefix, setPrefix] = useState<string | null>(null);
  const [onlyInteresting, setOnlyInteresting] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [copying, setCopying] = useState(false);

  const rows: NewSubRow[] = useMemo(
    () => (feed.data?.pages ?? []).flat(),
    [feed.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.host.toLowerCase().includes(q) && !(r.domain ?? "").toLowerCase().includes(q))
        return false;
      if (prefix && r.host.split(".")[0] !== prefix) return false;
      if (onlyInteresting && !isInteresting(r.host)) return false;
      return true;
    });
  }, [rows, search, prefix, onlyInteresting]);

  const displayRows = useMemo(() => {
    if (!grouped) return filtered;
    return [...filtered].sort(
      (a, b) =>
        (a.domain ?? "").localeCompare(b.domain ?? "") ||
        a.host.localeCompare(b.host),
    );
  }, [filtered, grouped]);

  const interestingCount = useMemo(
    () => rows.filter((r) => isInteresting(r.host)).length,
    [rows],
  );

  // auto-load next page when the sentinel scrolls into view
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed]);

  const seriesData = useMemo(
    () =>
      (a?.series ?? []).map((p) => ({
        label: formatTick(p.ts, RANGES[chartRange].bucket),
        value: Number(p.new_subdomains),
      })),
    [a?.series, chartRange],
  );

  const donutData = useMemo(
    () =>
      (a?.platforms ?? [])
        .filter((p) => Number(p.new_count) > 0)
        .slice(0, 6)
        .map((p) => ({
          label: p.name,
          value: Number(p.new_count),
          ...(p.color ? { color: p.color } : {}),
        })),
    [a?.platforms],
  );

  const topData = useMemo(
    () => (a?.top ?? []).map((d) => ({ label: d.domain, value: Number(d.new_count) })),
    [a?.top],
  );

  const labelData = useMemo(
    () => (a?.labels ?? []).map((l) => ({ label: l.prefix, value: Number(l.c) })),
    [a?.labels],
  );

  const reliability = useMemo(() => {
    const rowsS = a?.scans ?? [];
    const scans = rowsS.reduce((a, r) => a + Number(r.scans), 0);
    const errors = rowsS.reduce((a, r) => a + Number(r.errors), 0);
    const found = rowsS.reduce((a, r) => a + Number(r.new_found), 0);
    return {
      scans,
      errors,
      found,
      rate: scans ? Math.round(((scans - errors) / scans) * 1000) / 10 : 100,
    };
  }, [a?.scans]);

  const total = a?.total ?? 0;
  const delta =
    a && a.previous > 0
      ? Math.round(((total - a.previous) / a.previous) * 100)
      : null;

  const exportUrl = `/api/public/export?scope=new&hours=${hours}`;

  async function copyEverything() {
    setCopying(true);
    try {
      const res = await fetch(exportUrl);
      const text = await res.text();
      const lines = text.split("\n").filter(Boolean);
      if (!lines.length) {
        toast.error("Nothing to copy yet");
        return;
      }
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(`Copied ${lines.length.toLocaleString()} hosts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_SIGNATURE }}
          className="relative overflow-hidden rounded-lg border border-border bg-card p-6"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-30 blur-3xl [background:radial-gradient(circle,var(--color-chart-1),transparent_65%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="chip-mono inline-flex items-center gap-2 text-muted-foreground">
                <span className="live-dot" /> live discovery
              </span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Recent subdomains
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Everything Chaos surfaced across all tracked programs — trends, cadence, program
                share, high-value hosts and every single new host, with no cap.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
              {(Object.keys(UPDATE_RANGES) as UpdateRangeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    range === key
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {range === key ? (
                    <motion.span
                      layoutId="recentsubs-range"
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : null}
                  <span className="relative">{UPDATE_RANGES[key].label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            index={0}
            icon={Sparkles}
            label="new in range"
            value={total}
            delta={delta}
            hint={
              a?.overview.latestAt
                ? `latest ${timeAgo(overview.data.latestAt)}`
                : "waiting for data"
            }
            tone="var(--color-chart-1)"
          />
          <Kpi
            index={1}
            icon={Gauge}
            label="discovery rate"
            value={Math.round(a?.overview.perHour ?? 0)}
            suffix="/h"
            hint="average hosts found per hour"
            tone="var(--color-chart-2)"
          />
          <Kpi
            index={2}
            icon={Layers}
            label="programs hit"
            value={a?.overview.programsActive ?? 0}
            hint={`${(a?.overview.domainsActive ?? 0).toLocaleString()} root domains affected`}
            tone="var(--color-chart-3)"
          />
          <Kpi
            index={3}
            icon={TrendingUp}
            label="last hour"
            value={a?.windows.hour ?? 0}
            hint={`${(a?.windows.day ?? 0).toLocaleString()} in 24h · ${(a?.windows.week ?? 0).toLocaleString()} in 7d`}
            tone="var(--color-chart-4)"
          />
        </div>

        {/* scan reliability strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: EASE_SIGNATURE }}
          className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4"
        >
          {[
            { label: "scans run", value: reliability.scans.toLocaleString() },
            { label: "errors", value: reliability.errors.toLocaleString() },
            { label: "success rate", value: `${reliability.rate}%` },
            { label: "hosts found", value: reliability.found.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="bg-card px-4 py-3">
              <div className="chip-mono text-muted-foreground">{s.label}</div>
              <div className="mt-1 font-mono text-lg font-semibold">{s.value}</div>
            </div>
          ))}
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel
              title="Discovery trend"
              subtitle={RANGES[chartRange].label}
              action={<Radar className="size-4 text-muted-foreground" />}
            >
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <DiscoveryAreaChart data={seriesData} />
              )}
            </Panel>
          </div>
          <Panel title="Program share" subtitle="new subdomains by program">
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : donutData.length ? (
              <ShareDonut data={donutData} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No new subdomains in this range yet.
              </p>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Cumulative growth" subtitle={`running total · ${RANGES[chartRange].label}`}>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <CumulativeLineChart data={seriesData} />
            )}
          </Panel>
          <Panel title="Discovery cadence" subtitle="when new hosts land · last 7 days+">
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <DiscoveryHeatmap cells={a?.heatmap ?? []} />
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Top root domains" subtitle={`most new hosts · ${RANGES[chartRange].label}`}>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : topData.length ? (
              <HorizontalBars data={topData} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Nothing new yet.</p>
            )}
          </Panel>
          <Panel
            title="Common name prefixes"
            subtitle="most frequent first labels — click to filter the feed"
          >
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : labelData.length ? (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {labelData.slice(0, 10).map((l) => (
                    <button
                      key={l.label}
                      onClick={() => setPrefix(prefix === l.label ? null : l.label)}
                      className={`chip-mono rounded-full border px-2 py-0.5 transition ${
                        prefix === l.label
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {l.label} · {l.value.toLocaleString()}
                    </button>
                  ))}
                </div>
                <HorizontalBars data={labelData} />
              </>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Nothing new yet.</p>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="High-value hosts"
            subtitle={`${interestingCount.toLocaleString()} of the loaded hosts match recon-worthy patterns`}
            action={
              <GhostButton
                onClick={() =>
                  copyList(
                    rows.filter((r) => isInteresting(r.host)).map((r) => r.host),
                    "hosts",
                  )
                }
              >
                <Copy className="size-3.5" /> Copy
              </GhostButton>
            }
          >
            <div className="max-h-[300px] overflow-auto rounded-md border border-border">
              {rows.filter((r) => isInteresting(r.host)).slice(0, 200).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ShieldAlert className="size-3.5 shrink-0 text-[color:var(--color-chart-4)]" />
                    <span className="truncate font-mono text-xs">{r.host}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(r.first_seen_at)}
                  </span>
                </div>
              ))}
              {interestingCount === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No high-value matches yet.
                </p>
              ) : null}
            </div>
          </Panel>
          <Panel title="Live scan activity" subtitle="domains being scanned right now">
            <LiveScanActivity />
          </Panel>
        </div>

        <Panel
          title="Every new subdomain"
          subtitle={`${displayRows.length.toLocaleString()} loaded of ${total.toLocaleString()} · ${UPDATE_RANGES[range].label}`}
          action={
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={() => setGrouped((g) => !g)}>
                <Layers className="size-3.5" /> {grouped ? "Newest first" : "Group by domain"}
              </GhostButton>
              <GhostButton onClick={() => setOnlyInteresting((v) => !v)}>
                <Flame className="size-3.5" /> {onlyInteresting ? "All hosts" : "High-value only"}
              </GhostButton>
              <GhostButton onClick={() => void copyEverything()}>
                {copying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Copy className="size-3.5" />
                )}{" "}
                Copy all ({total.toLocaleString()})
              </GhostButton>
              <a
                href={exportUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                <Download className="size-3.5" /> Export all
              </a>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter loaded hosts…"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 font-mono text-xs outline-none transition focus:border-primary"
              />
            </div>
            {prefix ? (
              <button
                onClick={() => setPrefix(null)}
                className="chip-mono rounded-full border border-primary bg-primary px-2 py-1 text-primary-foreground"
              >
                prefix: {prefix} ✕
              </button>
            ) : null}
            <GhostButton onClick={() => copyList(displayRows.map((r) => r.host), "loaded hosts")}>
              <Copy className="size-3.5" /> Copy filtered
            </GhostButton>
            <GhostButton
              onClick={() =>
                displayRows.length
                  ? download(
                      `new-subdomains-${range}.txt`,
                      displayRows.map((r) => r.host).join("\n"),
                    )
                  : toast.error("Nothing to export yet")
              }
            >
              <Download className="size-3.5" /> Export filtered
            </GhostButton>
          </div>

          {feed.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : displayRows.length ? (
            <div className="max-h-[620px] overflow-auto rounded-md border border-border">
              <AnimatePresence initial={false}>
                {displayRows.map((row, i) => (
                  <motion.div
                    key={row.id}
                    layout={i < 40}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(i, 12) * 0.012,
                      ease: EASE_SIGNATURE,
                    }}
                    className="group flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/60"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {isInteresting(row.host) ? (
                        <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--color-chart-4)]" />
                      ) : (
                        <span className="size-1.5 shrink-0 rounded-full bg-border" />
                      )}
                      <span className="truncate font-mono text-xs">{row.host}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(row.host);
                          toast.success("Host copied");
                        }}
                        className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                        aria-label={`Copy ${row.host}`}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <Link
                        to="/domain/$domain"
                        params={{ domain: row.domain ?? "" }}
                        className="chip-mono text-muted-foreground hover:text-foreground"
                      >
                        {row.domain}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(row.first_seen_at)}
                      </span>
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={sentinel} className="h-8" />
              {feed.isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> loading more hosts…
                </div>
              ) : feed.hasNextPage ? (
                <div className="flex justify-center py-3">
                  <GhostButton onClick={() => void feed.fetchNextPage()}>Load more</GhostButton>
                </div>
              ) : (
                <p className="py-3 text-center text-[11px] text-muted-foreground">
                  end of feed — {rows.length.toLocaleString()} hosts loaded
                </p>
              )}
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Activity className="size-4" /> No new subdomains in this window.
            </p>
          )}
        </Panel>
      </div>
    </SiteShell>
  );
}

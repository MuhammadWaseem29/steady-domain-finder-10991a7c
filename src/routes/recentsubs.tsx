import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  Copy,
  Download,
  Gauge,
  Layers,
  Radar,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { SiteShell } from "@/components/site/chrome";
import { LiveScanActivity } from "@/components/site/live-scans";
import { CountUp, EASE_SIGNATURE, Skeleton, Spotlight } from "@/components/site/motion";
import { DiscoveryAreaChart, HorizontalBars, ShareDonut } from "@/components/site/charts";
import {
  UPDATE_RANGES,
  type UpdateRangeKey,
  type RangeKey,
  discoveryTimeseriesQuery,
  platformUpdatesQuery,
  recentNewSubsQuery,
  recentSubsOverviewQuery,
  topDomainsQuery,
  windowCountsQuery,
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
          "Real-time analytics for newly discovered subdomains: discovery trends, program share, top root domains and a live feed with copy and export.",
      },
      { property: "og:title", content: "Recent subdomains — live discovery analytics" },
      {
        property: "og:description",
        content:
          "Charts, KPIs and a live feed of every subdomain discovered in the last hour, day, week or month.",
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
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  tone: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: EASE_SIGNATURE }}
    >
      <Spotlight className="hover-lift h-full rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-md"
            style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}
          >
            <Icon className="size-4" />
          </span>
          <span className="chip-mono text-muted-foreground">{label}</span>
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

function RecentSubsPage() {
  const [range, setRange] = useState<UpdateRangeKey>("24h");
  const hours = UPDATE_RANGES[range].hours;

  const overview = useQuery(recentSubsOverviewQuery(hours));
  const windows = useQuery(windowCountsQuery);
  const chartRange = CHART_RANGE[range];
  const series = useQuery(discoveryTimeseriesQuery(chartRange));
  const platforms = useQuery(platformUpdatesQuery(range));
  const topDomains = useQuery(topDomainsQuery(chartRange, 12));
  const feed = useQuery(recentNewSubsQuery(range, 300));

  const seriesData = useMemo(
    () =>
      (series.data ?? []).map((p) => ({
        label: formatTick(p.ts, RANGES[chartRange].bucket),
        value: Number(p.new_subdomains),
      })),
    [series.data, chartRange],
  );

  const donutData = useMemo(
    () =>
      (platforms.data ?? [])
        .filter((p) => Number(p.new_count) > 0)
        .slice(0, 6)
        .map((p) => ({
          label: p.name,
          value: Number(p.new_count),
          ...(p.color ? { color: p.color } : {}),
        })),
    [platforms.data],
  );

  const topData = useMemo(
    () =>
      (topDomains.data ?? []).map((d) => ({ label: d.domain, value: Number(d.new_count) })),
    [topDomains.data],
  );

  const hosts = (feed.data ?? []).map((r) => r.host);

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
                Everything Chaos surfaced across all tracked programs — trends, program share, top
                root domains and the raw hosts, refreshed continuously.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
              {(Object.keys(UPDATE_RANGES) as UpdateRangeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    range === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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
            value={overview.data?.totalNew ?? 0}
            hint={
              overview.data?.latestAt ? `latest ${timeAgo(overview.data.latestAt)}` : "waiting for data"
            }
            tone="var(--color-chart-1)"
          />
          <Kpi
            index={1}
            icon={Gauge}
            label="discovery rate"
            value={Math.round(overview.data?.perHour ?? 0)}
            suffix="/h"
            hint="average hosts found per hour"
            tone="var(--color-chart-2)"
          />
          <Kpi
            index={2}
            icon={Layers}
            label="programs hit"
            value={overview.data?.programsActive ?? 0}
            hint={`${(overview.data?.domainsActive ?? 0).toLocaleString()} root domains affected`}
            tone="var(--color-chart-3)"
          />
          <Kpi
            index={3}
            icon={TrendingUp}
            label="last hour"
            value={windows.data?.hour ?? 0}
            hint={`${(windows.data?.day ?? 0).toLocaleString()} in 24h · ${(windows.data?.week ?? 0).toLocaleString()} in 7d`}
            tone="var(--color-chart-4)"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel
              title="Discovery trend"
              subtitle={RANGES[chartRange].label}
              action={<Radar className="size-4 text-muted-foreground" />}
            >
              {series.isLoading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <DiscoveryAreaChart data={seriesData} />
              )}
            </Panel>
          </div>
          <Panel title="Program share" subtitle="new subdomains by program">
            {platforms.isLoading ? (
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
          <Panel title="Top root domains" subtitle={`most new hosts · ${RANGES[chartRange].label}`}>
            {topDomains.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : topData.length ? (
              <HorizontalBars data={topData} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Nothing new yet.</p>
            )}
          </Panel>
          <Panel title="Live scan activity" subtitle="domains being scanned right now">
            <LiveScanActivity />
          </Panel>
        </div>

        <Panel
          title="Every new subdomain"
          subtitle={`${hosts.length.toLocaleString()} hosts · ${UPDATE_RANGES[range].label}`}
          action={
            <div className="flex gap-2">
              <button
                onClick={() => copyList(hosts, "hosts")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                <Copy className="size-3.5" /> Copy all
              </button>
              <button
                onClick={() =>
                  hosts.length
                    ? download(`new-subdomains-${range}.txt`, hosts.join("\n"))
                    : toast.error("Nothing to export yet")
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                <Download className="size-3.5" /> Export
              </button>
            </div>
          }
        >
          {feed.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : hosts.length ? (
            <div className="max-h-[520px] overflow-auto rounded-md border border-border">
              <AnimatePresence initial={false}>
                {(feed.data ?? []).map((row, i) => (
                  <motion.div
                    key={row.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i, 12) * 0.015, ease: EASE_SIGNATURE }}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/60"
                  >
                    <span className="truncate font-mono text-xs">{row.host}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Link
                        to="/domain/$domain"
                        params={{ domain: row.domains?.domain ?? "" }}
                        className="chip-mono text-muted-foreground hover:text-foreground"
                      >
                        {row.domains?.domain}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(row.first_seen_at)}
                      </span>
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
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

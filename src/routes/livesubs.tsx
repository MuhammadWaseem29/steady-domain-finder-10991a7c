import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Gauge,
  Globe,
  Layers,
  Loader2,
  Radio,
  Search,
  ShieldAlert,
  Signal,
  TrendingUp,
} from "lucide-react";

import { SiteShell } from "@/components/site/chrome";
import { CountUp, EASE_SIGNATURE, Skeleton, Spotlight } from "@/components/site/motion";
import {
  CumulativeLineChart,
  DiscoveryAreaChart,
  HorizontalBars,
  ShareDonut,
} from "@/components/site/charts";
import {
  recentLiveAnalytics,
  recentLivePage,
  type RecentLiveRow,
} from "@/lib/probe.functions";
import {
  UPDATE_RANGES,
  type UpdateRangeKey,
  download,
  formatTick,
  timeAgo,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/livesubs")({
  head: () => ({
    meta: [
      { title: "Recent live subdomains — newly answering hosts" },
      {
        name: "description",
        content:
          "Subdomains that recently started answering: live discovery trends, status-code breakdown, platform share and a real-time feed of every host that just came online, with copy and export.",
      },
      { property: "og:title", content: "Recent live subdomains — newly answering hosts" },
      {
        property: "og:description",
        content:
          "Charts, KPIs and every subdomain confirmed live in the last hour, day, week or month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSubsPage,
});

function statusTone(code: number | null): string {
  if (!code) return "var(--color-muted-foreground)";
  if (code >= 200 && code < 300) return "var(--color-chart-2)";
  if (code >= 300 && code < 400) return "var(--color-chart-1)";
  if (code === 401 || code === 403) return "var(--color-chart-4)";
  if (code >= 500) return "var(--color-destructive)";
  return "var(--color-muted-foreground)";
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
  icon: typeof Signal;
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

function LiveSubsPage() {
  const [range, setRange] = useState<UpdateRangeKey>("24h");
  const hours = UPDATE_RANGES[range].hours;
  const bucket = hours <= 24 ? "hour" : "day";

  const analytics = useQuery({
    queryKey: ["livesubs-analytics", hours],
    queryFn: () => recentLiveAnalytics({ data: { hours, bucket } }),
    refetchInterval: 30_000,
  });
  const a = analytics.data;
  const loading = analytics.isLoading;

  const feed = useInfiniteQuery({
    queryKey: ["livesubs-feed", hours],
    queryFn: ({ pageParam }) =>
      recentLivePage({ data: { hours, limit: 200, offset: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    refetchInterval: 15_000,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const rows: RecentLiveRow[] = useMemo(
    () => (feed.data?.pages ?? []).flatMap((p) => p.rows),
    [feed.data],
  );
  const feedTotal = feed.data?.pages[0]?.total ?? 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        q &&
        !r.host.toLowerCase().includes(q) &&
        !(r.title ?? "").toLowerCase().includes(q) &&
        !(r.domain ?? "").toLowerCase().includes(q)
      )
        return false;
      if (statusFilter) {
        const c = r.status_code ?? 0;
        const group =
          c >= 200 && c < 300
            ? "2xx"
            : c >= 300 && c < 400
              ? "3xx"
              : c === 401 || c === 403
                ? "401/403"
                : c >= 400 && c < 500
                  ? "4xx"
                  : c >= 500
                    ? "5xx"
                    : "other";
        if (group !== statusFilter) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const seriesData = useMemo(
    () => (a?.series ?? []).map((p) => ({ label: formatTick(p.ts, bucket), value: p.count })),
    [a?.series, bucket],
  );

  const takeoverCount = useMemo(() => rows.filter((r) => r.takeover_risk).length, [rows]);

  const delta =
    a && a.previous > 0 ? Math.round(((a.current - a.previous) / a.previous) * 100) : null;

  const exportUrl = `/raw/mainlive.txt/new?hours=${hours}`;

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
      toast.success(`Copied ${lines.length.toLocaleString()} live hosts`);
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
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-30 blur-3xl [background:radial-gradient(circle,var(--color-chart-2),transparent_65%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="chip-mono inline-flex items-center gap-2 text-muted-foreground">
                <span className="live-dot" /> live probing
              </span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Recent live subdomains
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Subdomains that recently started answering — confirmed by real HTTP requests with
                status codes, page titles, hosting owner and takeover signals.
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
                      layoutId="livesubs-range"
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
            icon={Signal}
            label="live in range"
            value={a?.current ?? 0}
            delta={delta}
            hint={a?.latestAt ? `latest ${timeAgo(a.latestAt)}` : "waiting for probes"}
            tone="var(--color-chart-2)"
          />
          <Kpi
            index={1}
            icon={Gauge}
            label="going-live rate"
            value={Math.round(a?.perHour ?? 0)}
            suffix="/h"
            hint="hosts confirmed live per hour"
            tone="var(--color-chart-1)"
          />
          <Kpi
            index={2}
            icon={Globe}
            label="total live ever"
            value={a?.total ?? 0}
            hint="every host that has ever answered"
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

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel
              title="Going-live trend"
              subtitle={UPDATE_RANGES[range].label}
              action={<Radio className="size-4 text-muted-foreground" />}
            >
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : seriesData.length ? (
                <DiscoveryAreaChart data={seriesData} />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No live hosts confirmed in this range yet.
                </p>
              )}
            </Panel>
          </div>
          <Panel title="Status codes" subtitle="response mix of live hosts">
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (a?.status.length ?? 0) ? (
              <ShareDonut data={a?.status ?? []} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No data yet.</p>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Cumulative live hosts" subtitle={`running total · ${UPDATE_RANGES[range].label}`}>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <CumulativeLineChart data={seriesData} />
            )}
          </Panel>
          <div className="space-y-4">
            <Panel title="Platform share" subtitle="live hosts by platform">
              {loading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : (a?.platforms.length ?? 0) ? (
                <HorizontalBars
                  data={(a?.platforms ?? []).map((p) => ({ label: p.label, value: p.value }))}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
              )}
            </Panel>
            <Panel title="Top root domains" subtitle="most live hosts in range">
              {loading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : (a?.topDomains.length ?? 0) ? (
                <HorizontalBars data={a?.topDomains ?? []} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
              )}
            </Panel>
          </div>
        </div>

        <Panel
          title="Every host that went live"
          subtitle={`${filtered.length.toLocaleString()} shown of ${feedTotal.toLocaleString()} · ${UPDATE_RANGES[range].label}${takeoverCount ? ` · ${takeoverCount} takeover risk` : ""}`}
          action={
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={() => void copyEverything()}>
                {copying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Copy className="size-3.5" />
                )}{" "}
                Copy all
              </GhostButton>
              <a
                href={exportUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                <Download className="size-3.5" /> TXT
              </a>
              <a
                href={`${exportUrl}&format=csv`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                <Download className="size-3.5" /> CSV
              </a>
              <a
                href={`${exportUrl}&format=json`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                <Download className="size-3.5" /> JSON
              </a>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by host, title or domain…"
                aria-label="Filter live hosts"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 font-mono text-xs outline-none transition focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["2xx", "3xx", "401/403", "5xx"].map((g) => (
                <button
                  key={g}
                  onClick={() => setStatusFilter(statusFilter === g ? null : g)}
                  className={`chip-mono rounded-full border px-2 py-0.5 transition ${
                    statusFilter === g
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <GhostButton
              onClick={() =>
                filtered.length
                  ? (navigator.clipboard.writeText(filtered.map((r) => r.host).join("\n")),
                    toast.success(`Copied ${filtered.length.toLocaleString()} hosts`))
                  : toast.error("Nothing to copy yet")
              }
            >
              <Copy className="size-3.5" /> Copy filtered
            </GhostButton>
            <GhostButton
              onClick={() =>
                filtered.length
                  ? download(
                      `live-subdomains-${range}.txt`,
                      filtered.map((r) => r.host).join("\n"),
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
          ) : filtered.length ? (
            <div className="max-h-[620px] overflow-auto rounded-md border border-border">
              {filtered.map((row, i) => (
                <motion.div
                  key={`${row.host}-${row.probed_at}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: Math.min(i, 12) * 0.012,
                    ease: EASE_SIGNATURE,
                  }}
                  className="group flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="chip-mono shrink-0 rounded border border-border px-1.5 py-0.5"
                      style={{ color: statusTone(row.status_code) }}
                    >
                      {row.status_code ?? "—"}
                    </span>
                    {row.takeover_risk ? (
                      <ShieldAlert className="size-3.5 shrink-0 text-[color:var(--color-destructive)]" />
                    ) : null}
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-mono text-xs hover:underline"
                    >
                      {row.host}
                    </a>
                    {row.title ? (
                      <span className="hidden truncate text-[11px] text-muted-foreground md:inline">
                        {row.title}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {row.platform_name ? (
                      <span
                        className="chip-mono hidden rounded-full border border-border px-2 py-0.5 sm:inline"
                        style={row.platform_color ? { color: row.platform_color } : undefined}
                      >
                        {row.platform_name}
                      </span>
                    ) : null}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(row.host);
                        toast.success("Host copied");
                      }}
                      className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                      aria-label={`Copy ${row.host}`}
                    >
                      <Copy className="size-3.5" />
                    </button>
                    {row.domain ? (
                      <Link
                        to="/domain/$domain"
                        params={{ domain: row.domain }}
                        className="chip-mono text-muted-foreground hover:text-foreground"
                      >
                        {row.domain}
                      </Link>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(row.probed_at)}
                    </span>
                  </span>
                </motion.div>
              ))}
              {feed.isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> loading more…
                </div>
              ) : feed.hasNextPage ? (
                <div className="flex justify-center py-3">
                  <GhostButton onClick={() => void feed.fetchNextPage()}>
                    <Layers className="size-3.5" /> Load more
                  </GhostButton>
                </div>
              ) : (
                <p className="py-3 text-center text-[11px] text-muted-foreground">
                  end of feed — {rows.length.toLocaleString()} hosts loaded
                </p>
              )}
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Activity className="size-4" /> No live hosts in this window yet — probes are running
              continuously.
            </p>
          )}
        </Panel>
      </div>
    </SiteShell>
  );
}

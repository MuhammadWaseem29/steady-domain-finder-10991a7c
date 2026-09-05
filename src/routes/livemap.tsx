import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { SiteShell, Stat } from "@/components/site/chrome";
import { CountUp, EASE_SIGNATURE, Skeleton } from "@/components/site/motion";
import { HorizontalBars, ShareDonut } from "@/components/site/charts";
import { IpWorldMap } from "@/components/site/ip-map";
import { liveDashboardStats, liveIpMap } from "@/lib/livemap.functions";
import { platformsQuery } from "@/lib/chaos-data";

export const Route = createFileRoute("/livemap")({
  head: () => ({
    meta: [
      { title: "Live host map — programs, takeovers and status codes" },
      {
        name: "description",
        content:
          "Live dashboard of responding subdomains grouped by program, takeover risk and HTTP status code, plotted on a world map of their IP addresses.",
      },
      { property: "og:title", content: "Live host map — programs, takeovers and status codes" },
      {
        property: "og:description",
        content: "Where every live subdomain lives: programs, takeover flags, status codes and IP geography.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveMapPage,
});

const CODE_COLORS: Record<string, string> = {
  "2xx": "#34d399",
  "3xx": "#60a5fa",
  "401/403": "#fbbf24",
  "4xx": "#f97316",
  "5xx": "#f87171",
};

function group(code: number) {
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code === 401 || code === 403) return "401/403";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500) return "5xx";
  return "other";
}

function LiveMapPage() {
  const [platform, setPlatform] = useState("");

  const platforms = useQuery(platformsQuery);

  const args = platform ? { platformSlug: platform } : {};

  const stats = useQuery({
    queryKey: ["live-dashboard", platform],
    queryFn: () => liveDashboardStats({ data: args }),
    refetchInterval: 60_000,
  });

  const map = useQuery({
    queryKey: ["live-ip-map", platform],
    queryFn: () => liveIpMap({ data: { ...args, limit: 200 } }),
    refetchInterval: 120_000,
  });

  const codeGroups = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of stats.data?.codes ?? []) m.set(group(c.code), (m.get(group(c.code)) ?? 0) + c.count);
    return [...m.entries()].map(([label, value]) => ({
      label,
      value,
      color: CODE_COLORS[label] ?? "#a1a1aa",
    }));
  }, [stats.data]);

  const topCodes = useMemo(
    () => (stats.data?.codes ?? []).slice(0, 10).map((c) => ({ label: String(c.code), value: c.count })),
    [stats.data],
  );

  const programs = stats.data?.programs ?? [];

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_SIGNATURE }}
          className="mb-8"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">live infrastructure</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Live host map</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every subdomain that answers, grouped by program, flagged for takeover risk, split by status code
            and plotted where its IP address actually sits.
          </p>
        </motion.header>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="font-mono text-xs text-muted-foreground" htmlFor="platform-filter">
            Platform
          </label>
          <select
            id="platform-filter"
            aria-label="Filter by platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 font-mono text-xs"
          >
            <option value="">All platforms</option>
            {(platforms.data ?? []).map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <Link to="/live" search={{ job: undefined }} className="story-link font-mono text-xs text-muted-foreground hover:text-foreground">
            open live hosts
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Live hosts" value={<CountUp value={stats.data?.totals.liveHosts ?? 0} />} />
          <Stat label="Programs live" value={<CountUp value={stats.data?.totals.programs ?? 0} />} />
          <Stat label="Takeover risk" value={<CountUp value={stats.data?.totals.takeover ?? 0} />} />
          <Stat label="Located IPs" value={<CountUp value={map.data?.mapped ?? 0} />} />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            IP geography
          </h2>
          {map.isLoading ? (
            <Skeleton className="h-[420px] w-full rounded-lg" />
          ) : (
            <IpWorldMap points={map.data?.points ?? []} />
          )}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Status code mix
            </h2>
            {stats.isLoading ? <Skeleton className="h-56 w-full" /> : <ShareDonut data={codeGroups} />}
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Top status codes
            </h2>
            {stats.isLoading ? <Skeleton className="h-56 w-full" /> : <HorizontalBars data={topCodes} />}
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Live hosts by program
            </h2>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card font-mono text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Program</th>
                    <th className="px-4 py-2">Platform</th>
                    <th className="px-4 py-2 text-right">Live</th>
                    <th className="px-4 py-2 text-right">2xx</th>
                    <th className="px-4 py-2 text-right">401/403</th>
                    <th className="px-4 py-2 text-right">Takeover</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2" colSpan={6}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    : programs.map((p) => (
                        <tr key={p.domain} className="border-t border-border/60 hover:bg-muted/40">
                          <td className="px-4 py-2 font-mono text-xs">
                            <Link to="/domain/$domain" params={{ domain: p.domain }} className="hover:text-primary">
                              {p.domain}
                            </Link>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs" style={{ color: p.platform_color ?? undefined }}>
                            {p.platform_name ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-primary">{p.live_hosts}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{p.ok_count}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{p.auth_count}</td>
                          <td
                            className={`px-4 py-2 text-right font-mono text-xs ${
                              Number(p.takeover_count) > 0 ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {p.takeover_count}
                          </td>
                        </tr>
                      ))}
                  {!stats.isLoading && !programs.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                        No live hosts yet for this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Top countries
            </h2>
            {map.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (map.data?.countries.length ?? 0) ? (
              <HorizontalBars data={map.data!.countries} />
            ) : (
              <p className="text-sm text-muted-foreground">No IP locations resolved yet.</p>
            )}
          </section>
        </div>
      </div>
    </SiteShell>
  );
}

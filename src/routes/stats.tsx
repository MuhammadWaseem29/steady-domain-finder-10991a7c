import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteShell, Stat } from "@/components/site/chrome";
import { DiscoveryAreaChart, ScanBarChart, HorizontalBars } from "@/components/site/charts";
import {
  RANGES,
  discoveryTimeseriesQuery,
  scanTimeseriesQuery,
  topDomainsQuery,
  globalStatsQuery,
  windowCountsQuery,
  formatTick,
  type RangeKey,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Recon statistics — Chaos subdomain monitor" },
      {
        name: "description",
        content:
          "Hourly, daily, weekly, monthly and 6-month statistics for subdomain discovery and scan health across every tracked root domain.",
      },
      { property: "og:title", content: "Recon statistics — Chaos subdomain monitor" },
      {
        property: "og:description",
        content: "Discovery trends, scan throughput and the most active domains over time.",
      },
    ],
  }),
  component: Stats,
});

function Stats() {
  const [range, setRange] = useState<RangeKey>("7d");
  const { data: stats } = useQuery(globalStatsQuery);
  const { data: counts } = useQuery(windowCountsQuery);
  const { data: discovery } = useQuery(discoveryTimeseriesQuery(range));
  const { data: scans } = useQuery(scanTimeseriesQuery(range));
  const { data: top } = useQuery(topDomainsQuery(range, 12));

  const bucket = RANGES[range].bucket;
  const discoveryData = (discovery ?? []).map((p) => ({
    label: formatTick(p.ts, bucket),
    value: Number(p.new_subdomains),
  }));
  const scanData = (scans ?? []).map((p) => ({
    label: formatTick(p.ts, bucket),
    scans: Number(p.scans),
    errors: Number(p.errors),
  }));
  const topData = (top ?? []).map((d) => ({ label: d.domain, value: Number(d.new_count) }));

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-muted-foreground">Statistics</p>
        <h1 className="mt-2 text-4xl font-extrabold">Program record</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Full history of every scan and every host discovered — by hour, day, week, month and half
          year.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Root domains" value={(stats?.domains ?? 0).toLocaleString()} index={0} />
          <Stat label="Domains scanned" value={(stats?.scanned ?? 0).toLocaleString()} index={1} />
          <Stat
            label="Subdomains stored"
            value={(stats?.subdomains ?? 0).toLocaleString()}
            index={2}
          />
          <Stat label="New (24h)" value={(stats?.newLast24h ?? 0).toLocaleString()} index={3} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="New last hour" value={(counts?.hour ?? 0).toLocaleString()} />
          <Stat label="New last day" value={(counts?.day ?? 0).toLocaleString()} />
          <Stat label="New last week" value={(counts?.week ?? 0).toLocaleString()} />
          <Stat label="New last month" value={(counts?.month ?? 0).toLocaleString()} />
          <Stat label="New last 6 months" value={(counts?.halfYear ?? 0).toLocaleString()} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`label-mono rounded-full border px-3 py-1.5 transition-colors ${
                range === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="label-mono text-muted-foreground">Subdomains discovered</p>
            <div className="mt-4">
              <DiscoveryAreaChart data={discoveryData} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="label-mono text-muted-foreground">Scans run vs errors</p>
            <div className="mt-4">
              <ScanBarChart data={scanData} />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <p className="label-mono text-muted-foreground">
            Most active domains · {RANGES[range].label}
          </p>
          <div className="mt-4">
            {topData.length > 0 ? (
              <HorizontalBars data={topData} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No discoveries in this window yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

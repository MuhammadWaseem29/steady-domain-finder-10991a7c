import { LiveTime } from "@/components/site/live-time";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { SiteShell, Stat } from "@/components/site/chrome";
import { springSnappy } from "@/components/site/motion";
import { DiscoveryAreaChart } from "@/components/site/charts";
import {
  RANGES,
  discoveryTimeseriesQuery,
  newSubdomainsQuery,
  windowCountsQuery,
  timeAgo,
  download,
  formatTick,
  type RangeKey,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "Newly discovered subdomains — Chaos monitor" },
      {
        name: "description",
        content:
          "Live feed of subdomains discovered in the last hour, day, week or month across every tracked root domain, with copy and export.",
      },
      { property: "og:title", content: "Newly discovered subdomains — Chaos monitor" },
      {
        property: "og:description",
        content: "Every freshly discovered host, diffed on each hourly rescan.",
      },
    ],
  }),
  component: NewSubs,
});

function NewSubs() {
  const [range, setRange] = useState<RangeKey>("24h");
  const { data: counts } = useQuery(windowCountsQuery);
  const { data: series } = useQuery(discoveryTimeseriesQuery(range));
  const { data: subs } = useQuery(newSubdomainsQuery(range, 1000));

  const list = subs ?? [];
  const chart = (series ?? []).map((p) => ({
    label: formatTick(p.ts, RANGES[range].bucket),
    value: Number(p.new_subdomains),
  }));

  const copy = async () => {
    await navigator.clipboard.writeText(list.map((s) => s.host).join("\n"));
    toast.success(`Copied ${list.length} hosts`);
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-muted-foreground">Live discovery</p>
        <h1 className="mt-2 text-4xl font-extrabold">New subdomains</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every host that appeared for the first time on a scan. The rolling cycle rescans all
          enabled root domains once an hour, so this feed never goes stale.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Last hour" value={counts?.hour ?? 0} index={0} />
          <Stat label="Last 24h" value={counts?.day ?? 0} index={1} />
          <Stat label="Last 7 days" value={counts?.week ?? 0} index={2} />
          <Stat label="Last 30 days" value={counts?.month ?? 0} index={3} />
          <Stat label="Last 6 months" value={counts?.halfYear ?? 0} index={4} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <motion.button
              key={k}
              onClick={() => setRange(k)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              className={`label-mono relative rounded-full border px-3 py-1.5 transition-colors ${
                range === k
                  ? "border-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {range === k && (
                <motion.span
                  layoutId="new-range-pill"
                  transition={springSnappy}
                  className="absolute inset-0 -z-10 rounded-full bg-primary"
                />
              )}
              {k}
            </motion.button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={copy}
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              <Copy className="size-3" /> Copy list
            </button>
            <button
              onClick={() => {
                download(`new-subdomains-${range}.txt`, list.map((s) => s.host).join("\n"));
                toast.success("Exported");
              }}
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              <Download className="size-3" /> txt
            </button>
            <a
              href="/api/public/export?scope=new&hours=24"
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              <Download className="size-3" /> all new 24h
            </a>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 rounded-lg border border-border bg-card p-5"
        >
          <p className="label-mono text-muted-foreground">{RANGES[range].label}</p>
          <div className="mt-4">
            <DiscoveryAreaChart data={chart} />
          </div>
        </motion.div>

        <h2 className="mt-10 text-2xl font-bold">Feed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Showing the newest {list.length.toLocaleString()} hosts for this window.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
          {list.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ ...springSnappy, delay: Math.min(i, 20) * 0.015 }}
            >
              <Link
                to="/domain/$domain"
                params={{ domain: s.domains?.domain ?? "" }}
                className="row-sweep flex items-center justify-between gap-4 overflow-hidden rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent"
              >
                <span className="truncate font-mono text-sm">{s.host}</span>
                <span className="label-mono shrink-0 text-muted-foreground">
                  <LiveTime iso={s.first_seen_at} />
                </span>
              </Link>
            </motion.div>
          ))}
          </AnimatePresence>
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing new discovered in this window yet.
            </p>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

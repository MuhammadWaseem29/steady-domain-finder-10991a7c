import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, Copy, Download, Activity } from "lucide-react";

import { SiteShell, Stat } from "@/components/site/chrome";
import { LiveScanActivity } from "@/components/site/live-scans";
import { CountUp, EASE_SIGNATURE, Skeleton } from "@/components/site/motion";
import {
  UPDATE_RANGES,
  type UpdateRangeKey,
  platformUpdatesQuery,
  platformRecentSubsQuery,
  recentNewSubsQuery,
  download,
  timeAgo,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Program updates — new subdomains per program" },
      {
        name: "description",
        content:
          "Live feed of newly discovered subdomains grouped by bug bounty program, plus which root domains are being scanned right now.",
      },
      { property: "og:title", content: "Program updates — new subdomains per program" },
      {
        property: "og:description",
        content:
          "See which programs gained new subdomains in the last hour, day, week or month, and what is scanning live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpdatesPage,
});

function copyList(lines: string[], label: string) {
  if (!lines.length) {
    toast.error("Nothing to copy yet");
    return;
  }
  navigator.clipboard.writeText(lines.join("\n"));
  toast.success(`Copied ${lines.length.toLocaleString()} ${label}`);
}

function ProgramCard({
  update,
  range,
  index,
}: {
  update: {
    platform_id: string;
    slug: string;
    name: string;
    color: string | null;
    new_count: number;
    domains_affected: number;
    last_seen: string | null;
  };
  range: UpdateRangeKey;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: subs, isLoading } = useQuery({
    ...platformRecentSubsQuery(open ? update.platform_id : undefined, range, 200),
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: EASE_SIGNATURE }}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div
        className="h-1 w-full"
        style={{ background: update.color ?? "hsl(var(--muted-foreground))" }}
      />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/program/$slug"
              params={{ slug: update.slug }}
              className="text-lg font-semibold hover:underline"
            >
              {update.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(update.domains_affected).toLocaleString()} root domains affected · last find{" "}
              {timeAgo(update.last_seen)}
            </p>
          </div>
          <p className="font-mono text-2xl font-bold tabular-nums text-success">
            +<CountUp value={Number(update.new_count)} />
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
            {open ? "Hide" : "Show"} new hosts
          </button>
          <button
            disabled={!subs?.length}
            onClick={() => copyList(subs?.map((s) => s.host) ?? [], "hosts")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            <Copy className="size-3.5" /> Copy new
          </button>
          <button
            disabled={!subs?.length}
            onClick={() =>
              download(
                `${update.slug}-new-${range}.txt`,
                (subs ?? []).map((s) => s.host).join("\n"),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            <Download className="size-3.5" /> Export
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_SIGNATURE }}
              className="overflow-hidden"
            >
              <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border">
                {isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : (subs ?? []).length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No new hosts in this range.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(subs ?? []).map((s) => (
                      <li
                        key={`${s.host}-${s.first_seen_at}`}
                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-accent/40"
                      >
                        <span className="truncate font-mono">{s.host}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {timeAgo(s.first_seen_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function UpdatesPage() {
  const [range, setRange] = useState<UpdateRangeKey>("24h");
  const { data: updates, isLoading } = useQuery(platformUpdatesQuery(range));
  const { data: allNew } = useQuery(recentNewSubsQuery(range, 300));

  const totals = useMemo(() => {
    const rows = updates ?? [];
    return {
      newCount: rows.reduce((a, r) => a + Number(r.new_count), 0),
      programs: rows.length,
      domains: rows.reduce((a, r) => a + Number(r.domains_affected), 0),
    };
  }, [updates]);

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="label-mono flex items-center gap-2 text-muted-foreground">
          <Activity className="size-3.5" /> Program updates
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          What changed across your programs
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Newly discovered subdomains grouped by program, plus a live view of which root domains
          are being scanned right now.
        </p>

        <div className="mt-6">
          <LiveScanActivity />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(UPDATE_RANGES) as UpdateRangeKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setRange(key)}
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="New subdomains" value={totals.newCount} index={0} />
          <Stat label="Programs with activity" value={totals.programs} index={1} />
          <Stat label="Root domains affected" value={totals.domains} index={2} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))
            : (updates ?? []).map((u, i) => (
                <ProgramCard key={u.platform_id} update={u} range={range} index={i} />
              ))}
        </div>

        {!isLoading && (updates ?? []).length === 0 && (
          <p className="mt-6 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            No program picked up new subdomains in this range. Try a longer window.
          </p>
        )}

        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label-mono text-muted-foreground">
              All new subdomains — {UPDATE_RANGES[range].label.toLowerCase()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => copyList((allNew ?? []).map((s) => s.host), "hosts")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Copy className="size-3.5" /> Copy all
              </button>
              <button
                onClick={() =>
                  download(
                    `new-subdomains-${range}.txt`,
                    (allNew ?? []).map((s) => s.host).join("\n"),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Download className="size-3.5" /> Export
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-border">
            {(allNew ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing new in this range yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {(allNew ?? []).map((s) => (
                    <motion.li
                      key={s.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, ease: EASE_SIGNATURE }}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-accent/40"
                    >
                      <span className="truncate font-mono">{s.host}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {s.domains?.domain} · {timeAgo(s.first_seen_at)}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

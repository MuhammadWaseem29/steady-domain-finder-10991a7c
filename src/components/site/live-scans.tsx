import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { CountUp, EASE_SIGNATURE } from "@/components/site/motion";
import { runningScansQuery, scanActivityQuery } from "@/lib/chaos-data";
import { useEffect, useState } from "react";

function Elapsed({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  return (
    <span className="font-mono tabular-nums">
      {mins > 0 ? `${mins}m ` : ""}
      {secs % 60}s
    </span>
  );
}

export function LiveScanActivity() {
  const { data: running } = useQuery(runningScansQuery(60));
  const { data: activity } = useQuery(scanActivityQuery);
  const rows = running ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-mono flex items-center gap-2 text-muted-foreground">
          <Radar className="size-3.5" />
          Live scan activity
        </p>
        <span className="label-mono flex items-center gap-2 text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          updating every 5s
        </span>
      </div>

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="label-mono text-muted-foreground">Scans in flight</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            <CountUp value={activity?.running ?? 0} />
          </p>
        </div>
        <div>
          <p className="label-mono text-muted-foreground">Claimed (5m)</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            <CountUp value={activity?.claimed5m ?? 0} />
          </p>
        </div>
        <div>
          <p className="label-mono text-muted-foreground">Finished (5m)</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            <CountUp value={activity?.finished5m ?? 0} />
          </p>
        </div>
        <div>
          <p className="label-mono text-muted-foreground">New subs (5m)</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-success">
            +<CountUp value={activity?.newSubs5m ?? 0} />
            <span className="ml-2 font-sans text-xs text-muted-foreground">
              +{(activity?.newSubs1h ?? 0).toLocaleString()} in 1h
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5 max-h-72 overflow-y-auto rounded-lg border border-border">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No scans in flight — the next sweep starts within a minute.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.li
                  key={r.scan_id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25, ease: EASE_SIGNATURE }}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-success" />
                    <Link
                      to="/domain/$domain"
                      params={{ domain: r.domain }}
                      className="truncate font-mono hover:underline"
                    >
                      {r.domain}
                    </Link>
                    {r.platform_name && (
                      <span
                        className="chip-mono shrink-0"
                        style={r.platform_color ? { borderColor: r.platform_color } : undefined}
                      >
                        {r.platform_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="label-mono">{r.trigger}</span>
                    <Elapsed startedAt={r.started_at} />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

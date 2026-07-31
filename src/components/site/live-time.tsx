import { useEffect, useState } from "react";
import { clockTime, exactTime, timeAgo } from "@/lib/chaos-data";

/** Ticks once a second so relative ages stay live without refetching. */
function useTick(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

export function LiveTime({
  iso,
  mode = "clock",
  className,
}: {
  iso: string | null;
  mode?: "clock" | "full";
  className?: string;
}) {
  useTick();
  if (!iso) return <span className={className}>never</span>;
  return (
    <span className={className} title={new Date(iso).toISOString()}>
      <span className="font-mono tabular-nums">
        {mode === "full" ? exactTime(iso) : clockTime(iso)}
      </span>
      <span className="ml-2 text-muted-foreground">{timeAgo(iso)}</span>
    </span>
  );
}

export function LiveAgo({ iso, className }: { iso: string | null; className?: string }) {
  useTick();
  if (!iso) return <span className={className}>never</span>;
  return (
    <span className={className} title={exactTime(iso)}>
      {timeAgo(iso)}
    </span>
  );
}

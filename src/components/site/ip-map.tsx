import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { MapPoint } from "@/lib/livemap.functions";

// Equirectangular projection onto a 360x180 viewBox.
function project(lat: number, lon: number) {
  return { x: lon + 180, y: 90 - lat };
}

const LAND =
  "M 30 40 L 55 30 L 95 28 L 130 33 L 150 45 L 140 60 L 120 62 L 100 58 L 70 60 L 45 55 Z";

export function IpWorldMap({ points }: { points: MapPoint[] }) {
  const [active, setActive] = useState<MapPoint | null>(null);
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.hosts)), [points]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-terminal">
      <svg viewBox="0 0 360 180" className="h-[420px] w-full" role="img" aria-label="World map of live host IP addresses">
        <defs>
          <pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M 15 0 L 0 0 0 15" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-primary/15" />
          </pattern>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="180" fill="url(#grid)" />
        <path d={LAND} fill="none" stroke="none" />
        {/* latitude guides */}
        {[30, 60, 90, 120, 150].map((y) => (
          <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="currentColor" strokeWidth="0.15" className="text-muted-foreground/30" />
        ))}

        {points.map((p, i) => {
          const { x, y } = project(p.lat, p.lon);
          const r = 0.9 + (p.hosts / max) * 3.4;
          const danger = p.takeover > 0;
          return (
            <g
              key={`${p.ip}-${i}`}
              onMouseEnter={() => setActive(p)}
              onMouseLeave={() => setActive(null)}
              className={danger ? "text-destructive" : "text-primary"}
            >
              <circle cx={x} cy={y} r={r * 3} fill="url(#glow)" />
              <motion.circle
                cx={x}
                cy={y}
                r={r}
                fill="currentColor"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.004, 1.2), duration: 0.4 }}
              />
              <motion.circle
                cx={x}
                cy={y}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.3"
                animate={{ r: [r, r * 3.2], opacity: [0.6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: (i % 12) * 0.2 }}
              />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 rounded border border-border/60 bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
        {points.length} located IPs
      </div>

      {active ? (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[85%] rounded border border-border bg-background/95 px-3 py-2 font-mono text-[11px] shadow-lg backdrop-blur">
          <div className="text-foreground">{active.host}</div>
          <div className="text-muted-foreground">
            {active.ip} · {active.city ? `${active.city}, ` : ""}
            {active.country ?? "unknown"} · {active.hosts} host{active.hosts === 1 ? "" : "s"}
          </div>
          {active.org ? <div className="text-muted-foreground">{active.org}</div> : null}
          {active.takeover > 0 ? <div className="text-destructive">takeover risk</div> : null}
        </div>
      ) : null}
    </div>
  );
}

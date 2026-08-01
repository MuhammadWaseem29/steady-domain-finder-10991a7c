import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/site/theme-toggle";
import {
  CountUp,
  EASE_SIGNATURE,
  ScrollProgress,
  Spotlight,
  springSnappy,
} from "@/components/site/motion";

const NAV = [
  { to: "/programs", label: "Programs" },
  { to: "/updates", label: "Updates" },
  { to: "/recentsubs", label: "Recent subs" },
  { to: "/new", label: "New subs" },

  { to: "/stats", label: "Stats" },
  { to: "/queue", label: "Queue" },
  { to: "/dashboard", label: "Monitor" },
  { to: "/docs/fetch-subdomains", label: "Docs" },
] as const;

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link to="/" className="group flex items-center gap-2">
          <motion.span
            whileHover={{ y: -2 }}
            transition={springSnappy}
            className="text-xl font-extrabold tracking-tight"
          >
            Chaos.
          </motion.span>
          <span className="label-mono rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
            beta
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative rounded-full px-3 py-1.5 transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={springSnappy}
                    className="absolute inset-0 -z-10 rounded-full bg-accent"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <HeaderAccount />
        </div>
      </div>
      <ScrollProgress />
    </motion.header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <p className="text-base font-extrabold tracking-tight">Chaos.</p>
          <p className="text-sm text-muted-foreground">
            Continuous DNS reconnaissance, refreshed every hour.
          </p>
        </div>
        <div className="label-mono flex flex-wrap gap-5 text-muted-foreground">
          <Link to="/programs" className="story-link hover:text-foreground">
            Programs
          </Link>
          <Link to="/new" className="story-link hover:text-foreground">
            New subs
          </Link>
          <Link to="/stats" className="story-link hover:text-foreground">
            Stats
          </Link>
          <Link to="/docs/api-key" className="story-link hover:text-foreground">
            API key
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: EASE_SIGNATURE }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <SiteFooter />
    </div>
  );
}

export function Terminal({ children }: { children: ReactNode }) {
  return (
    <pre className="relative overflow-hidden rounded-lg bg-terminal p-4 font-mono text-[13px] leading-6 text-terminal-foreground">
      <span
        aria-hidden
        className="scanline pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-terminal-foreground/5 to-transparent"
      />
      {children}
    </pre>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: EASE_SIGNATURE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Stat({
  label,
  value,
  hint,
  index = 0,
}: {
  label: string;
  value: ReactNode | number;
  hint?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: EASE_SIGNATURE }}
      whileHover={{ y: -4 }}
      className="rounded-lg border border-border bg-card transition-colors hover:bg-accent/40 hover:shadow-lg hover:shadow-foreground/5"
    >
      <Spotlight className="rounded-lg p-5">
        <p className="label-mono text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </Spotlight>
    </motion.div>
  );
}

export function SectionCard({ children }: { children: ReactNode }) {
  return (
    <Reveal className="rounded-lg border border-border bg-card p-5">{children}</Reveal>
  );
}

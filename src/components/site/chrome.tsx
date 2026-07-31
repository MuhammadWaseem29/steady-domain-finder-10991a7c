import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/site/theme-toggle";

const NAV = [
  { to: "/programs", label: "Programs" },
  { to: "/new", label: "New subs" },
  { to: "/stats", label: "Stats" },
  { to: "/dashboard", label: "Monitor" },
  { to: "/docs/fetch-subdomains", label: "Docs" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight">Chaos.</span>
          <span className="label-mono rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
            beta
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/dashboard"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-extrabold tracking-tight">Chaos.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Continuous DNS reconnaissance, refreshed every hour.
          </p>
        </div>
        <div className="label-mono flex flex-wrap gap-5 text-muted-foreground">
          <Link to="/programs" className="hover:text-foreground">
            Programs
          </Link>
          <Link to="/new" className="hover:text-foreground">
            New subs
          </Link>
          <Link to="/stats" className="hover:text-foreground">
            Stats
          </Link>
          <Link to="/docs/api-key" className="hover:text-foreground">
            API key
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex-1"
      >
        {children}
      </motion.main>
      <SiteFooter />
    </div>
  );
}

export function Terminal({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-[13px] leading-6 text-foreground">
      {children}
    </pre>
  );
}

export function Stat({
  label,
  value,
  hint,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}

export function SectionCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5">{children}</div>;
}

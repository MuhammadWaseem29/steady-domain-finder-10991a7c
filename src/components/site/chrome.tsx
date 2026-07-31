import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

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
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          <Link
            to="/docs/fetch-subdomains"
            className="transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Docs
          </Link>
          <Link
            to="/dashboard"
            className="transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Monitor
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
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
        <div className="label-mono flex gap-5 text-muted-foreground">
          <Link to="/docs/fetch-subdomains" className="hover:text-foreground">
            Fetch subdomains
          </Link>
          <Link to="/docs/api-key" className="hover:text-foreground">
            API key
          </Link>
          <Link to="/dashboard" className="hover:text-foreground">
            Monitor
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
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function Terminal({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-primary p-4 font-mono text-[13px] leading-6 text-primary-foreground">
      {children}
    </pre>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

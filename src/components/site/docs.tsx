import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteShell } from "./chrome";

const nav = [
  { to: "/docs/fetch-subdomains", label: "Fetch Subdomains" },
  { to: "/docs/api-key", label: "API Key" },
  { to: "/docs/api", label: "Platform API" },
] as const;

export function DocsLayout({
  title,
  intro,
  sections,
  children,
}: {
  title: string;
  intro: string;
  sections: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[200px_minmax(0,1fr)_180px]">
        <aside className="hidden lg:block">
          <p className="label-mono text-muted-foreground">Documentation</p>
          <nav className="mt-3 flex flex-col gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <h1 className="text-4xl font-extrabold">{title}</h1>
          <p className="mt-3 text-muted-foreground">{intro}</p>
          <div className="mt-10 space-y-10">{children}</div>
        </article>

        <aside className="hidden lg:block">
          <p className="label-mono text-muted-foreground">On this page</p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </SiteShell>
  );
}

export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4 space-y-4 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function Param({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm font-semibold text-foreground">{name}</code>
        <span className="label-mono text-muted-foreground">{type}</span>
        {required && (
          <span className="label-mono rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
            required
          </span>
        )}
      </div>
      <p className="mt-2">{children}</p>
    </div>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <div className="group relative">
      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
        <CopyButton text={children} />
      </div>
      <pre className="overflow-x-auto rounded-lg bg-primary p-4 font-mono text-[13px] leading-6 text-primary-foreground">
        {children}
      </pre>
    </div>
  );
}

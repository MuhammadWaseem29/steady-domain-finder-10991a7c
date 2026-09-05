import { useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_SECTIONS, neighbours } from "@/lib/api-nav";
import { MethodBadge } from "./primitives";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [q, setQ] = useState("");

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return NAV_SECTIONS;
    return NAV_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        const path = i.kind === "endpoint" ? i.endpoint.path : i.to;
        return `${i.label} ${path}`.toLowerCase().includes(needle);
      }),
    })).filter((s) => s.items.length > 0);
  }, [q]);

  return (
    <nav aria-label="API reference" className="space-y-6">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search endpoints…"
        aria-label="Search the API reference"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {sections.map((section) => (
        <div key={section.title}>
          <p className="label-mono text-muted-foreground">{section.title}</p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    }`}
                  >
                    {item.kind === "endpoint" && (
                      <span className="shrink-0 scale-90 origin-left">
                        <MethodBadge method={item.endpoint.method} />
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {sections.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
    </nav>
  );
}

export function ReferenceShell({
  title,
  eyebrow,
  intro,
  aside,
  children,
}: {
  title: string;
  eyebrow?: string;
  intro?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { prev, next } = neighbours(pathname);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-8">
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <Sidebar />
          </div>
        </aside>

        <div className="min-w-0">
          <details className="mb-6 rounded-xl border border-border bg-card p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Browse the API reference
            </summary>
            <div className="mt-4">
              <Sidebar />
            </div>
          </details>

          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">
            <div className="min-w-0">
              {eyebrow && <p className="label-mono text-muted-foreground">{eyebrow}</p>}
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {intro && <p className="mt-3 max-w-2xl text-muted-foreground">{intro}</p>}
              <div className="mt-8">{children}</div>

              {(prev || next) && (
                <div className="mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
                  {prev ? (
                    <Link
                      to={prev.to}
                      className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
                    >
                      <span className="label-mono text-muted-foreground">Previous</span>
                      <p className="mt-1 text-sm font-medium text-foreground">{prev.label}</p>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <Link
                      to={next.to}
                      className="rounded-xl border border-border bg-card p-4 text-right transition-colors hover:border-foreground/30"
                    >
                      <span className="label-mono text-muted-foreground">Next</span>
                      <p className="mt-1 text-sm font-medium text-foreground">{next.label}</p>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {aside && (
              <div className="mt-10 xl:mt-0">
                <div className="xl:sticky xl:top-24">{aside}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

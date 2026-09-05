import type { ApiParam } from "@/lib/api-spec";

export function ParamTable({ title, params }: { title: string; params: ApiParam[] }) {
  if (!params.length) return null;
  return (
    <section className="mt-8">
      <h3 className="label-mono text-muted-foreground">{title}</h3>
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {params.map((p) => (
          <div key={`${p.in}-${p.name}`} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm font-semibold text-foreground">{p.name}</code>
              <span className="label-mono text-muted-foreground">{p.type}</span>
              {p.required ? (
                <span className="label-mono rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                  required
                </span>
              ) : (
                <span className="label-mono text-muted-foreground/70">optional</span>
              )}
              {p.default !== undefined && (
                <span className="label-mono text-muted-foreground">default {String(p.default)}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
            {p.enum && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.enum.map((v) => (
                  <code
                    key={v}
                    className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                  >
                    {v}
                  </code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

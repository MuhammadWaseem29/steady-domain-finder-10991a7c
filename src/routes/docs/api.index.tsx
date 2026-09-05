import { createFileRoute, Link } from "@tanstack/react-router";
import { API_ENDPOINTS, API_GROUPS } from "@/lib/api-spec";
import { apiBase } from "@/lib/api-nav";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { MethodBadge, Callout, CopyButton, CodeBlock } from "@/components/site/api/primitives";

export const Route = createFileRoute("/docs/api/")({
  head: () => ({
    meta: [
      { title: "Chaos Monitor API reference — endpoints, console, SDK samples" },
      {
        name: "description",
        content:
          "Token-authenticated REST API for subdomain discovery: domains, new hosts, platforms, scans, stats and streaming exports, with a runnable console on every endpoint.",
      },
      { property: "og:title", content: "Chaos Monitor API reference" },
      {
        property: "og:description",
        content: "Runnable REST reference for subdomain discovery data, scans, stats and exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiOverview,
});

function ApiOverview() {
  const base = apiBase();
  const snippet = `curl "${base}/subdomains/new?hours=24&limit=50" \\
  -H "Authorization: Bearer chs_live_xxxxxxxxxxxx"`;

  return (
    <ReferenceShell
      eyebrow="API v1"
      title="Chaos Monitor API"
      intro="Every host this monitor discovers is available over a token-authenticated REST API. Each endpoint page ships with a runnable console and copy-paste samples in five languages."
      aside={
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-terminal">
            <div className="flex items-center justify-between border-b border-terminal-muted/25 px-3 py-2">
              <span className="label-mono text-terminal-muted">First request</span>
              <CopyButton value={snippet} />
            </div>
            <CodeBlock>{snippet}</CodeBlock>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="label-mono text-muted-foreground">Base URL</p>
            <code className="mt-1.5 block break-all font-mono text-xs text-foreground">{base}</code>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/api/v1/openapi.json"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                OpenAPI 3.1
              </a>
              <Link
                to="/account"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Get a token
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Endpoints", value: String(API_ENDPOINTS.length) },
          { label: "Rate limit", value: "120 / min" },
          { label: "Auth", value: "Bearer token" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="label-mono text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Callout title="Three steps to your first response">
          Create a key on the account page, send it as{" "}
          <code className="font-mono text-foreground">Authorization: Bearer …</code>, then open any
          endpoint below and press <strong className="text-foreground">Send request</strong>.
        </Callout>
      </div>

      <h2 className="mt-12 text-lg font-semibold text-foreground">All endpoints</h2>
      <div className="mt-4 space-y-8">
        {API_GROUPS.map((group) => {
          const items = API_ENDPOINTS.filter((e) => e.group === group);
          if (!items.length) return null;
          return (
            <section key={group}>
              <h3 className="label-mono text-muted-foreground">{group}</h3>
              <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {items.map((e) => (
                  <Link
                    key={e.id}
                    to="/docs/api/reference/$endpoint"
                    params={{ endpoint: e.id }}
                    className="flex flex-wrap items-center gap-3 p-3.5 transition-colors hover:bg-accent/60"
                  >
                    <MethodBadge method={e.method} />
                    <code className="font-mono text-sm text-foreground">{e.path}</code>
                    <span className="ml-auto text-xs text-muted-foreground">{e.summary}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </ReferenceShell>
  );
}

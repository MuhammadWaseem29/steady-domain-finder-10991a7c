import { createFileRoute } from "@tanstack/react-router";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, Callout, CopyButton } from "@/components/site/api/primitives";
import { SITE_ORIGIN } from "@/lib/api-nav";

const PATTERNS: Array<{ url: string; what: string }> = [
  { url: "/raw/tesla.com", what: "every host for one root domain" },
  { url: "/raw/tesla.com/new", what: "hosts first seen in the last 24 hours" },
  { url: "/raw/bugcrowd", what: "every host across a platform" },
  { url: "/raw/bugcrowd/tesla", what: "every host for one program on that platform" },
];

const CURL = `# plain host list, no token, no sign-in
curl -s ${SITE_ORIGIN}/raw/tesla.com > tesla.txt

# only what appeared in the last hour
curl -s "${SITE_ORIGIN}/raw/tesla.com/new?hours=1"

# whole platform as CSV
curl -s "${SITE_ORIGIN}/raw/bugcrowd?format=csv" > bugcrowd.csv`;

export const Route = createFileRoute("/docs/api/raw")({
  head: () => ({
    meta: [
      { title: "Raw host lists — plain text, no authentication" },
      {
        name: "description",
        content:
          "Open subdomain lists as plain text at /raw/{domain} or /raw/{platform}/{program}. No token, no sign-in, streamed for programs with hundreds of thousands of hosts.",
      },
      { property: "og:title", content: "Raw host lists — Chaos Monitor" },
      {
        property: "og:description",
        content: "Plain-text subdomain lists per program at a public URL. No authentication.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RawPage,
});

function RawPage() {
  return (
    <ReferenceShell
      eyebrow="Reference"
      title="Raw lists"
      intro="Every program has a public plain-text URL: one host per line, no token, no sign-in. Open it in a browser or pipe it straight into your tooling."
      aside={
        <div className="overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="flex items-center border-b border-terminal-muted/25 px-3 py-2">
            <span className="label-mono text-terminal-muted">curl</span>
            <div className="ml-auto">
              <CopyButton value={CURL} />
            </div>
          </div>
          <CodeBlock>{CURL}</CodeBlock>
        </div>
      }
    >
      <section>
        <h2 className="text-base font-semibold text-foreground">URL patterns</h2>
        <ul className="mt-3 space-y-2">
          {PATTERNS.map((p) => (
            <li
              key={p.url}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <a
                href={p.url}
                className="font-mono text-xs text-foreground underline-offset-4 hover:underline"
              >
                {p.url}
              </a>
              <span className="text-xs text-muted-foreground">{p.what}</span>
              <span className="ml-auto">
                <CopyButton value={`${SITE_ORIGIN}${p.url}`} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-foreground">Options</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <code className="font-mono text-foreground">format=txt|csv|json</code> — plain hosts
            (default), CSV with first/last seen, or a JSON array.
          </li>
          <li>
            <code className="font-mono text-foreground">hours=N</code> — window for the{" "}
            <code className="font-mono text-foreground">/new</code> lists (default 24).
          </li>
          <li>
            <code className="font-mono text-foreground">scope=all|new|inactive</code> — retired
            hosts included with <code className="font-mono text-foreground">inactive</code>.
          </li>
          <li>
            <code className="font-mono text-foreground">active=false</code> — include retired hosts
            in platform-wide lists.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-foreground">Behaviour</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Responses stream, so a program with hundreds of thousands of hosts starts writing
          immediately and never times out. Unknown domains and platforms return an empty body with
          status 404. The same handler is mirrored at{" "}
          <code className="font-mono text-foreground">/api/public/raw/…</code> for callers that
          prefer the API prefix, and both allow cross-origin requests.
        </p>
      </section>

      <div className="mt-8">
        <Callout title="No key required">
          Raw lists are open and unlimited. Use the token-authenticated API when you need
          structured metadata, scans, stats or account endpoints.
        </Callout>
      </div>
    </ReferenceShell>
  );
}

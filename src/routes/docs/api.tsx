import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsLayout, DocSection, Param, Code } from "@/components/site/docs";

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "Platform API v1 — Chaos Subdomain Monitor" },
      {
        name: "description",
        content:
          "REST API reference for this Chaos monitor: bearer token auth, domains, subdomains, new discoveries, platforms, scan history, scan triggers and bulk exports.",
      },
      { property: "og:title", content: "Platform API v1 — Chaos Subdomain Monitor" },
      {
        property: "og:description",
        content: "Token-authenticated REST endpoints for domains, subdomains, scans and exports.",
      },
    ],
  }),
  component: ApiDocs,
});

const BASE = "https://steady-domain-finder.lovable.app/api/v1";

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
          {method}
        </span>
        <code className="font-mono text-sm font-semibold text-foreground">{path}</code>
      </div>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  );
}

function ApiDocs() {
  return (
    <DocsLayout
      title="Platform API"
      intro="Everything this monitor collects is available over a token-authenticated REST API — domains, subdomains, freshly discovered hosts, program stats, scan history, scan triggers and streaming bulk exports."
      sections={[
        { id: "authentication", label: "Authentication" },
        { id: "conventions", label: "Conventions" },
        { id: "domains", label: "Domains" },
        { id: "subdomains", label: "Subdomains" },
        { id: "platforms", label: "Platforms" },
        { id: "scans", label: "Scans" },
        { id: "export", label: "Export" },
        { id: "errors", label: "Errors" },
      ]}
    >
      <DocSection id="authentication" title="Authentication">
        <p>
          Create a token on your{" "}
          <Link to="/account" className="story-link text-foreground">
            account page
          </Link>
          . Tokens look like <code className="font-mono text-foreground">chs_live_…</code> and are
          shown once at creation — only a hash is stored.
        </p>
        <Param name="Authorization" type="string" required>
          <code className="font-mono text-foreground">Bearer chs_live_…</code>. An{" "}
          <code className="font-mono text-foreground">X-API-Key</code> header with the raw token
          works too.
        </Param>
        <Code>{`curl "${BASE}/domains?limit=5" \\
  -H "Authorization: Bearer chs_live_xxxxxxxxxxxx"`}</Code>
        <p>
          Base URL: <code className="font-mono text-foreground">{BASE}</code>. The mirror at{" "}
          <code className="font-mono text-foreground">/api/public/v1</code> is identical and always
          reachable from outside the app.
        </p>
      </DocSection>

      <DocSection id="conventions" title="Conventions">
        <p>
          Every response is JSON shaped as{" "}
          <code className="font-mono text-foreground">{`{ "data": …, "meta": … }`}</code>. List
          endpoints accept <code className="font-mono text-foreground">limit</code> and{" "}
          <code className="font-mono text-foreground">offset</code>; time windows accept{" "}
          <code className="font-mono text-foreground">hours</code> or an ISO{" "}
          <code className="font-mono text-foreground">since</code>.
        </p>
        <Code>{`{
  "data": [ { "domain": "lovable.app", "total_subdomains": 9948 } ],
  "meta": { "limit": 100, "offset": 0, "total": 10461 }
}`}</Code>
      </DocSection>

      <DocSection id="domains" title="Domains">
        <Endpoint method="GET" path="/domains">
          <p>
            List tracked root domains. Query: <code className="font-mono">search</code>,{" "}
            <code className="font-mono">platform</code> (slug), <code className="font-mono">limit</code>{" "}
            (max 1000), <code className="font-mono">offset</code>.
          </p>
          <Code>{`curl "${BASE}/domains?platform=hackerone&limit=50" \\
  -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>
        <Endpoint method="GET" path="/domains/{domain}">
          <p>Single domain with live counts (total, new 24h / 7d, active, inactive).</p>
          <Code>{`curl "${BASE}/domains/lovable.app" -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>
        <Endpoint method="GET" path="/domains/{domain}/subdomains">
          <p>
            Paged hosts, newest first. Query: <code className="font-mono">filter</code> (
            <code className="font-mono">all</code> | <code className="font-mono">new</code> |{" "}
            <code className="font-mono">inactive</code>), <code className="font-mono">search</code>,{" "}
            <code className="font-mono">limit</code> (max 1000), <code className="font-mono">offset</code>.
          </p>
          <Code>{`curl "${BASE}/domains/lovable.app/subdomains?filter=new&limit=200" \\
  -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="subdomains" title="Subdomains">
        <Endpoint method="GET" path="/subdomains/new">
          <p>
            Every newly discovered host across all programs. Query:{" "}
            <code className="font-mono">hours</code> (default 24) or{" "}
            <code className="font-mono">since</code>, <code className="font-mono">limit</code> (max
            2000). Page with the returned{" "}
            <code className="font-mono">meta.next_cursor</code> values.
          </p>
          <Code>{`curl "${BASE}/subdomains/new?hours=1&limit=1000" \\
  -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
          <Code>{`{
  "data": [
    { "host": "vpn-new.example.com", "domain": "example.com", "first_seen_at": "2026-08-01T12:04:11Z" }
  ],
  "meta": { "since": "2026-08-01T11:04:11Z", "limit": 1000, "next_cursor": null }
}`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="platforms" title="Platforms">
        <Endpoint method="GET" path="/platforms">
          <p>Programs with domain counts, subdomain totals and 24h discoveries.</p>
        </Endpoint>
        <Endpoint method="GET" path="/platforms/{slug}/domains">
          <p>
            Domains belonging to one program. Query: <code className="font-mono">limit</code>,{" "}
            <code className="font-mono">offset</code>.
          </p>
          <Code>{`curl "${BASE}/platforms/bugcrowd/domains?limit=500" \\
  -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="scans" title="Scans">
        <Endpoint method="GET" path="/scans">
          <p>
            Scan history, newest first. Query: <code className="font-mono">domain</code>,{" "}
            <code className="font-mono">limit</code> (max 500), <code className="font-mono">offset</code>.
          </p>
        </Endpoint>
        <Endpoint method="POST" path="/scans">
          <p>
            Queue an immediate re-scan of one domain. Returns{" "}
            <code className="font-mono">202</code> with the job status; big programs continue in the
            background.
          </p>
          <Code>{`curl -X POST "${BASE}/scans" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"lovable.app"}'`}</Code>
        </Endpoint>
        <Endpoint method="POST" path="/scans/rescan-all">
          <p>Mark every enabled domain as due, kicking off a full sweep on the next worker tick.</p>
          <Code>{`curl -X POST "${BASE}/scans/rescan-all" -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="export" title="Export">
        <Endpoint method="GET" path="/export">
          <p>
            Streaming bulk export of hosts. Query: <code className="font-mono">domain</code> or{" "}
            <code className="font-mono">platform</code>, <code className="font-mono">scope</code> (
            <code className="font-mono">all</code> | <code className="font-mono">new</code> |{" "}
            <code className="font-mono">inactive</code>), <code className="font-mono">hours</code>,{" "}
            <code className="font-mono">search</code>, <code className="font-mono">format</code> (
            <code className="font-mono">txt</code> | <code className="font-mono">csv</code> |{" "}
            <code className="font-mono">json</code>). Handles 100k+ hosts.
          </p>
          <Code>{`curl "${BASE}/export?platform=bugcrowd&scope=new&hours=24&format=txt" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" -o new-hosts.txt`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="errors" title="Errors">
        <p>Errors return the matching HTTP status and a stable machine-readable code.</p>
        <Code>{`{ "error": { "code": "invalid_token", "message": "Unknown API token." } }`}</Code>
        <p>
          <code className="font-mono text-foreground">401</code> missing_token · invalid_token ·
          revoked_token — <code className="font-mono text-foreground">404</code> not_found ·
          unknown_platform — <code className="font-mono text-foreground">400</code> invalid_body ·
          invalid_domain — <code className="font-mono text-foreground">405</code>{" "}
          method_not_allowed — <code className="font-mono text-foreground">500</code> query_failed ·
          server_error.
        </p>
      </DocSection>
    </DocsLayout>
  );
}

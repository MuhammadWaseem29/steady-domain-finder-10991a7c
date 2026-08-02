import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DocsLayout, DocSection, Param, Code } from "@/components/site/docs";
import {
  ApiConsole,
  ApiTokenBar,
  MethodBadge,
  type ConsoleField,
} from "@/components/site/api-console";

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "Platform API v1 — Chaos Subdomain Monitor" },
      {
        name: "description",
        content:
          "REST API reference with an interactive console: bearer token auth, domains, subdomains, new discoveries, platforms, scan history, scan triggers and bulk exports.",
      },
      { property: "og:title", content: "Platform API v1 — Chaos Subdomain Monitor" },
      {
        property: "og:description",
        content:
          "Token-authenticated REST endpoints with a live try-it console and copyable curl for every call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiDocs,
});

const BASE = "https://chaos.thescope.top/api/v1";

function Endpoint({
  method,
  path,
  summary,
  fields,
  body,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  summary: string;
  fields?: ConsoleField[];
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={method} />
        <code className="font-mono text-sm font-semibold text-foreground">{path}</code>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
      {children ? <div className="mt-3 space-y-3">{children}</div> : null}
      <div className="mt-4">
        <p className="label-mono mb-2 text-muted-foreground">Try it</p>
        <ApiConsole
          method={method}
          path={path}
          {...(fields ? { fields } : {})}
          {...(body !== undefined ? { body } : {})}
        />
      </div>
    </div>
  );
}

function ApiDocs() {
  return (
    <DocsLayout
      title="Platform API"
      intro="Everything this monitor collects is available over a token-authenticated REST API — domains, subdomains, freshly discovered hosts, program stats, scan history, scan triggers and streaming bulk exports. Every endpoint below can be executed right here."
      sections={[
        { id: "authentication", label: "Authentication" },
        { id: "console", label: "Try it console" },
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

      <DocSection id="console" title="Try it console">
        <p>
          Paste a token once and every endpoint below becomes executable — fill the parameters, hit{" "}
          <strong className="text-foreground">Send request</strong>, and copy the generated curl or
          the JSON response.
        </p>
        <ApiTokenBar />
        <p>
          Requests run from your browser against this site&apos;s origin, so the response you see is
          exactly what your integration will get.
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
        <Endpoint
          method="GET"
          path="/domains"
          summary="List tracked root domains with counts and last-scan state."
          fields={[
            { name: "search", placeholder: "vodafone" },
            { name: "platform", placeholder: "hackerone" },
            { name: "limit", value: "50", placeholder: "1–1000" },
            { name: "offset", placeholder: "0" },
          ]}
        >
          <Code>{`curl "${BASE}/domains?platform=hackerone&limit=50" \\
  -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>

        <Endpoint
          method="GET"
          path="/domains/{domain}"
          summary="Single domain with live counts (total, new 24h / 7d, active, inactive)."
          fields={[{ name: "domain", in: "path", value: "lovable.app" }]}
        >
          <Code>{`curl "${BASE}/domains/lovable.app" -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>

        <Endpoint
          method="GET"
          path="/domains/{domain}/subdomains"
          summary="Paged hosts for one domain, newest first."
          fields={[
            { name: "domain", in: "path", value: "lovable.app" },
            { name: "filter", placeholder: "all | new | inactive" },
            { name: "search", placeholder: "api" },
            { name: "limit", value: "100", placeholder: "1–1000" },
            { name: "offset", placeholder: "0" },
          ]}
        >
          <Code>{`curl "${BASE}/domains/lovable.app/subdomains?filter=new&limit=200" \\
  -H "Authorization: Bearer $CHAOS_TOKEN"`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="subdomains" title="Subdomains">
        <Endpoint
          method="GET"
          path="/subdomains/new"
          summary="Every newly discovered host across all programs. Page with meta.next_cursor."
          fields={[
            { name: "hours", value: "1", placeholder: "24" },
            { name: "since", placeholder: "2026-08-01T00:00:00Z" },
            { name: "limit", value: "100", placeholder: "1–2000" },
            { name: "before_ts", placeholder: "cursor timestamp" },
            { name: "before_id", placeholder: "cursor id" },
          ]}
        >
          <Code>{`{
  "data": [
    { "host": "vpn-new.example.com", "domain": "example.com", "first_seen_at": "2026-08-01T12:04:11Z" }
  ],
  "meta": { "since": "2026-08-01T11:04:11Z", "limit": 1000, "next_cursor": null }
}`}</Code>
        </Endpoint>
      </DocSection>

      <DocSection id="platforms" title="Platforms">
        <Endpoint
          method="GET"
          path="/platforms"
          summary="Programs with domain counts, subdomain totals and 24h discoveries."
        />
        <Endpoint
          method="GET"
          path="/platforms/{slug}/domains"
          summary="Domains belonging to one program."
          fields={[
            { name: "slug", in: "path", value: "bugcrowd" },
            { name: "limit", value: "100", placeholder: "1–1000" },
            { name: "offset", placeholder: "0" },
          ]}
        />
      </DocSection>

      <DocSection id="scans" title="Scans">
        <Endpoint
          method="GET"
          path="/scans"
          summary="Scan history, newest first."
          fields={[
            { name: "domain", placeholder: "lovable.app" },
            { name: "limit", value: "20", placeholder: "1–500" },
            { name: "offset", placeholder: "0" },
          ]}
        />
        <Endpoint
          method="POST"
          path="/scans"
          summary="Queue an immediate re-scan of one domain. Returns 202; big programs continue in the background."
          body={`{ "domain": "lovable.app" }`}
        >
          <Code>{`curl -X POST "${BASE}/scans" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"lovable.app"}'`}</Code>
        </Endpoint>
        <Endpoint
          method="POST"
          path="/scans/rescan-all"
          summary="Mark every enabled domain as due, kicking off a full sweep on the next worker tick."
        />
      </DocSection>

      <DocSection id="export" title="Export">
        <Endpoint
          method="GET"
          path="/export"
          summary="Streaming bulk export of hosts — handles 100k+ rows."
          fields={[
            { name: "platform", placeholder: "bugcrowd" },
            { name: "domain", placeholder: "lovable.app" },
            { name: "scope", placeholder: "all | new | inactive" },
            { name: "hours", placeholder: "24" },
            { name: "search", placeholder: "api" },
            { name: "format", value: "txt", placeholder: "txt | csv | json" },
          ]}
        >
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

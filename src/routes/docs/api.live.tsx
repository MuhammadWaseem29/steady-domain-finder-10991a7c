import { createFileRoute } from "@tanstack/react-router";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, CopyButton } from "@/components/site/api/primitives";
import { SITE_ORIGIN } from "@/lib/api-nav";

const CURL = `# live hosts for one program (no token needed)
curl -s "${SITE_ORIGIN}/raw/tesla.com/live"

# live hosts for a whole platform, as JSON
curl -s "${SITE_ORIGIN}/raw/bugcrowd?scope=live&format=json"

# live hosts for one program on a platform
curl -s "${SITE_ORIGIN}/raw/hackerone/tesla?scope=live"`;

export const Route = createFileRoute("/docs/api/live")({
  head: () => ({
    meta: [
      { title: "Live hosts — which subdomains answer right now" },
      {
        name: "description",
        content:
          "Probe discovered subdomains with real HTTP/HTTPS requests and read back status codes, page titles, web servers, technologies, CDN and IPs. Public raw lists at /raw/{domain}/live.",
      },
      { property: "og:title", content: "Live hosts — Chaos Monitor" },
      {
        property: "og:description",
        content: "Which subdomains are alive right now: status, title, server, tech, CDN, IP.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveDocsPage,
});

function LiveDocsPage() {
  return (
    <ReferenceShell
      eyebrow="Reference"
      title="Live hosts"
      intro="Chaos Monitor probes discovered subdomains with real HTTP and HTTPS requests — the same checks httpx performs — and records status code, page title, server header, technologies, CDN, IP and response time for every host that answers."
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
      <h2 id="run-a-probe" className="text-xl font-bold">
        Run a probe
      </h2>
      <p className="text-sm text-muted-foreground">
        Sign in, open any program or domain page, and press{" "}
        <strong className="text-foreground">Probe live hosts</strong>. The job runs in the
        background, a few hundred hosts per pass, and results stream into the Live view while it
        works. Large programs resume automatically until every host has been checked.
      </p>

      <h2 id="what-gets-recorded" className="mt-8 text-xl font-bold">
        What gets recorded
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>final URL after redirects, scheme and status code</li>
        <li>page title, content length, content type and response time</li>
        <li>web server header, detected technologies and CDN/WAF</li>
        <li>resolved IP, ASN and CNAME chain</li>
        <li>TLS issuer and certificate expiry when available</li>
      </ul>

      <h2 id="public-lists" className="mt-8 text-xl font-bold">
        Public live lists
      </h2>
      <p className="text-sm text-muted-foreground">
        Live results are also published as open raw lists — no token:
      </p>
      <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-muted-foreground">
        <li>/raw/{"{domain}"}/live — live hosts for one root domain</li>
        <li>/raw/{"{platform}"}?scope=live — live hosts across a platform</li>
        <li>/raw/{"{platform}"}/{"{program}"}?scope=live — live hosts for one program</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        TXT returns one host per line; CSV adds URL, status, title and probe time; JSON returns the
        full row.
      </p>
    </ReferenceShell>
  );
}

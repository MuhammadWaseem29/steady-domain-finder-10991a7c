import { createFileRoute, Link } from "@tanstack/react-router";
import { apiBase } from "@/lib/api-nav";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, CopyButton, Callout } from "@/components/site/api/primitives";

export const Route = createFileRoute("/docs/api/authentication")({
  head: () => ({
    meta: [
      { title: "Authentication — bearer tokens and scopes" },
      {
        name: "description",
        content:
          "How to create, send, scope and rotate Chaos Monitor API tokens, including the read and write scopes and safe storage practices.",
      },
      { property: "og:title", content: "Authentication — Chaos Monitor API" },
      {
        property: "og:description",
        content: "Bearer tokens, read and write scopes, rotation and safe storage.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const base = apiBase();
  const code = `curl "${base}/me" \\
  -H "Authorization: Bearer chs_live_xxxxxxxxxxxx"

# equivalent
curl "${base}/me" -H "X-API-Key: chs_live_xxxxxxxxxxxx"`;

  return (
    <ReferenceShell
      eyebrow="Get started"
      title="Authentication"
      intro="Every endpoint requires a token. Tokens start with chs_live_ and are shown once at creation — only a hash is stored."
      aside={
        <div className="overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="flex items-center justify-between border-b border-terminal-muted/25 px-3 py-2">
            <span className="label-mono text-terminal-muted">Sending the token</span>
            <CopyButton value={code} />
          </div>
          <CodeBlock>{code}</CodeBlock>
        </div>
      }
    >
      <section>
        <h2 className="text-base font-semibold text-foreground">Scopes</h2>
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <div className="p-4">
            <code className="font-mono text-sm font-semibold text-foreground">read</code>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Query domains, subdomains, platforms, scans, stats and exports.
            </p>
          </div>
          <div className="p-4">
            <code className="font-mono text-sm font-semibold text-foreground">write</code>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Additionally queue scans and trigger a full re-scan. Without it those calls return 403{" "}
              <code className="font-mono text-foreground">insufficient_scope</code>.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">Rotating a token</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create the replacement first, deploy it, then revoke the old one on your{" "}
          <Link to="/account" className="story-link text-foreground">
            account page
          </Link>
          . Revocation takes effect on the next request.
        </p>
      </section>

      <div className="mt-8">
        <Callout title="Keep tokens server-side">
          A token grants access to everything this monitor has collected. Never ship one in browser
          code or a public repository. The console on these pages keeps your key in the current
          browser tab only.
        </Callout>
      </div>
    </ReferenceShell>
  );
}

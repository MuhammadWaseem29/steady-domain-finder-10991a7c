import { createFileRoute, Link } from "@tanstack/react-router";
import { apiBase } from "@/lib/api-nav";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, CopyButton, Callout } from "@/components/site/api/primitives";

export const Route = createFileRoute("/docs/api/quickstart")({
  head: () => ({
    meta: [
      { title: "API quickstart — your first subdomain request" },
      {
        name: "description",
        content:
          "Create a token, make your first authenticated request and stream new subdomains from the Chaos Monitor API in under two minutes.",
      },
      { property: "og:title", content: "API quickstart — Chaos Monitor" },
      {
        property: "og:description",
        content: "From zero to your first authenticated subdomain response in two minutes.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Quickstart,
});

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative border-l border-border pl-6 pb-8 last:pb-0">
      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground">
        {n}
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Snippet({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-terminal">
      <div className="flex justify-end border-b border-terminal-muted/25 px-2 py-1.5">
        <CopyButton value={code} />
      </div>
      <CodeBlock>{code}</CodeBlock>
    </div>
  );
}

function Quickstart() {
  const base = apiBase();
  return (
    <ReferenceShell
      eyebrow="Get started"
      title="Quickstart"
      intro="Create a token, call your first endpoint and set up an hourly delta feed."
      aside={
        <Callout title="Need a token?">
          Tokens are created on your{" "}
          <Link to="/account" className="story-link text-foreground">
            account page
          </Link>{" "}
          and shown once. Only a hash is stored, so save it immediately.
        </Callout>
      }
    >
      <Step n={1} title="Create an API token">
        <p>
          Sign in, open the account page and create a key. Read-only keys can query everything;
          add the write scope only if you need to queue scans.
        </p>
      </Step>

      <Step n={2} title="Call the API">
        <p>Send the token as a bearer header. Every response is JSON.</p>
        <Snippet
          code={`curl "${base}/domains?limit=5" \\
  -H "Authorization: Bearer chs_live_xxxxxxxxxxxx"`}
        />
      </Step>

      <Step n={3} title="Pull the newest hosts">
        <p>The discovery feed returns everything first seen inside the window you ask for.</p>
        <Snippet
          code={`curl "${base}/subdomains/new?hours=24&limit=100" \\
  -H "Authorization: Bearer chs_live_xxxxxxxxxxxx" | jq -r '.data[].host'`}
        />
      </Step>

      <Step n={4} title="Automate it">
        <p>
          Run the delta call on a schedule and append the results. See{" "}
          <Link to="/docs/api/guides" className="story-link text-foreground">
            recipes
          </Link>{" "}
          for cursor pagination and bulk exports.
        </p>
        <Snippet code={`5 * * * * /usr/local/bin/chaos-delta.sh >> /var/log/chaos.log 2>&1`} />
      </Step>
    </ReferenceShell>
  );
}

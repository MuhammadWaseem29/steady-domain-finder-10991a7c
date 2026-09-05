import { createFileRoute, Link } from "@tanstack/react-router";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, Callout } from "@/components/site/api/primitives";

const HEADERS = `X-RateLimit-Limit: 120
X-RateLimit-Remaining: 113
X-RateLimit-Reset: 2026-09-05T09:42:00.000Z
X-Request-Id: b2f0c8d1-1f6e-4d0b-9d55-2a9c3b1f77aa`;

const BACKOFF = `async function call(url, token, attempt = 0) {
  const res = await fetch(url, { headers: { Authorization: \`Bearer \${token}\` } });
  if (res.status === 429 && attempt < 5) {
    const reset = res.headers.get("x-ratelimit-reset");
    const waitMs = reset ? Math.max(0, Date.parse(reset) - Date.now()) : 2 ** attempt * 1000;
    await new Promise((r) => setTimeout(r, waitMs + Math.random() * 500));
    return call(url, token, attempt + 1);
  }
  return res.json();
}`;

export const Route = createFileRoute("/docs/api/rate-limits")({
  head: () => ({
    meta: [
      { title: "Rate limits — quotas, headers and back-off" },
      {
        name: "description",
        content:
          "The Chaos Monitor API allows 120 requests per minute per token. Read the rate limit headers and back off correctly when you hit 429.",
      },
      { property: "og:title", content: "Rate limits — Chaos Monitor API" },
      {
        property: "og:description",
        content: "120 requests per minute per token, with headers and a back-off recipe.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RateLimitsPage,
});

function RateLimitsPage() {
  return (
    <ReferenceShell
      eyebrow="Reference"
      title="Rate limits"
      intro="Each token gets 120 requests per minute. Limits are per key, so separate integrations should use separate keys."
      aside={
        <div className="overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="border-b border-terminal-muted/25 px-3 py-2">
            <span className="label-mono text-terminal-muted">Response headers</span>
          </div>
          <CodeBlock>{HEADERS}</CodeBlock>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Per token", value: "120 / min" },
          { label: "Over quota", value: "429" },
          { label: "Export calls", value: "Streamed" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="label-mono text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">Backing off</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          On a 429, wait until{" "}
          <code className="font-mono text-foreground">X-RateLimit-Reset</code>, add a little jitter,
          then retry. Never retry in a tight loop.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-terminal">
          <CodeBlock>{BACKOFF}</CodeBlock>
        </div>
      </section>

      <div className="mt-8">
        <Callout title="Pull less, get more">
          One 2,000-row page beats forty 50-row pages. For whole-program dumps use{" "}
          <Link to="/docs/api/guides" className="story-link text-foreground">
            the export recipe
          </Link>{" "}
          — a single streamed request instead of thousands of paged calls.
        </Callout>
      </div>
    </ReferenceShell>
  );
}

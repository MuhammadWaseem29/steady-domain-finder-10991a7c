import { createFileRoute } from "@tanstack/react-router";
import { API_ERRORS } from "@/lib/api-docs-content";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, Callout } from "@/components/site/api/primitives";

const SHAPE = `{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Retry after the reset window."
  },
  "request_id": "b2f0c8d1-1f6e-4d0b-9d55-2a9c3b1f77aa"
}`;

export const Route = createFileRoute("/docs/api/errors")({
  head: () => ({
    meta: [
      { title: "API error codes — Chaos Monitor API" },
      {
        name: "description",
        content:
          "Every error code the Chaos Monitor API returns, when it happens and how to fix it, including request ids for support.",
      },
      { property: "og:title", content: "API error codes — Chaos Monitor API" },
      {
        property: "og:description",
        content: "Complete catalogue of API error codes with causes and fixes.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ErrorsPage,
});

function ErrorsPage() {
  return (
    <ReferenceShell
      eyebrow="Reference"
      title="Errors"
      intro="Errors always return JSON with a stable machine-readable code and the request id, which is also echoed in the X-Request-Id response header."
      aside={
        <div className="overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="border-b border-terminal-muted/25 px-3 py-2">
            <span className="label-mono text-terminal-muted">Error shape</span>
          </div>
          <CodeBlock>{SHAPE}</CodeBlock>
        </div>
      }
    >
      <Callout title="Always log the request id">
        Every response carries <code className="font-mono text-foreground">X-Request-Id</code>. Keep
        it with your logs — it is the fastest way to trace a failed call.
      </Callout>

      <div className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {API_ERRORS.map((e) => (
          <div key={e.code} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono rounded bg-muted px-1.5 py-0.5 text-foreground">
                {e.status}
              </span>
              <code className="font-mono text-sm font-semibold text-foreground">{e.code}</code>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{e.when}</p>
            <p className="mt-1 text-sm text-foreground">{e.fix}</p>
          </div>
        ))}
      </div>
    </ReferenceShell>
  );
}

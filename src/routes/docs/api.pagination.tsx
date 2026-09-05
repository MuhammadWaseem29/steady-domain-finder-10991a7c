import { createFileRoute } from "@tanstack/react-router";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, Callout } from "@/components/site/api/primitives";

const META = `{
  "data": [ /* rows */ ],
  "meta": {
    "limit": 2000,
    "count": 2000,
    "next_cursor": {
      "before_ts": "2026-09-05T09:41:22.108Z",
      "before_id": "0f0a…"
    }
  },
  "request_id": "…"
}`;

export const Route = createFileRoute("/docs/api/pagination")({
  head: () => ({
    meta: [
      { title: "Pagination — offset and cursor paging explained" },
      {
        name: "description",
        content:
          "How to page through millions of subdomains with the Chaos Monitor API: offset paging for stable lists, cursor paging for live discovery feeds.",
      },
      { property: "og:title", content: "Pagination — Chaos Monitor API" },
      {
        property: "og:description",
        content: "Offset paging for stable lists, cursor paging for live feeds.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginationPage,
});

function PaginationPage() {
  return (
    <ReferenceShell
      eyebrow="Reference"
      title="Pagination"
      intro="List endpoints use offset paging. The live discovery feed uses cursor paging so rows are never skipped or repeated while new hosts are landing."
      aside={
        <div className="overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="border-b border-terminal-muted/25 px-3 py-2">
            <span className="label-mono text-terminal-muted">meta.next_cursor</span>
          </div>
          <CodeBlock>{META}</CodeBlock>
        </div>
      }
    >
      <section>
        <h2 className="text-base font-semibold text-foreground">Offset paging</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pass <code className="font-mono text-foreground">limit</code> and{" "}
          <code className="font-mono text-foreground">offset</code>. Best for stable lists such as
          domains, platforms and scan history. Stop when a page returns fewer rows than the limit.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-foreground">Cursor paging</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The new-subdomain feed returns{" "}
          <code className="font-mono text-foreground">meta.next_cursor</code>. Send those values
          back as query parameters on the next call and repeat until the cursor is absent or the
          page is empty.
        </p>
      </section>

      <div className="mt-8">
        <Callout title="Sizing your pages">
          2,000 rows per page is the sweet spot for the discovery feed. For a complete program dump
          use the export endpoint instead — it streams and never times out.
        </Callout>
      </div>
    </ReferenceShell>
  );
}

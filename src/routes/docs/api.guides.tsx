import { createFileRoute } from "@tanstack/react-router";
import { API_GUIDES } from "@/lib/api-docs-content";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { CodeBlock, CopyButton, Callout } from "@/components/site/api/primitives";

export const Route = createFileRoute("/docs/api/guides")({
  head: () => ({
    meta: [
      { title: "API recipes — polling, pagination and bulk exports" },
      {
        name: "description",
        content:
          "Copy-paste recipes for the Chaos Monitor API: hourly delta polling, cursor pagination, streaming exports, queueing re-scans and keeping a local mirror in sync.",
      },
      { property: "og:title", content: "API recipes — Chaos Monitor" },
      {
        property: "og:description",
        content: "Working recipes for polling, pagination, exports and re-scans.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidesPage,
});

function GuidesPage() {
  return (
    <ReferenceShell
      eyebrow="Get started"
      title="Recipes"
      intro="Five patterns that cover almost every integration built on this data."
      aside={
        <Callout title="Set these once">
          Export <code className="font-mono text-foreground">BASE</code> and{" "}
          <code className="font-mono text-foreground">CHAOS_TOKEN</code> in your shell and each
          snippet runs as-is.
        </Callout>
      }
    >
      <div className="space-y-10">
        {API_GUIDES.map((g) => (
          <section key={g.id} id={g.id}>
            <h2 className="text-base font-semibold text-foreground">{g.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{g.intro}</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-terminal">
              <div className="flex items-center justify-between border-b border-terminal-muted/25 px-3 py-1.5">
                <span className="label-mono text-terminal-muted">{g.language}</span>
                <CopyButton value={g.code} />
              </div>
              <CodeBlock>{g.code}</CodeBlock>
            </div>
          </section>
        ))}
      </div>
    </ReferenceShell>
  );
}

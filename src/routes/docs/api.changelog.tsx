import { createFileRoute } from "@tanstack/react-router";
import { API_CHANGELOG } from "@/lib/api-docs-content";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { Callout } from "@/components/site/api/primitives";

export const Route = createFileRoute("/docs/api/changelog")({
  head: () => ({
    meta: [
      { title: "API changelog — releases and breaking changes" },
      {
        name: "description",
        content:
          "Release notes for the Chaos Monitor API: new endpoints, headers, scopes and spec changes, newest first.",
      },
      { property: "og:title", content: "API changelog — Chaos Monitor" },
      {
        property: "og:description",
        content: "Release notes for the subdomain discovery API, newest first.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <ReferenceShell
      eyebrow="Reference"
      title="Changelog"
      intro="Additive changes ship continuously. Anything breaking would arrive under a new version prefix."
      aside={
        <Callout title="Versioning">
          The v1 surface only grows: new fields and endpoints can appear at any time, so parse
          responses tolerantly.
        </Callout>
      }
    >
      <div className="space-y-8">
        {API_CHANGELOG.map((entry) => (
          <section key={entry.date} className="border-l border-border pl-6">
            <p className="label-mono text-muted-foreground">{entry.date}</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{entry.title}</h2>
            <ul className="mt-3 space-y-2">
              {entry.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ReferenceShell>
  );
}

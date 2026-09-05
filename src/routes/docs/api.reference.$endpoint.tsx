import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { API_ENDPOINTS } from "@/lib/api-spec";
import { apiBase } from "@/lib/api-nav";
import { API_ERRORS } from "@/lib/api-docs-content";
import { ReferenceShell } from "@/components/site/api/reference-shell";
import { ParamTable } from "@/components/site/api/param-table";
import { TryItConsole } from "@/components/site/api/try-it-console";
import { CodeBlock, CopyButton, MethodBadge, Callout } from "@/components/site/api/primitives";

export const Route = createFileRoute("/docs/api/reference/$endpoint")({
  loader: ({ params }) => {
    const endpoint = API_ENDPOINTS.find((e) => e.id === params.endpoint);
    if (!endpoint) throw notFound();
    return { endpoint };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Endpoint not found — Chaos Monitor API" }, { name: "robots", content: "noindex" }],
      };
    }
    const { endpoint } = loaderData;
    const title = `${endpoint.method} ${endpoint.path} — Chaos Monitor API`;
    return {
      meta: [
        { title },
        { name: "description", content: endpoint.description.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: endpoint.description.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: EndpointNotFound,
  component: EndpointPage,
});

function EndpointNotFound() {
  return (
    <ReferenceShell title="Endpoint not found" intro="That reference page does not exist.">
      <Link to="/docs/api" className="story-link text-foreground">
        Back to the API overview
      </Link>
    </ReferenceShell>
  );
}

function EndpointPage() {
  const { endpoint } = Route.useLoaderData();
  const base = apiBase();
  const relevantErrors = API_ERRORS.filter(
    (e) =>
      e.status !== 403 ||
      endpoint.scope === "write",
  ).filter((e) => e.code !== "unknown_platform" || endpoint.path.includes("{slug}"));

  return (
    <ReferenceShell
      eyebrow={endpoint.group}
      title={endpoint.summary}
      intro={endpoint.description}
      aside={<TryItConsole endpoint={endpoint} base={base} />}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <MethodBadge method={endpoint.method} />
        <code className="break-all font-mono text-sm font-semibold text-foreground">
          {base}
          {endpoint.path === "/" ? "" : endpoint.path}
        </code>
        <span className="label-mono ml-auto text-muted-foreground">scope: {endpoint.scope}</span>
      </div>

      {endpoint.scope === "write" && (
        <div className="mt-6">
          <Callout title="Write scope required">
            This endpoint changes state, so the token must carry the{" "}
            <code className="font-mono text-foreground">write</code> scope. Read-only keys get a 403{" "}
            <code className="font-mono text-foreground">insufficient_scope</code>.
          </Callout>
        </div>
      )}

      <ParamTable
        title="Path parameters"
        params={endpoint.params.filter((p) => p.in === "path")}
      />
      <ParamTable
        title="Query parameters"
        params={endpoint.params.filter((p) => p.in === "query")}
      />
      <ParamTable title="Body" params={endpoint.params.filter((p) => p.in === "body")} />

      <section className="mt-10">
        <h2 className="label-mono text-muted-foreground">Example response</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="flex items-center justify-between border-b border-terminal-muted/25 px-3 py-2">
            <span className="label-mono text-terminal-muted">200 application/json</span>
            <CopyButton value={endpoint.responseExample} />
          </div>
          <CodeBlock>{endpoint.responseExample}</CodeBlock>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="label-mono text-muted-foreground">Errors</h2>
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {relevantErrors.map((e) => (
            <div key={e.code} className="flex flex-wrap items-baseline gap-3 p-3.5">
              <span className="label-mono text-muted-foreground">{e.status}</span>
              <code className="font-mono text-sm text-foreground">{e.code}</code>
              <span className="text-xs text-muted-foreground">{e.when}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Full catalogue with fixes on the{" "}
          <Link to="/docs/api/errors" className="story-link text-foreground">
            errors page
          </Link>
          .
        </p>
      </section>
    </ReferenceShell>
  );
}

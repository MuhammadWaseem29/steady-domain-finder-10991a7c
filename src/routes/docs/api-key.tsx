import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout, DocSection, Code } from "@/components/site/docs";

export const Route = createFileRoute("/docs/api-key")({
  head: () => ({
    meta: [
      { title: "API Key — Chaos Docs" },
      {
        name: "description",
        content:
          "How to obtain and use a Chaos API key for authenticating subdomain requests against the Chaos DNS dataset.",
      },
      { property: "og:title", content: "API Key — Chaos Docs" },
      {
        property: "og:description",
        content: "Get a Chaos API key and authenticate your subdomain requests.",
      },
    ],
  }),
  component: ApiKeyDoc,
});

function ApiKeyDoc() {
  return (
    <DocsLayout
      title="API Key"
      intro="Every Chaos request is authenticated with an API key sent in the Authorization header."
      sections={[
        { id: "get-a-key", label: "Get a key" },
        { id: "using-the-key", label: "Using the key" },
        { id: "this-monitor", label: "This monitor" },
      ]}
    >
      <DocSection id="get-a-key" title="Get a key">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Sign in to the ProjectDiscovery Cloud Platform.</li>
          <li>Open your account settings and locate the API key section.</li>
          <li>Copy the key — it is a UUID-style string tied to your account.</li>
        </ol>
        <p>Treat the key as a secret: never commit it or expose it in browser code.</p>
      </DocSection>

      <DocSection id="using-the-key" title="Using the key">
        <p>
          Pass the key verbatim in the <code className="font-mono text-foreground">Authorization</code>{" "}
          header — no <code className="font-mono text-foreground">Bearer</code> prefix.
        </p>
        <Code>{`curl -X GET "https://dns.projectdiscovery.io/dns/lovable.app/subdomains" \\
     -H "Authorization: API_KEY" \\
     -H "Connection: close"`}</Code>
      </DocSection>

      <DocSection id="this-monitor" title="This monitor">
        <p>
          This deployment stores its Chaos key as a backend secret. All Chaos requests run
          server-side on an hourly schedule, so the key is never sent to the browser and never
          appears in the network tab.
        </p>
      </DocSection>
    </DocsLayout>
  );
}

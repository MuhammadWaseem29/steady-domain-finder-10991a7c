import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout, DocSection, Param, Code } from "@/components/site/docs";

export const Route = createFileRoute("/docs/fetch-subdomains")({
  head: () => ({
    meta: [
      { title: "Fetch Subdomains — Chaos Docs" },
      {
        name: "description",
        content:
          "Fetch all known subdomains for a domain with the Chaos DNS API: path parameters, headers, request structure and example responses.",
      },
      { property: "og:title", content: "Fetch Subdomains — Chaos Docs" },
      {
        property: "og:description",
        content: "Reference for the Chaos GET /dns/{domain}/subdomains endpoint.",
      },
    ],
  }),
  component: FetchSubdomainsDoc,
});

function FetchSubdomainsDoc() {
  return (
    <DocsLayout
      title="Fetch Subdomains"
      intro="Fetch subdomains for a given domain using the Chaos API."
      sections={[
        { id: "path-parameters", label: "Path Parameters" },
        { id: "header-parameters", label: "Header Parameters" },
        { id: "structure", label: "Structure" },
        { id: "example", label: "Example" },
      ]}
    >
      <DocSection id="path-parameters" title="Path Parameters">
        <p>Parameters that are part of the URL path.</p>
        <Param name="domain" type="string" required>
          Domain for which you want to fetch subdomains.
        </Param>
      </DocSection>

      <DocSection id="header-parameters" title="Header Parameters">
        <p>Parameters that are part of the request header.</p>
        <Param name="Authorization" type="string" required>
          API key for authentication. See the API Key page for how to obtain one.
        </Param>
      </DocSection>

      <DocSection id="structure" title="Structure">
        <Code>{`GET /dns/{domain}/subdomains
Host: dns.projectdiscovery.io
Authorization: API_KEY
Connection: close`}</Code>
        <Code>{`{"domain":"domain","subdomains":[...],"count":1337}`}</Code>
        <p>
          Subdomains are returned as relative labels. Prefix each label to the root domain to get
          the full host, e.g. <code className="font-mono text-foreground">www</code> +{" "}
          <code className="font-mono text-foreground">lovable.app</code> ={" "}
          <code className="font-mono text-foreground">www.lovable.app</code>.
        </p>
      </DocSection>

      <DocSection id="example" title="Example">
        <Code>{`curl -X GET "https://dns.projectdiscovery.io/dns/lovable.app/subdomains" \\
     -H "Authorization: API_KEY" \\
     -H "Connection: close"`}</Code>
        <Code>{`{"domain":"lovable.app","subdomains":["www","connect","yt",...],"count":9948}`}</Code>
      </DocSection>
    </DocsLayout>
  );
}

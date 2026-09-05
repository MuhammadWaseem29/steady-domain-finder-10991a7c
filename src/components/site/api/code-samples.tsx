import { useMemo, useState } from "react";
import type { ApiEndpoint } from "@/lib/api-spec";
import { CopyButton, CodeBlock } from "./primitives";

export type SampleInput = {
  endpoint: ApiEndpoint;
  base: string;
  values: Record<string, string>;
  token: string;
};

export function buildUrl({ endpoint, base, values }: Omit<SampleInput, "token">): string {
  let path = endpoint.path;
  for (const p of endpoint.params.filter((x) => x.in === "path")) {
    const v = values[p.name] || String(p.example ?? `{${p.name}}`);
    path = path.replace(`{${p.name}}`, encodeURIComponent(v));
  }
  const query = new URLSearchParams();
  for (const p of endpoint.params.filter((x) => x.in === "query")) {
    const v = values[p.name];
    if (v !== undefined && v !== "") query.set(p.name, v);
  }
  const qs = query.toString();
  return `${base}${path === "/" ? "" : path}${qs ? `?${qs}` : ""}`;
}

export function buildBody({ endpoint, values }: Omit<SampleInput, "token" | "base">): string | null {
  const bodyParams = endpoint.params.filter((p) => p.in === "body");
  if (!bodyParams.length || endpoint.method !== "POST") return null;
  const obj: Record<string, unknown> = {};
  for (const p of bodyParams) {
    const v = values[p.name];
    if (v !== undefined && v !== "") obj[p.name] = p.type === "integer" ? Number(v) : v;
  }
  return JSON.stringify(obj);
}

const LANGS = ["cURL", "JavaScript", "Python", "Go", "PHP"] as const;
type Lang = (typeof LANGS)[number];

function sample(lang: Lang, input: SampleInput): string {
  const url = buildUrl(input);
  const body = buildBody(input);
  const token = input.token || "chs_live_xxxxxxxxxxxx";
  const method = input.endpoint.method;

  switch (lang) {
    case "cURL":
      return [
        `curl${method === "POST" ? " -X POST" : ""} "${url}" \\`,
        `  -H "Authorization: Bearer ${token}"${body ? " \\" : ""}`,
        ...(body ? [`  -H "Content-Type: application/json" \\`, `  -d '${body}'`] : []),
      ].join("\n");
    case "JavaScript":
      return `const res = await fetch("${url}", {
  method: "${method}",
  headers: {
    Authorization: "Bearer ${token}",${body ? '\n    "Content-Type": "application/json",' : ""}
  },${body ? `\n  body: JSON.stringify(${body}),` : ""}
});
const data = await res.json();
console.log(data);`;
    case "Python":
      return `import requests

res = requests.${method.toLowerCase()}(
    "${url}",
    headers={"Authorization": "Bearer ${token}"},${body ? `\n    json=${body.replace(/"/g, '"')},` : ""}
    timeout=60,
)
res.raise_for_status()
print(res.json())`;
    case "Go":
      return `req, _ := http.NewRequest("${method}", "${url}", ${body ? `strings.NewReader(\`${body}\`)` : "nil"})
req.Header.Set("Authorization", "Bearer ${token}")${body ? `\nreq.Header.Set("Content-Type", "application/json")` : ""}
resp, err := http.DefaultClient.Do(req)
if err != nil { log.Fatal(err) }
defer resp.Body.Close()
io.Copy(os.Stdout, resp.Body)`;
    case "PHP":
      return `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => "${method}",
  CURLOPT_HTTPHEADER => ["Authorization: Bearer ${token}"${body ? ', "Content-Type: application/json"' : ""}],${body ? `\n  CURLOPT_POSTFIELDS => '${body}',` : ""}
]);
echo curl_exec($ch);`;
  }
}

export function CodeSamples(props: SampleInput) {
  const [lang, setLang] = useState<Lang>("cURL");
  const code = useMemo(() => sample(lang, props), [lang, props]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-terminal">
      <div className="flex items-center gap-1 border-b border-terminal-muted/25 px-2 py-1.5">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
              lang === l
                ? "bg-terminal-muted/25 text-terminal-foreground"
                : "text-terminal-muted hover:text-terminal-foreground"
            }`}
          >
            {l}
          </button>
        ))}
        <div className="ml-auto">
          <CopyButton value={code} />
        </div>
      </div>
      <CodeBlock>{code}</CodeBlock>
    </div>
  );
}

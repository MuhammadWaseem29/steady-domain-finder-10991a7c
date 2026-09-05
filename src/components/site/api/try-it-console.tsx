import { useEffect, useMemo, useState } from "react";
import type { ApiEndpoint } from "@/lib/api-spec";
import { buildBody, buildUrl, CodeSamples } from "./code-samples";
import { CodeBlock, CopyButton, MethodBadge, StatusPill } from "./primitives";

const TOKEN_KEY = "chaos.api.token";

export function useApiToken() {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(window.sessionStorage.getItem(TOKEN_KEY) ?? "");
  }, []);
  const save = (value: string) => {
    setToken(value);
    if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  };
  return { token, setToken: save };
}

type Result = {
  status: number;
  timeMs: number;
  headers: [string, string][];
  body: string;
} | null;

export function TryItConsole({ endpoint, base }: { endpoint: ApiEndpoint; base: string }) {
  const { token, setToken } = useApiToken();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      endpoint.params.map((p) => [
        p.name,
        p.in === "path" ? String(p.example ?? "") : String(p.default ?? ""),
      ]),
    ),
  );
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues(
      Object.fromEntries(
        endpoint.params.map((p) => [
          p.name,
          p.in === "path" ? String(p.example ?? "") : String(p.default ?? ""),
        ]),
      ),
    );
    setResult(null);
  }, [endpoint]);

  const url = useMemo(() => buildUrl({ endpoint, base, values }), [endpoint, base, values]);

  async function send() {
    setBusy(true);
    const started = performance.now();
    try {
      const body = buildBody({ endpoint, values });
      const res = await fetch(url, {
        method: endpoint.method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body } : {}),
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        pretty = text.slice(0, 20000);
      }
      setResult({
        status: res.status,
        timeMs: Math.round(performance.now() - started),
        headers: [...res.headers.entries()],
        body: pretty,
      });
    } catch (e) {
      setResult({
        status: 0,
        timeMs: Math.round(performance.now() - started),
        headers: [],
        body: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <span className="label-mono text-muted-foreground">Try it</span>
        </div>

        <label className="mt-4 block text-xs font-medium text-foreground" htmlFor="api-token">
          API token
        </label>
        <input
          id="api-token"
          type="password"
          value={token}
          placeholder="chs_live_…"
          onChange={(e) => setToken(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Kept in this browser tab only and sent straight to this API.
        </p>

        {endpoint.params.length > 0 && (
          <div className="mt-4 space-y-3">
            {endpoint.params.map((p) => (
              <div key={`${p.in}-${p.name}`}>
                <label
                  className="flex items-center gap-2 text-xs font-medium text-foreground"
                  htmlFor={`param-${p.name}`}
                >
                  {p.name}
                  <span className="label-mono text-muted-foreground">{p.in}</span>
                </label>
                {p.enum ? (
                  <select
                    id={`param-${p.name}`}
                    value={values[p.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">—</option>
                    {p.enum.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`param-${p.name}`}
                    value={values[p.name] ?? ""}
                    placeholder={String(p.example ?? p.default ?? "")}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 break-all rounded-lg bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {url}
        </div>

        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>

      {result && (
        <div className="overflow-hidden rounded-xl border border-border bg-terminal">
          <div className="flex flex-wrap items-center gap-2 border-b border-terminal-muted/25 px-3 py-2">
            <StatusPill status={result.status} />
            <span className="font-mono text-[11px] text-terminal-muted">{result.timeMs} ms</span>
            <span className="font-mono text-[11px] text-terminal-muted">
              {result.headers.find(([k]) => k === "x-request-id")?.[1]?.slice(0, 8) ?? ""}
            </span>
            <div className="ml-auto">
              <CopyButton value={result.body} />
            </div>
          </div>
          <CodeBlock>{result.body}</CodeBlock>
          {result.headers.length > 0 && (
            <details className="border-t border-terminal-muted/25 px-3 py-2">
              <summary className="cursor-pointer font-mono text-[11px] text-terminal-muted">
                Response headers
              </summary>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-terminal-muted">
                {result.headers.map(([k, v]) => (
                  <div key={k}>
                    <span className="text-terminal-foreground">{k}</span>: {v}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <CodeSamples endpoint={endpoint} base={base} values={values} token={token} />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, Loader2, Play, KeyRound } from "lucide-react";
import { toast } from "sonner";

const TOKEN_KEY = "chaos.api.token";

export function useApiToken() {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(sessionStorage.getItem(TOKEN_KEY) ?? "");
  }, []);
  const save = (value: string) => {
    setToken(value);
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  };
  return { token, save };
}

/** Session-scoped token field shared by every console on the page. */
export function ApiTokenBar() {
  const { token, save } = useApiToken();
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <label className="label-mono flex items-center gap-2 text-muted-foreground">
        <KeyRound className="size-3.5" /> API token (kept in this browser tab only)
      </label>
      <input
        value={token}
        onChange={(e) => save(e.target.value)}
        placeholder="chs_live_…"
        spellCheck={false}
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none transition focus:border-primary"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Never stored on our servers — it lives in <code className="font-mono">sessionStorage</code>{" "}
        and is dropped when you close the tab.
      </p>
    </div>
  );
}

export type ConsoleField = {
  name: string;
  placeholder?: string;
  value?: string;
  /** Path params are substituted into the URL; the rest become query params. */
  in?: "path" | "query";
};

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setDone(true);
        toast.success("Copied");
        setTimeout(() => setDone(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
      aria-label={label}
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const tone =
    method === "POST"
      ? "bg-[color:var(--color-chart-2)]/15 text-[color:var(--color-chart-2)]"
      : "bg-[color:var(--color-chart-1)]/15 text-[color:var(--color-chart-1)]";
  return (
    <span className={`label-mono rounded-full px-2 py-0.5 font-semibold ${tone}`}>{method}</span>
  );
}

/** Interactive request runner for a single endpoint. */
export function ApiConsole({
  method,
  path,
  fields = [],
  body,
}: {
  method: "GET" | "POST";
  path: string;
  fields?: ConsoleField[];
  body?: string;
}) {
  const { token } = useApiToken();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""])),
  );
  const [payload, setPayload] = useState(body ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ status: number; ms: number; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const url = useMemo(() => {
    let p = path;
    const query = new URLSearchParams();
    for (const f of fields) {
      const v = (values[f.name] ?? "").trim();
      if (!v) continue;
      if (f.in === "path") p = p.replace(`{${f.name}}`, encodeURIComponent(v));
      else query.set(f.name, v);
    }
    const qs = query.toString();
    return `${origin}/api/v1${p}${qs ? `?${qs}` : ""}`;
  }, [fields, values, path, origin]);

  const curl = useMemo(() => {
    const lines = [`curl${method === "POST" ? " -X POST" : ""} "${url}"`];
    lines.push(`  -H "Authorization: Bearer ${token || "chs_live_…"}"`);
    if (method === "POST" && payload.trim()) {
      lines.push(`  -H "Content-Type: application/json"`);
      lines.push(`  -d '${payload.replace(/\s+/g, " ").trim()}'`);
    }
    return lines.join(" \\\n");
  }, [url, method, payload, token]);

  async function send() {
    if (!token) {
      toast.error("Add your API token above first");
      return;
    }
    setPending(true);
    const started = performance.now();
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(method === "POST" && payload.trim() ? { "Content-Type": "application/json" } : {}),
        },
        ...(method === "POST" && payload.trim() ? { body: payload } : {}),
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* non-JSON (export streams) shown raw */
      }
      setResult({
        status: res.status,
        ms: Math.round(performance.now() - started),
        text: pretty.length > 20000 ? `${pretty.slice(0, 20000)}\n… truncated` : pretty,
      });
      setOpen(true);
    } catch (e) {
      setResult({
        status: 0,
        ms: Math.round(performance.now() - started),
        text: e instanceof Error ? e.message : "Request failed",
      });
      setOpen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      {fields.length > 0 && (
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1">
              <span className="label-mono text-muted-foreground">
                {f.name}
                {f.in === "path" ? " · path" : ""}
              </span>
              <input
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                placeholder={f.placeholder ?? ""}
                spellCheck={false}
                className="rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs outline-none transition focus:border-primary"
              />
            </label>
          ))}
        </div>
      )}

      {method === "POST" && body !== undefined && (
        <div className="border-b border-border p-3">
          <span className="label-mono text-muted-foreground">request body</span>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={3}
            spellCheck={false}
            className="mt-1 w-full resize-y rounded-md border border-border bg-card p-2 font-mono text-xs outline-none transition focus:border-primary"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 p-3">
        <button
          onClick={() => void send()}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Send request
        </button>
        <CopyButton text={curl} label="Copy curl" />
        <CopyButton text={url} label="Copy URL" />
        <code className="ml-auto max-w-full truncate font-mono text-[11px] text-muted-foreground">
          {url}
        </code>
      </div>

      <AnimatePresence initial={false}>
        {open && result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <span
                className={`label-mono rounded-full px-2 py-0.5 ${
                  result.status >= 200 && result.status < 300
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {result.status || "network error"}
              </span>
              <span className="text-[11px] text-muted-foreground">{result.ms} ms</span>
              <span className="ml-auto flex gap-2">
                <CopyButton text={result.text} label="Copy response" />
                <button
                  onClick={() => setOpen(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  hide
                </button>
              </span>
            </div>
            <pre className="max-h-80 overflow-auto rounded-b-lg bg-terminal p-3 font-mono text-[12px] leading-5 text-terminal-foreground">
              {result.text}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

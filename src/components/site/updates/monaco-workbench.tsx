import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Download, Loader2, Play, Terminal, Wand2 } from "lucide-react";

import { Skeleton } from "@/components/site/motion";
import {
  DSL_HELP,
  applyHostQuery,
  formatHosts,
  parseQuery,
  type ExportFormat,
} from "@/lib/updates-dsl";
import { download } from "@/lib/chaos-data";
import type { WorkerRequest, WorkerResponse } from "@/lib/updates-worker";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

const FORMATS: ExportFormat[] = ["txt", "csv", "json", "jsonl", "md"];

const EDITOR_OPTIONS = {
  fontSize: 12,
  fontFamily:
    "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  renderLineHighlight: "none" as const,
  lineNumbersMinChars: 3,
  padding: { top: 10, bottom: 10 },
  automaticLayout: true,
  wordWrap: "on" as const,
};

function EditorBox({
  value,
  onChange,
  language = "plaintext",
  height = 220,
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  height?: number;
  readOnly?: boolean;
}) {
  return (
    <ClientOnly fallback={<Skeleton className="w-full" />}>
      <Suspense fallback={<Skeleton className="w-full" />}>
        <div className="overflow-hidden rounded-md border border-border" style={{ height }}>
          <MonacoEditor
            height={height}
            language={language}
            theme="vs-dark"
            value={value}
            onChange={(v) => onChange?.(v ?? "")}
            options={{ ...EDITOR_OPTIONS, readOnly }}
            loading={<Skeleton className="h-full w-full" />}
          />
        </div>
      </Suspense>
    </ClientOnly>
  );
}

export function MonacoWorkbench({
  query,
  onQueryChange,
  fetchHosts,
  windowLabel,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  fetchHosts: () => Promise<string>;
  windowLabel: string;
}) {
  const [tab, setTab] = useState<"query" | "hosts" | "output">("query");
  const [buffer, setBuffer] = useState("");
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [stats, setStats] = useState<{ total: number; kept: number; ms: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("../../../lib/updates-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== seq.current) return;
      setOutput(e.data.output);
      setStats({ total: e.data.total, kept: e.data.kept, ms: e.data.ms });
    };
    return () => w.terminate();
  }, []);

  const run = useCallback(
    (text: string, q: string, fmt: ExportFormat) => {
      const id = ++seq.current;
      const w = workerRef.current;
      const payload: WorkerRequest = { id, text, query: q, format: fmt };
      if (w) {
        w.postMessage(payload);
        return;
      }
      // Fallback if workers are unavailable.
      const raw = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const hosts = applyHostQuery(raw, parseQuery(q));
      setOutput(formatHosts(hosts, fmt));
      setStats({ total: raw.length, kept: hosts.length, ms: 0 });
    },
    [],
  );

  useEffect(() => {
    if (!buffer) return;
    const t = setTimeout(() => run(buffer, query, format), 180);
    return () => clearTimeout(t);
  }, [buffer, query, format, run]);

  const load = async () => {
    setLoading(true);
    const id = toast.loading("Streaming new hosts…");
    try {
      const text = await fetchHosts();
      setBuffer(text);
      run(text, query, format);
      setTab("hosts");
      const n = text.split("\n").filter(Boolean).length;
      toast.success(`Loaded ${n.toLocaleString()} hosts`, { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed", { id });
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = async () => {
    if (!output) {
      toast.error("Nothing to copy — load hosts first");
      return;
    }
    await navigator.clipboard.writeText(output);
    toast.success(`Copied ${stats?.kept.toLocaleString() ?? ""} hosts`);
  };

  const tabs = [
    { k: "query" as const, label: "Query editor", icon: Terminal },
    { k: "hosts" as const, label: "Host buffer", icon: Wand2 },
    { k: "output" as const, label: "Export preview", icon: Download },
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
              tab === t.k
                ? "bg-foreground text-background"
                : "border border-border hover:bg-accent"
            }`}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {stats && (
            <span className="label-mono text-muted-foreground">
              {stats.kept.toLocaleString()} / {stats.total.toLocaleString()} · {stats.ms}ms
            </span>
          )}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            aria-label="Export format"
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Load new hosts
          </button>
          <button
            onClick={copyOutput}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <Copy className="size-3.5" /> Copy
          </button>
          <button
            onClick={() =>
              output
                ? download(`chaos-new-hosts.${format}`, output)
                : toast.error("Nothing to download yet")
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <Download className="size-3.5" /> Download
          </button>
        </div>
      </div>

      <div className="p-3">
        {tab === "query" && (
          <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
            <EditorBox value={query} onChange={onQueryChange} height={220} />
            <pre className="overflow-auto rounded-md border border-border bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {DSL_HELP}
            </pre>
          </div>
        )}
        {tab === "hosts" && (
          <EditorBox value={buffer} onChange={setBuffer} height={340} />
        )}
        {tab === "output" && (
          <EditorBox
            value={output}
            language={format === "json" ? "json" : format === "md" ? "markdown" : "plaintext"}
            height={340}
            readOnly
          />
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Buffer scope: new hosts for the current filters · {windowLabel}. Filtering runs in a
          background worker, so even 500k hosts stay smooth.
        </p>
      </div>
    </div>
  );
}

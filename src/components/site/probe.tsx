import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, Copy, ExternalLink, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { createProbeJob, liveHostsPage, probeJobStatus } from "@/lib/probe.functions";
import { useSession } from "@/lib/use-session";

type Target = {
  domain?: string;
  platformSlug?: string;
  program?: string;
};

export function ProbeButton({ target, search }: { target: Target; search?: string }) {
  const { user } = useSession();
  const run = useServerFn(createProbeJob);
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusFn = useServerFn(probeJobStatus);
  const { data: job } = useQuery({
    queryKey: ["probe-job", jobId],
    queryFn: () => statusFn({ data: { jobId: jobId! } }),
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data?.status === "finished" || q.state.data?.status === "error" ? false : 3000,
  });

  const start = async () => {
    if (!user) {
      toast.error("Sign in to run a live probe");
      return;
    }
    setBusy(true);
    try {
      const res = await run({ data: { ...target, search: search || undefined, scope: "active" } });
      setJobId(res.id);
      toast.success(`Probe queued — ${res.total.toLocaleString()} hosts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start probe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || (job?.status === "running" ?? false)}
        className="label-mono inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
        Probe live hosts
      </button>
      {job && (
        <Link
          to="/live"
          search={{ job: job.id }}
          className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
        >
          <Activity className="size-3" />
          {job.status === "finished"
            ? `${job.live_hosts.toLocaleString()} live of ${job.probed_hosts.toLocaleString()}`
            : `${job.probed_hosts.toLocaleString()} / ${job.total_hosts.toLocaleString()} probed`}
        </Link>
      )}
    </div>
  );
}

type LiveRow = {
  host: string;
  url: string;
  final_url: string | null;
  status_code: number | null;
  title: string | null;
  content_length: number | null;
  response_time_ms: number | null;
  webserver: string | null;
  technologies: string[];
  cdn: string | null;
  ip: string | null;
  asn: string | null;
  probed_at: string;
};

const PRESETS = [
  ["all", "All"],
  ["ok", "200 OK"],
  ["redirect", "Redirects"],
  ["auth", "401/403"],
  ["interesting", "Interesting"],
] as const;

export function LiveHostsPanel({ target }: { target: Target }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number][0]>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const pageFn = useServerFn(liveHostsPage);

  const { data, isFetching } = useQuery({
    queryKey: ["live-hosts", target, preset, search, offset],
    queryFn: () => pageFn({ data: { ...target, preset, search: search || undefined, offset } }),
    refetchInterval: 15000,
  });
  const rows = (data?.rows ?? []) as unknown as LiveRow[];
  const total = data?.total ?? 0;

  const copyAll = async () => {
    try {
      const all = await pageFn({ data: { ...target, preset, search: search || undefined, limit: 500 } });
      await navigator.clipboard.writeText(all.rows.map((r) => r.url).join("\n"));
      toast.success(`Copied ${all.rows.length.toLocaleString()} live URLs`);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setPreset(key);
              setOffset(0);
            }}
            className={`label-mono rounded-full border px-3 py-1.5 transition-colors ${
              preset === key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="search title or host…"
          aria-label="Search live hosts"
          className="w-52 rounded-full border border-input bg-background px-4 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => void copyAll()}
          className="label-mono ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
        >
          <Copy className="size-3" /> Copy URLs
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {isFetching ? "refreshing… " : ""}
        {total.toLocaleString()} live hosts
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card">
            <tr className="label-mono text-muted-foreground">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Host</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Server / CDN</th>
              <th className="px-3 py-2">Tech</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2 text-right">ms</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {rows.map((r) => (
              <tr key={r.url} className="border-t border-border hover:bg-accent/40">
                <td className="px-3 py-1.5">
                  <span
                    className={
                      r.status_code === 200
                        ? "text-emerald-400"
                        : (r.status_code ?? 0) >= 300 && (r.status_code ?? 0) < 400
                          ? "text-amber-400"
                          : "text-red-400"
                    }
                  >
                    {r.status_code ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <a
                    href={r.final_url ?? r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {r.host}
                    <ExternalLink className="size-3 opacity-50" />
                  </a>
                </td>
                <td className="max-w-56 truncate px-3 py-1.5 text-muted-foreground">
                  {r.title ?? ""}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {[r.webserver, r.cdn].filter(Boolean).join(" · ")}
                </td>
                <td className="max-w-40 truncate px-3 py-1.5 text-muted-foreground">
                  {r.technologies.join(", ")}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.ip ?? ""}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {r.response_time_ms ?? ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No live hosts yet — run a probe to check which hosts answer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 100))}
          className="label-mono rounded-full border border-border px-3 py-1.5 disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={offset + 100 >= total}
          onClick={() => setOffset(offset + 100)}
          className="label-mono rounded-full border border-border px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

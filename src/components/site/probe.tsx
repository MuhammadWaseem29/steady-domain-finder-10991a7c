import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, BellRing, Copy, ExternalLink, Loader2, Play, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { createProbeJob, liveHostsPage, probeJobStatus } from "@/lib/probe.functions";
import { createLiveAlert, FREQUENCIES, FREQUENCY_LABELS, type Frequency } from "@/lib/alerts.functions";
import { useSession } from "@/lib/use-session";

type Target = {
  domain?: string | undefined;
  platformSlug?: string | undefined;
  program?: string | undefined;
};

/** "Notify me when hosts go live" — creates an email alert scoped to this target. */
export function LiveAlertButton({ target }: { target: Target }) {
  const { user } = useSession();
  const create = useServerFn(createLiveAlert);
  const [frequency, setFrequency] = useState<Frequency>("hourly");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  const subscribe = async () => {
    if (!user) {
      toast.error("Sign in to get live-host alerts");
      return;
    }
    setBusy(true);
    try {
      const res = await create({
        data: {
          frequency,
          domain: target.domain ?? undefined,
          platformSlug: target.platformSlug ?? undefined,
        },
      });
      setArmed(true);
      toast.success(
        res.reused
          ? "Live-host alert re-enabled"
          : "Alert on — you'll be emailed when subdomains go live",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create alert");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-2 py-1">
      <BellRing className={`ml-1 size-3 ${armed ? "text-primary" : "text-muted-foreground"}`} />
      <select
        aria-label="Alert frequency"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value as Frequency)}
        className="bg-transparent font-mono text-xs text-muted-foreground outline-none"
      >
        {FREQUENCIES.map((f) => (
          <option key={f} value={f} className="bg-card">
            {FREQUENCY_LABELS[f]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void subscribe()}
        disabled={busy}
        className="label-mono inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
        {armed ? "Alert on" : "Notify me"}
      </button>
    </div>
  );
}

export function ProbeEverythingButton() {
  const { user } = useSession();
  const run = useServerFn(createProbeJob);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!user) {
      toast.error("Sign in to run a live probe");
      return;
    }
    setBusy(true);
    try {
      await run({ data: { everything: true, scope: "active" } });
      toast.success("Probing every platform — results appear below as hosts answer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start probe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={busy}
      className="label-mono inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
      Probe every platform
    </button>
  );
}

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
        disabled={busy || job?.status === "running"}
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
  cname: string | null;
  takeover_risk: boolean;
  takeover_service: string | null;
  takeover_evidence: string | null;
  probed_at: string;
};

const PRESETS = [
  ["all", "All"],
  ["ok", "200 OK"],
  ["redirect", "Redirects"],
  ["auth", "401/403"],
  ["interesting", "Interesting"],
  ["takeover", "Takeover risk"],
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
        {total.toLocaleString()} {preset === "takeover" ? "possible takeovers" : "live hosts"}
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card">
            <tr className="label-mono text-muted-foreground">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Host</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Points to</th>
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
                  {r.takeover_risk && (
                    <span
                      title={r.takeover_evidence ?? "Possible subdomain takeover"}
                      className="ml-2 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400"
                    >
                      <ShieldAlert className="size-3" /> takeover?
                    </span>
                  )}
                </td>
                <td className="max-w-56 truncate px-3 py-1.5 text-muted-foreground">
                  {r.title ?? ""}
                </td>
                <td
                  className="max-w-48 truncate px-3 py-1.5 text-muted-foreground"
                  title={r.takeover_evidence ?? r.cname ?? ""}
                >
                  {r.takeover_service ?? r.cname ?? ""}
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
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {preset === "takeover"
                    ? "No takeover candidates found in the hosts probed so far."
                    : "No live hosts yet — run a probe to check which hosts answer."}
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

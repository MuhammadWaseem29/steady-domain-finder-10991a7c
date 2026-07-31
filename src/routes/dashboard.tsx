import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Plus, Loader2 } from "lucide-react";
import { SiteShell, Stat } from "@/components/site/chrome";
import { domainsQuery, timeAgo } from "@/lib/chaos-data";
import { runScanNow, addDomains } from "@/lib/chaos.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Monitor — Chaos subdomain tracking" },
      {
        name: "description",
        content:
          "Track root domains, trigger manual Chaos rescans and watch newly discovered subdomains appear every hour.",
      },
      { property: "og:title", content: "Monitor — Chaos subdomain tracking" },
      {
        property: "og:description",
        content: "Hourly subdomain monitoring dashboard for every tracked root domain.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data: domains, isLoading } = useQuery(domainsQuery);
  const scan = useServerFn(runScanNow);
  const add = useServerFn(addDomains);
  const [input, setInput] = useState("");

  const scanMutation = useMutation({
    mutationFn: (domainId: string) => scan({ data: { domainId } }),
    onSuccess: (res) => {
      if (res.status === "error") toast.error(res.error ?? "Scan failed");
      else toast.success(`Scan complete — ${res.newCount ?? 0} new subdomains`);
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: (domains: string) => add({ data: { domains } }),
    onSuccess: (res) => {
      toast.success(`${res.added} domain(s) queued for scanning`);
      setInput("");
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = domains ?? [];
  const totalSubs = list.reduce((a, d) => a + d.total_subdomains, 0);
  const newSubs = list.reduce((a, d) => a + d.new_subdomains_last_scan, 0);

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-muted-foreground">Dashboard</p>
        <h1 className="mt-2 text-4xl font-extrabold">Subdomain monitor</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every enabled root domain is rescanned automatically every hour. New hosts are diffed
          against everything seen before.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Domains tracked" value={list.length} />
          <Stat label="Subdomains stored" value={totalSubs.toLocaleString()} />
          <Stat label="New last scan" value={newSubs.toLocaleString()} />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="label-mono text-muted-foreground">Add root domains</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="example.com, another.com"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => addMutation.mutate(input)}
              disabled={!input.trim() || addMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Paste the contents of a root_domains.txt file — separated by spaces, commas or new
            lines.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Domain</th>
                <th className="px-5 py-3 font-medium">Subdomains</th>
                <th className="px-5 py-3 font-medium">New</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link
                      to="/domain/$domain"
                      params={{ domain: d.domain }}
                      className="font-mono hover:underline"
                    >
                      {d.domain}
                    </Link>
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {d.total_subdomains.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {d.new_subdomains_last_scan > 0 ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
                        +{d.new_subdomains_last_scan}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={d.last_scan_status} />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {timeAgo(d.last_scanned_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => scanMutation.mutate(d.id)}
                      disabled={scanMutation.isPending}
                      className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {scanMutation.isPending && scanMutation.variables === d.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      Scan
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                    {isLoading ? "Loading…" : "No domains tracked yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SiteShell>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    success: "bg-success/10 text-success",
    running: "bg-brand/10 text-brand",
    error: "bg-destructive/10 text-destructive",
  };
  const cls = map[status ?? ""] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`label-mono rounded-full px-2 py-0.5 ${cls}`}>{status ?? "pending"}</span>
  );
}

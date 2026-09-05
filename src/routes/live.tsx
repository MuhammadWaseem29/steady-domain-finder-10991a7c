import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { SiteShell } from "@/components/site/chrome";
import { LiveHostsPanel, ProbeButton } from "@/components/site/probe";
import { probeJobStatus, recentProbeJobs } from "@/lib/probe.functions";

export const Route = createFileRoute("/live")({
  validateSearch: (search: Record<string, unknown>) => ({
    job: typeof search.job === "string" ? search.job : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live hosts — Chaos Monitor" },
      {
        name: "description",
        content:
          "Live subdomain probe results: status codes, page titles, web servers, technologies, CDN and IPs for hosts that answer right now.",
      },
      { property: "og:title", content: "Live hosts — Chaos Monitor" },
      {
        property: "og:description",
        content: "Which discovered subdomains are alive right now, with status, title, tech and CDN.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { job } = Route.useSearch();
  const jobsFn = useServerFn(recentProbeJobs);
  const statusFn = useServerFn(probeJobStatus);

  const { data: jobs } = useQuery({
    queryKey: ["probe-jobs"],
    queryFn: () => jobsFn({ data: { limit: 20 } }),
    refetchInterval: 5000,
  });
  const { data: current } = useQuery({
    queryKey: ["probe-job", job],
    queryFn: () => statusFn({ data: { jobId: job! } }),
    enabled: !!job,
    refetchInterval: (q) =>
      q.state.data?.status === "finished" || q.state.data?.status === "error" ? false : 3000,
  });

  const target = current?.domain
    ? { domain: current.domain }
    : current?.platform_slug
      ? { platformSlug: current.platform_slug, program: current.program ?? undefined }
      : undefined;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-primary">
          <Activity className="mr-1.5 inline size-3" /> live probing
        </p>
        <h1 className="mt-3 text-4xl font-extrabold">Live hosts</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Real HTTP/HTTPS checks against discovered subdomains — status code, page title, server,
          technologies, CDN and IP for every host that answers.
        </p>

        {current && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="label-mono text-muted-foreground">
                job {current.id.slice(0, 8)} · {current.status}
              </span>
              <span className="font-mono text-xs">
                {current.probed_hosts.toLocaleString()} / {current.total_hosts.toLocaleString()}{" "}
                probed · {current.live_hosts.toLocaleString()} live
              </span>
              {current.total_hosts > 0 && (
                <div className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (current.probed_hosts / current.total_hosts) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="mt-4">
              <LiveHostsPanel target={target ?? {}} />
            </div>
          </div>
        )}

        {!current && (
          <div className="mt-8">
            <h2 className="text-xl font-bold">Recent probes</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-card">
                  <tr className="label-mono text-muted-foreground">
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Probed</th>
                    <th className="px-3 py-2 text-right">Live</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {(jobs ?? []).map((j) => (
                    <tr key={j.id} className="border-t border-border hover:bg-accent/40">
                      <td className="px-3 py-1.5">
                        <a href={`/live?job=${j.id}`} className="hover:underline">
                          {j.platform_slug
                            ? `${j.platform_slug}${j.program ? `/${j.program}` : ""}`
                            : (j.domain_id ?? "").slice(0, 8)}
                        </a>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{j.status}</td>
                      <td className="px-3 py-1.5 text-right">
                        {j.probed_hosts.toLocaleString()} / {j.total_hosts.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right text-emerald-400">
                        {j.live_hosts.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {(jobs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No probes yet — open a program or domain page and hit “Probe live hosts”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <LiveHostsPanel target={{}} />
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}

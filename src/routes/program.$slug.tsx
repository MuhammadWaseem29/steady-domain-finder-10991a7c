import { LiveTime } from "@/components/site/live-time";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteShell, Stat } from "@/components/site/chrome";
import { LiveHostsPanel, ProbeButton } from "@/components/site/probe";
import { domainsPageQuery, platformsQuery, platformLiveStatsQuery, timeAgo, PAGE_SIZE } from "@/lib/chaos-data";
import { addDomains } from "@/lib/chaos.functions";

export const Route = createFileRoute("/program/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} scope — Chaos subdomain monitor` },
      {
        name: "description",
        content: `Root domains and discovered subdomains tracked for the ${params.slug} bug bounty platform, rescanned hourly.`,
      },
      { property: "og:title", content: `${params.slug} scope — Chaos subdomain monitor` },
      {
        property: "og:description",
        content: `Hourly subdomain recon for every ${params.slug} root domain.`,
      },
    ],
  }),
  component: ProgramDetail,
});

function ProgramDetail() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");

  const { data: platforms } = useQuery(platformsQuery);
  const platform = (platforms ?? []).find((p) => p.slug === slug);
  const { data: liveStats } = useQuery(platformLiveStatsQuery);
  const live = (liveStats ?? []).find((s) => s.platform_id === platform?.platform_id);
  const { data: pageData, isLoading } = useQuery({
    ...domainsPageQuery(search, page, platform?.platform_id),
    enabled: Boolean(platform?.platform_id),
  });

  const add = useServerFn(addDomains);
  const addMutation = useMutation({
    mutationFn: (domains: string) => add({ data: { domains, platformSlug: slug } }),
    onSuccess: (res) => {
      toast.success(`${res.added} domain(s) added to ${platform?.name ?? slug}`);
      setInput("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const copyAll = async () => {
    const res = await fetch(`/api/public/export?platform=${slug}&scope=all`);
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${text.trim() ? text.trim().split("\n").length : 0} hosts`);
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Link
          to="/programs"
          className="label-mono inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> All programs
        </Link>

        <h1 className="mt-4 text-4xl font-extrabold">{platform?.name ?? slug}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Root domains in this program's scope. Every one is rescanned on the rolling hourly cycle.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Domains" value={Number(platform?.domain_count ?? 0).toLocaleString()} index={0} />
          <Stat
            label="Subdomains"
            value={Number(platform?.subdomain_count ?? 0).toLocaleString()}
            index={1}
          />
          <Stat label="New (24h)" value={Number(platform?.new_24h ?? 0).toLocaleString()} index={2} />
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="label-mono text-muted-foreground">Add root domains to this program</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              placeholder={"example.com\nanother.com"}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => addMutation.mutate(input)}
              disabled={!input.trim() || addMutation.isPending}
              className="inline-flex h-fit items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
            One or many — separated by new lines, spaces or commas.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Scope</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyAll}
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              <Copy className="size-3" /> Copy all subs
            </button>
            <a
              href={`/api/public/export?platform=${slug}&scope=all`}
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              Download .txt
            </a>
            <a
              href={`/raw/${slug}`}
              className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
            >
              Raw list
            </a>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="search domains…"
                className="w-56 rounded-full border border-input bg-background py-2 pr-4 pl-9 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Domain</th>
                <th className="px-5 py-3 font-medium">Subdomains</th>
                <th className="px-5 py-3 font-medium">New last scan</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
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
                  <td className="px-5 py-3 tabular-nums">{d.total_subdomains.toLocaleString()}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {d.new_subdomains_last_scan > 0 ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
                        +{d.new_subdomains_last_scan}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground"><LiveTime iso={d.last_scanned_at} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>
                    {isLoading ? "Loading…" : "No domains in this program yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {pages.toLocaleString()} · {total.toLocaleString()} domains
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="label-mono inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-3" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => (p + 1 < pages ? p + 1 : p))}
              disabled={page + 1 >= pages}
              className="label-mono inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-40"
            >
              Next <ChevronRight className="size-3" />
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Live hosts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Probe every host in this program with real HTTP/HTTPS requests.
            </p>
          </div>
          <ProbeButton target={{ platformSlug: slug }} />
        </div>
        <div className="mt-4">
          <LiveHostsPanel target={{ platformSlug: slug }} />
        </div>
      </div>
    </SiteShell>
  );
}

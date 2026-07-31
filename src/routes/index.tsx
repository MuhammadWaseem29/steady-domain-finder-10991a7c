import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe, Boxes, Radar, ArrowRight } from "lucide-react";
import { SiteShell, Terminal, Stat } from "@/components/site/chrome";
import {
  globalStatsQuery,
  recentSubdomainsQuery,
  domainsPageQuery,
  timeAgo,
} from "@/lib/chaos-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chaos — The Internet Database" },
      {
        name: "description",
        content:
          "A live, continuously updated subdomain dataset. Chaos rescans every tracked root domain hourly and surfaces newly discovered hosts instantly.",
      },
      { property: "og:title", content: "Chaos — The Internet Database" },
      {
        property: "og:description",
        content:
          "Hourly subdomain monitoring built on the Chaos DNS dataset. Track new hosts, copy and export results.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: stats } = useQuery(globalStatsQuery);
  const { data: recent } = useQuery(recentSubdomainsQuery(20));
  const { data: top } = useQuery(domainsPageQuery("", 0));

  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 text-center sm:pt-28">
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold sm:text-7xl">
          The Internet Database.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          A live, continuously updated API providing comprehensive internet data, including
          real-time DNS entries across the entire web — rescanned every hour.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            View Data
          </Link>
          <Link
            to="/docs/api-key"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get API Key <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid overflow-hidden rounded-2xl border border-border md:grid-cols-2">
          <Feature
            icon={<Globe className="size-4 text-brand" />}
            title="What"
            body="A DNS dataset that assists security professionals with efficient reconnaissance and vulnerability assessment across every tracked root domain."
          />
          <Feature
            icon={<Boxes className="size-4 text-success" />}
            title="Why"
            body="It empowers researchers with actionable data to enhance internet security and streamline vulnerability identification — with change tracking over time."
          />
          <div className="border-t border-border p-6 md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg border border-border bg-background">
                <Radar className="size-4 text-brand" />
              </span>
              <span className="label-mono">How</span>
            </div>
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              Chaos ingests live certificate streams and uses techniques like DNS PTR lookups, TLS
              grabs, HTTP header collection and IPv4 scanning. This monitor pulls that dataset for
              every tracked root domain, stores each host it has ever seen, and diffs every run so
              newly appearing subdomains stand out immediately.
            </p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Terminal>
                {`GET /dns/{domain}/subdomains
Host: dns.projectdiscovery.io
Authorization: API_KEY

{"domain":"...","subdomains":[...],"count":N}`}
              </Terminal>
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Root domains" value={(stats?.domains ?? 0).toLocaleString()} />
                <Stat label="Domains scanned" value={(stats?.scanned ?? 0).toLocaleString()} />
                <Stat label="Subdomains stored" value={(stats?.subdomains ?? 0).toLocaleString()} />
                <Stat label="New (24h)" value={(stats?.newLast24h ?? 0).toLocaleString()} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <p className="label-mono text-muted-foreground">Live feed</p>
        <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Recently added subdomains</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The newest hosts discovered across every monitored root domain.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {(recent ?? []).map((s) => (
            <Link
              key={s.id}
              to="/domain/$domain"
              params={{ domain: s.domains?.domain ?? "" }}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-2.5 transition-colors hover:bg-accent"
            >
              <span className="truncate font-mono text-sm">{s.host}</span>
              <span className="label-mono shrink-0 text-muted-foreground">
                {timeAgo(s.first_seen_at)}
              </span>
            </Link>
          ))}
          {(recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No subdomains discovered yet.</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <p className="label-mono text-muted-foreground">Recon data</p>
        <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Largest monitored domains</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every root domain is rescanned on a rolling hourly cycle. Open one to browse, copy or
          export its subdomains.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Domain</th>
                <th className="px-5 py-3 font-medium">Subdomains</th>
                <th className="px-5 py-3 font-medium">New last scan</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(top?.rows ?? []).slice(0, 15).map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-5 py-3 font-mono">{d.domain}</td>
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
                  <td className="px-5 py-3 text-muted-foreground">
                    {timeAgo(d.last_scanned_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to="/domain/$domain"
                      params={{ domain: d.domain }}
                      className="label-mono rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {(top?.rows ?? []).length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>
                    No domains tracked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-center">
          <Link
            to="/dashboard"
            className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 transition-colors hover:bg-accent"
          >
            See all {(stats?.domains ?? 0).toLocaleString()} domains <ArrowRight className="size-3" />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="border-border bg-card p-6 md:not-last:border-r">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg border border-border bg-background">
          {icon}
        </span>
        <span className="label-mono">{title}</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe, Boxes, Radar, ArrowRight } from "lucide-react";
import { SiteShell, Terminal, Stat } from "@/components/site/chrome";
import { domainsQuery, timeAgo } from "@/lib/chaos-data";

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
  const { data: domains } = useQuery(domainsQuery);
  const totalSubs = (domains ?? []).reduce((acc, d) => acc + d.total_subdomains, 0);
  const newSubs = (domains ?? []).reduce((acc, d) => acc + d.new_subdomains_last_scan, 0);

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
              each tracked root domain every hour, stores every host it has ever seen, and diffs
              each run so newly appearing subdomains stand out immediately.
            </p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Terminal>
                {`GET /dns/lovable.app/subdomains
Host: dns.projectdiscovery.io
Authorization: API_KEY

{"domain":"lovable.app","subdomains":[...],"count":${totalSubs || 0}}`}
              </Terminal>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Domains tracked" value={(domains ?? []).length} />
                <Stat label="Subdomains stored" value={totalSubs.toLocaleString()} />
                <Stat label="New last scan" value={newSubs.toLocaleString()} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <p className="label-mono text-muted-foreground">Recon data</p>
        <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Monitored root domains</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every domain below is rescanned automatically each hour. Open one to browse, copy or
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
              {(domains ?? []).map((d) => (
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
              {(domains ?? []).length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>
                    No domains tracked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

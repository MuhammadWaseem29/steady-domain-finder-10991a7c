import { LiveTime } from "@/components/site/live-time";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Globe, Boxes, Radar, ArrowRight } from "lucide-react";
import { SiteShell, Terminal, Stat, Reveal } from "@/components/site/chrome";
import {
  globalStatsQuery,
  recentSubdomainsQuery,
  domainsPageQuery,
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
          "A live, continuously updated subdomain dataset. Chaos rescans every tracked root domain hourly and surfaces newly discovered hosts instantly.",
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
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="chip-mono mx-auto mb-6 w-fit"
        >
          <span className="live-dot" /> live · rescanned every 30 minutes
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-5xl font-extrabold sm:text-7xl"
        >
          The Internet Database.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          A live, continuously updated API providing comprehensive internet data, including
          real-time DNS entries across the entire web — rescanned every hour.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/dashboard"
            className="hover-lift rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            View Data
          </Link>
          <Link
            to="/docs/api-key"
            className="group hover-lift inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get API Key{" "}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>


      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid overflow-hidden rounded-lg border border-border md:grid-cols-2">
          <Feature
            icon={<Globe className="size-4 text-destructive" />}
            tone="bg-destructive/10"
            title="What"
            body="A DNS dataset that assists security professionals with efficient reconnaissance and vulnerability assessment across every tracked root domain."
          />
          <Feature
            icon={<Boxes className="size-4 text-success" />}
            tone="bg-success/10"
            title="Why"
            body="It empowers researchers with actionable data to enhance internet security and streamline vulnerability identification — with change tracking over time."
          />
          <div className="border-t border-border p-6 md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg border border-border bg-brand/10">
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
        <Reveal>
          <p className="label-mono text-muted-foreground">Live feed</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Recently added subdomains</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The newest hosts discovered across every monitored root domain.
          </p>
        </Reveal>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {(recent ?? []).map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
            >
              <Link
                to="/domain/$domain"
                params={{ domain: s.domains?.domain ?? "" }}
                className="hover-lift flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent"
              >
                <span className="truncate font-mono text-sm">{s.host}</span>
                <span className="label-mono shrink-0 text-muted-foreground">
                  <LiveTime iso={s.first_seen_at} />
                </span>
              </Link>
            </motion.div>
          ))}
          {(recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No subdomains discovered yet.</p>
          )}
        </div>

      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Reveal>
          <p className="label-mono text-muted-foreground">Recon data</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Largest monitored domains</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every root domain is rescanned on a rolling hourly cycle. Open one to browse, copy or
            export its subdomains.
          </p>
        </Reveal>

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
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
                <tr
                  key={d.id}
                  className="border-t border-border transition-colors hover:bg-accent/50"
                >

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
                    <LiveTime iso={d.last_scanned_at} />
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
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group border-border bg-card p-6 transition-colors hover:bg-accent/40 md:not-last:border-r"
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-8 place-items-center rounded-lg border border-border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${tone}`}
        >
          {icon}
        </span>
        <span className="label-mono">{title}</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{body}</p>
    </motion.div>
  );

}


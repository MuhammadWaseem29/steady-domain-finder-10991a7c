import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Terminal as TerminalIcon, Zap, Database, KeyRound } from "lucide-react";
import { SiteShell, Reveal, Stat } from "@/components/site/chrome";
import { globalStatsQuery } from "@/lib/chaos-data";
import { RATE_LIMIT_PER_MINUTE } from "@/lib/api-spec";

const BASE = "https://chaos.thescope.top/api/v1";

const TITLE = "Free Subdomain Finder API — live subdomain enumeration data";
const DESCRIPTION =
  "A free subdomain enumeration API: query millions of continuously discovered subdomains, newly found hosts, bug bounty program scopes and bulk exports over a simple REST endpoint.";

export const Route = createFileRoute("/subdomain-finder-api")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebAPI",
          name: "Chaos Subdomain Finder API",
          description: DESCRIPTION,
          documentation: "https://chaos.thescope.top/docs/api",
          url: "https://chaos.thescope.top/subdomain-finder-api",
          provider: { "@type": "Organization", name: "Chaos Subdomain Monitor" },
        }),
      },
    ],
  }),
  component: SubdomainFinderApi,
});

const SNIPPETS: { id: string; label: string; code: string }[] = [
  {
    id: "curl",
    label: "curl",
    code: `curl "${BASE}/domains/lovable.app/subdomains?limit=5" \\
  -H "Authorization: Bearer chs_live_xxxxxxxxxxxx"`,
  },
  {
    id: "python",
    label: "Python",
    code: `import requests

r = requests.get(
    "${BASE}/domains/lovable.app/subdomains",
    params={"limit": 5, "filter": "new"},
    headers={"Authorization": "Bearer chs_live_xxxxxxxxxxxx"},
    timeout=30,
)
for row in r.json()["data"]:
    print(row["host"])`,
  },
  {
    id: "node",
    label: "Node.js",
    code: `const res = await fetch(
  "${BASE}/domains/lovable.app/subdomains?limit=5",
  { headers: { Authorization: \`Bearer \${process.env.CHAOS_TOKEN}\` } },
);
const { data, meta } = await res.json();
console.log(meta.total, data.map((r) => r.host));`,
  },
];

const RESPONSE = `{
  "data": [
    { "host": "api.lovable.app",        "first_seen_at": "2026-08-19T04:12:07Z", "is_new": true },
    { "host": "id-preview.lovable.app", "first_seen_at": "2026-08-19T03:41:55Z", "is_new": true },
    { "host": "cdn.lovable.app",        "first_seen_at": "2026-07-02T11:08:31Z", "is_new": false }
  ],
  "meta": { "domain": "lovable.app", "limit": 5, "offset": 0, "total": 9948 }
}`;

const ENDPOINTS: { method: string; path: string; desc: string }[] = [
  { method: "GET", path: "/domains", desc: "Every tracked root domain with live subdomain counts." },
  { method: "GET", path: "/domains/{domain}", desc: "One domain: totals, new in 24h / 7d, active and inactive hosts." },
  {
    method: "GET",
    path: "/domains/{domain}/subdomains",
    desc: "Paged host list, newest first. Filter all / new / inactive, or search by pattern.",
  },
  { method: "GET", path: "/subdomains/new", desc: "Everything discovered in the last hour, day, week or month across all domains." },
  { method: "GET", path: "/subdomains/search", desc: "Pattern search across the whole dataset (vpn, staging, admin, …)." },
  { method: "GET", path: "/platforms", desc: "HackerOne, Bugcrowd, Intigriti, YesWeHack and self-hosted program scopes." },
  { method: "GET", path: "/scans", desc: "Scan history per domain: started, hosts returned, new, removed, status." },
  { method: "GET", path: "/export", desc: "Streaming bulk export of any scope as plain text or JSON." },
];

function SubdomainFinderApi() {
  const { data: stats } = useQuery(globalStatsQuery);
  const [tab, setTab] = useState("curl");
  const snippet = SNIPPETS.find((s) => s.id === tab) ?? SNIPPETS[0]!;

  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-grid absolute -inset-24 opacity-70 [mask-image:radial-gradient(60%_55%_at_50%_35%,black,transparent)]" />
          <div className="aurora-blob absolute -top-20 left-1/3 size-96 rounded-full bg-brand/20" />
        </div>
        <div className="mx-auto max-w-6xl px-5 pt-20 pb-12">
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="chip-mono w-fit"
          >
            <span className="live-dot" /> free tier · no credit card
          </motion.p>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold sm:text-6xl">
            Free subdomain finder API
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Query a continuously refreshed subdomain enumeration dataset over plain REST. Every
            tracked root domain is rescanned on a rolling cycle, newly appearing hosts are diffed
            out, and the whole thing is one <code className="font-mono text-foreground">curl</code>{" "}
            away.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/docs/api-key"
              className="group hover-lift inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Get a free API key
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/docs/api"
              className="hover-lift rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Full API reference
            </Link>
            <Link
              to="/recentsubs"
              className="hover-lift rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Browse live results
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Root domains" value={stats?.domains ?? 0} index={0} />
            <Stat label="Subdomains stored" value={stats?.subdomains ?? 0} index={1} />
            <Stat label="Domains scanned" value={stats?.scanned ?? 0} index={2} />
            <Stat label="New (24h)" value={stats?.newLast24h ?? 0} index={3} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <Reveal>
          <p className="label-mono text-muted-foreground">Quickstart</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">One request, every host</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create a token on your account page, send it as a bearer header, and read a plain{" "}
            <code className="font-mono text-foreground">{`{ data, meta }`}</code> JSON body.
          </p>
        </Reveal>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div
              role="tablist"
              aria-label="Code examples"
              className="flex gap-1 border-b border-border p-2"
            >
              {SNIPPETS.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={tab === s.id}
                  onClick={() => setTab(s.id)}
                  className={`label-mono rounded-full px-3 py-1.5 transition-colors ${
                    tab === s.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">{snippet.code}</pre>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <TerminalIcon className="size-4 text-brand" />
              <span className="label-mono text-muted-foreground">200 OK · application/json</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">{RESPONSE}</pre>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <Reveal>
          <p className="label-mono text-muted-foreground">Endpoints</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">What the API returns</h2>
        </Reveal>
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="label-mono text-muted-foreground">
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Endpoint</th>
                <th className="px-5 py-3 font-medium">Returns</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="row-sweep border-t border-border hover:bg-accent/50">
                  <td className="px-5 py-3">
                    <span className="label-mono rounded-full bg-success/10 px-2 py-0.5 text-success">
                      {e.method}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono">{e.path}</td>
                  <td className="px-5 py-3 text-muted-foreground">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Full parameters, cursor pagination and an interactive test console live in the{" "}
          <Link to="/docs/api" className="story-link text-foreground">
            API reference
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<KeyRound className="size-4 text-brand" />}
            title="Auth"
            body={
              <>
                Bearer tokens shaped{" "}
                <code className="font-mono text-foreground">chs_live_…</code>, created free on your
                account page. Read scope by default; write scope only for scan triggers.
              </>
            }
          />
          <InfoCard
            icon={<Zap className="size-4 text-success" />}
            title="Rate limits"
            body={
              <>
                {RATE_LIMIT_PER_MINUTE} requests per minute per token, with remaining budget
                returned on every response. Bulk work belongs on{" "}
                <code className="font-mono text-foreground">/export</code>, which streams instead of
                paging.
              </>
            }
          />
          <InfoCard
            icon={<Database className="size-4 text-destructive" />}
            title="Freshness"
            body={
              <>
                Every root domain is rescanned on a rolling two-hour cycle and each run is diffed,
                so <code className="font-mono text-foreground">is_new</code> means genuinely new —
                not just newly returned.
              </>
            }
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Start enumerating in a minute</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Create an account, mint a token, and point it at any of the tracked root domains — or
            explore the same data in the browser first.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="hover-lift rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Create a free account
            </Link>
            <Link
              to="/dashboard"
              className="hover-lift rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Explore the dataset
            </Link>
            <Link
              to="/programs"
              className="hover-lift rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Bug bounty scopes
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg border border-border">
          {icon}
        </span>
        <span className="label-mono">{title}</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{body}</p>
    </motion.div>
  );
}

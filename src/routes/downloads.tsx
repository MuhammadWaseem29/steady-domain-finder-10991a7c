import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { SiteShell } from "@/components/site/chrome";
import { CountUp, EASE_SIGNATURE, Spotlight } from "@/components/site/motion";
import { platformsQuery, type PlatformStat } from "@/lib/chaos-data";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — root domains & subdomain lists" },
      {
        name: "description",
        content:
          "Download every tracked bug bounty root domain and subdomain list as TXT, CSV or JSON — per platform or all platforms at once, no login required.",
      },
      { property: "og:title", content: "Downloads — root domains & subdomain lists" },
      {
        property: "og:description",
        content:
          "Free plain-text, CSV and JSON dumps of all tracked root domains and discovered subdomains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadsPage,
});

const FORMATS = ["txt", "csv", "json"] as const;
type Format = (typeof FORMATS)[number];

const SCOPES = [
  { key: "all", label: "All subs", scope: "all", hours: 0 },
  { key: "new24", label: "New 24h", scope: "new", hours: 24 },
  { key: "new7d", label: "New 7d", scope: "new", hours: 168 },
  { key: "inactive", label: "Inactive", scope: "inactive", hours: 0 },
  { key: "live", label: "Live only", scope: "live", hours: 0 },
] as const;
type ScopeKey = (typeof SCOPES)[number]["key"];

function fmt(n: number) {
  return n.toLocaleString();
}

function Pills<T extends string>({
  value,
  options,
  onChange,
  upper,
}: {
  value: T;
  options: ReadonlyArray<{ key: T; label: string }>;
  onChange: (v: T) => void;
  upper?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`label-mono rounded-full border px-2.5 py-1 transition-colors ${upper ? "uppercase" : ""} ${
            value === o.key
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:bg-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CardShell({
  title,
  subtitle,
  color,
  children,
}: {
  title: string;
  subtitle: string;
  color?: string | null;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_SIGNATURE }}
    >
      <Spotlight className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: color ?? "hsl(var(--primary))" }}
              />
              {title}
            </h3>
            <p className="label-mono mt-1 text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {children}
      </Spotlight>
    </motion.div>
  );
}

function UrlRow({ url }: { url: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <code className="truncate font-mono text-[11px] text-muted-foreground">{url}</code>
      <button
        aria-label="Copy link"
        onClick={() => {
          navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
          toast.success("Link copied");
        }}
        className="ml-auto shrink-0 rounded p-1 hover:bg-accent"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

async function copyList(url: string) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) throw new Error("Download failed");
    if (text.includes("# error") || text.includes("# export error"))
      throw new Error("Export failed");
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${text.trim() ? text.trim().split("\n").length : 0} lines`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Copy failed");
  }
}

function Actions({ url }: { url: string }) {
  const [copying, setCopying] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <a
        href={url}
        className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-colors hover:bg-accent"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </a>
      <button
        disabled={copying}
        onClick={async () => {
          setCopying(true);
          await copyList(url.replace(/format=(csv|json)/, "format=txt"));
          setCopying(false);
        }}
        className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-50"
      >
        <Copy className="h-3.5 w-3.5" />
        {copying ? "Copying…" : "Copy"}
      </button>
    </div>
  );
}

function RootCard({ p }: { p: PlatformStat | null }) {
  const [format, setFormat] = useState<Format>("txt");
  const slug = p?.slug ?? "";
  const url = `/api/public/roots?${slug ? `platform=${slug}&` : ""}format=${format}`;
  return (
    <CardShell
      title={p?.name ?? "All platforms"}
      subtitle={p ? `${fmt(Number(p.domain_count))} root domains` : "every tracked root domain"}

      color={p?.color ?? null}
    >
      <div className="mt-4">
        <Pills
          upper
          value={format}
          onChange={setFormat}
          options={FORMATS.map((f) => ({ key: f, label: f }))}
        />
        <Actions url={url} />
        <UrlRow url={url} />
      </div>
    </CardShell>
  );
}

function SubCard({ p }: { p: PlatformStat | null }) {
  const [format, setFormat] = useState<Format>("txt");
  const [scopeKey, setScopeKey] = useState<ScopeKey>("all");
  const slug = p?.slug ?? "";
  const scope = SCOPES.find((s) => s.key === scopeKey)!;

  const url =
    scope.scope === "live"
      ? slug
        ? `/raw/${slug}?scope=live&format=${format}`
        : `/raw/mainlive.txt?format=${format}`
      : `/api/public/export?${slug ? `platform=${slug}&` : ""}scope=${scope.scope}&hours=${scope.hours}&format=${format}`;

  return (
    <CardShell
      title={p?.name ?? "All platforms"}
      subtitle={
        p
          ? `${fmt(Number(p.subdomain_count))} subdomains · ${fmt(Number(p.new_24h))} new 24h`
          : "every subdomain we have discovered"
      }
      color={p?.color ?? null}
    >
      <div className="mt-4 space-y-3">
        <Pills
          value={scopeKey}
          onChange={setScopeKey}
          options={SCOPES.map((s) => ({ key: s.key, label: s.label }))}
        />
        <Pills
          upper
          value={format}
          onChange={setFormat}
          options={FORMATS.map((f) => ({ key: f, label: f }))}
        />
        <Actions url={url} />
        <UrlRow url={url} />
      </div>
    </CardShell>
  );
}

function DownloadsPage() {
  const { data: platforms } = useQuery(platformsQuery);
  const list = platforms ?? [];
  const totalDomains = list.reduce((a, p) => a + Number(p.domain_count), 0);
  const totalSubs = list.reduce((a, p) => a + Number(p.subdomain_count), 0);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_SIGNATURE }}
        >
          <h1 className="text-3xl font-semibold tracking-tight">Downloads</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Grab the full data sets as files — {fmt(totalDomains)} root domains and{" "}
            {fmt(totalSubs)} subdomains across every platform. No login, no token: every link
            below works in a browser or with curl.
          </p>
        </motion.div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Root domains</h2>
          <p className="label-mono mt-1 text-muted-foreground">
            One root domain per line — the scope list we scan.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RootCard p={null} />
            {list.map((p) => (
              <RootCard key={p.platform_id} p={p} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Subdomains</h2>
          <p className="label-mono mt-1 text-muted-foreground">
            Every discovered host — pick a scope and a format. Large platforms stream.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SubCard p={null} />
            {list.map((p) => (
              <SubCard key={p.platform_id} p={p} />
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

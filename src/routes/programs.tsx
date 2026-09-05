import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Copy, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, Stat } from "@/components/site/chrome";
import { SignInNotice } from "@/components/site/chrome";
import { CountUp, EASE_SIGNATURE, Spotlight } from "@/components/site/motion";
import { platformsQuery, platformLiveStatsQuery } from "@/lib/chaos-data";
import { savePlatform, deletePlatform } from "@/lib/chaos.functions";


export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Bug bounty programs — Chaos subdomain monitor" },
      {
        name: "description",
        content:
          "Browse tracked bug bounty platforms — HackerOne, Bugcrowd, Intigriti, YesWeHack and self-hosted — with domain and subdomain counts per program.",
      },
      { property: "og:title", content: "Bug bounty programs — Chaos subdomain monitor" },
      {
        property: "og:description",
        content: "Per-platform subdomain recon across HackerOne, Bugcrowd, Intigriti and more.",
      },
    ],
  }),
  component: Programs,
});

type Draft = { id?: string; name: string; slug: string; color: string; website: string };

function Programs() {
  const qc = useQueryClient();
  const { data: platforms } = useQuery(platformsQuery);
  const { data: liveStats } = useQuery(platformLiveStatsQuery);
  const liveByPlatform = new Map((liveStats ?? []).map((s) => [s.platform_id, s]));
  const list = platforms ?? [];
  const [editing, setEditing] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const save = useServerFn(savePlatform);
  const remove = useServerFn(deletePlatform);

  const saveMutation = useMutation({
    mutationFn: (draft: Draft) => save({ data: draft }),
    onSuccess: (res) => {
      toast.success(res.updated ? "Program updated" : "Program created");
      setEditing(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (v: { id: string; deleteDomains: boolean }) => remove({ data: v }),
    onSuccess: () => {
      toast.success("Program deleted");
      setRemoving(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const totals = list.reduce(
    (acc, p) => ({
      domains: acc.domains + Number(p.domain_count),
      subs: acc.subs + Number(p.subdomain_count),
      new24: acc.new24 + Number(p.new_24h),
    }),
    { domains: 0, subs: 0, new24: 0 },
  );

  return (
    <SiteShell>
      <SignInNotice />
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-muted-foreground">Programs</p>
        <h1 className="mt-2 text-4xl font-extrabold">Bug bounty platforms</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each platform holds its own set of root domains. Add scope to a platform and every
          domain joins the same rolling hourly scan cycle.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Platforms" value={list.length} index={0} />
          <Stat label="Domains assigned" value={totals.domains} index={1} />
          <Stat label="New (24h)" value={totals.new24} index={2} />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label-mono text-muted-foreground">
              {editing ? (editing.id ? "Edit program" : "New program") : "Manage programs"}
            </p>
            {editing ? (
              <button
                onClick={() => setEditing(null)}
                className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
              >
                <X className="size-3" /> Cancel
              </button>
            ) : (
              <button
                onClick={() => setEditing({ name: "", slug: "", color: "", website: "" })}
                className="label-mono inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="size-3" /> New program
              </button>
            )}
          </div>

          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(editing);
              }}
              className="mt-4 grid gap-3 md:grid-cols-4"
            >
              <input
                value={editing.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setEditing((d) =>
                    d
                      ? {
                          ...d,
                          name,
                          slug: d.id
                            ? d.slug
                            : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                        }
                      : d,
                  );
                }}
                placeholder="Program name"
                required
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={editing.slug}
                onChange={(e) => setEditing((d) => (d ? { ...d, slug: e.target.value } : d))}
                placeholder="slug"
                required
                className="rounded-lg border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={editing.website}
                onChange={(e) => setEditing((d) => (d ? { ...d, website: e.target.value } : d))}
                placeholder="https://program.site (optional)"
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editing.id ? "Save changes" : "Create program"}
              </button>
            </form>
          )}

          {removing && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm">
                Delete <span className="font-mono font-semibold">{removing.name}</span>? Choose what
                happens to its root domains.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    removeMutation.mutate({ id: removing.id, deleteDomains: false })
                  }
                  disabled={removeMutation.isPending}
                  className="label-mono rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Delete program, keep domains
                </button>
                <button
                  onClick={() => removeMutation.mutate({ id: removing.id, deleteDomains: true })}
                  disabled={removeMutation.isPending}
                  className="label-mono rounded-full bg-destructive px-3 py-1.5 text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Delete program + all its domains
                </button>
                <button
                  onClick={() => setRemoving(null)}
                  className="label-mono rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>



        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {list.map((p, i) => (
            <motion.div
              key={p.platform_id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: EASE_SIGNATURE }}
              className="rounded-lg border border-border bg-card transition-colors hover:border-primary/50 hover:shadow-lg hover:shadow-foreground/5"
            >
              <Spotlight className="rounded-lg p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{p.name}</h2>
                  <p className="label-mono text-muted-foreground">{p.slug}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setEditing({
                        id: p.platform_id,
                        name: p.name,
                        slug: p.slug,
                        color: p.color ?? "",
                        website: "",
                      })
                    }
                    aria-label={`Edit ${p.name}`}
                    className="grid size-8 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setRemoving({ id: p.platform_id, name: p.name })}
                    aria-label={`Delete ${p.name}`}
                    className="grid size-8 place-items-center rounded-full border border-border text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <Link
                    to="/program/$slug"
                    params={{ slug: p.slug }}
                    className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
                  >
                    Open <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="label-mono text-muted-foreground">Domains</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    <CountUp value={Number(p.domain_count)} />
                  </p>
                </div>
                <div>
                  <p className="label-mono text-muted-foreground">Subdomains</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    <CountUp value={Number(p.subdomain_count)} />
                  </p>
                </div>
                <div>
                  <p className="label-mono text-muted-foreground">New 24h</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-success">
                    +<CountUp value={Number(p.new_24h)} />
                  </p>
                </div>
              </div>
              <PlatformDownloads slug={p.slug} />

              </Spotlight>
            </motion.div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

const SCOPES = [
  { key: "all", label: "All subs", hours: 0 },
  { key: "new1", label: "New 1h", hours: 1 },
  { key: "new24", label: "New 24h", hours: 24 },
  { key: "new7d", label: "New 7d", hours: 168 },
  { key: "inactive", label: "Inactive", hours: 0 },
] as const;

const FORMATS = ["txt", "csv", "json"] as const;

function PlatformDownloads({ slug }: { slug: string }) {
  const [scopeKey, setScopeKey] = useState<(typeof SCOPES)[number]["key"]>("all");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("txt");
  const [copying, setCopying] = useState(false);

  const scope = SCOPES.find((s) => s.key === scopeKey)!;
  const apiScope = scopeKey === "all" ? "all" : scopeKey === "inactive" ? "inactive" : "new";
  const base = `/api/public/export?platform=${slug}&scope=${apiScope}&hours=${scope.hours}`;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScopeKey(s.key)}
            className={`label-mono rounded-full border px-2.5 py-1 transition-colors ${
              scopeKey === s.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FORMATS.map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`label-mono rounded-full border px-2.5 py-1 uppercase transition-colors ${
              format === f
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-accent"
            }`}
          >
            {f}
          </button>
        ))}
        <a
          href={`${base}&format=${format}`}
          className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-colors hover:bg-accent"
        >
          Download
        </a>
        <button
          disabled={copying}
          onClick={async () => {
            setCopying(true);
            try {
              const res = await fetch(`${base}&format=txt`);
              const text = await res.text();
              if (text.includes("# export error")) throw new Error("Export failed");
              await navigator.clipboard.writeText(text);
              toast.success(
                `Copied ${text.trim() ? text.trim().split("\n").length : 0} hosts`,
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Copy failed");
            } finally {
              setCopying(false);
            }
          }}
          className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-50"
        >
          {copying ? <Loader2 className="size-3 animate-spin" /> : <Copy className="size-3" />} Copy
        </button>
      </div>
    </div>
  );
}


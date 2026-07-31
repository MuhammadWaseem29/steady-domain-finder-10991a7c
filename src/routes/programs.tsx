import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Copy, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, Stat } from "@/components/site/chrome";
import { platformsQuery } from "@/lib/chaos-data";
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
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label-mono text-muted-foreground">Programs</p>
        <h1 className="mt-2 text-4xl font-extrabold">Bug bounty platforms</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each platform holds its own set of root domains. Add scope to a platform and every
          domain joins the same rolling hourly scan cycle.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Platforms" value={list.length} index={0} />
          <Stat label="Domains assigned" value={totals.domains.toLocaleString()} index={1} />
          <Stat label="New (24h)" value={totals.new24.toLocaleString()} index={2} />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {list.map((p, i) => (
            <motion.div
              key={p.platform_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50"
            >
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
                    {Number(p.domain_count).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="label-mono text-muted-foreground">Subdomains</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {Number(p.subdomain_count).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="label-mono text-muted-foreground">New 24h</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-success">
                    +{Number(p.new_24h).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/api/public/export?platform=${p.slug}&scope=all`}
                  className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
                >
                  Download all
                </a>
                <a
                  href={`/api/public/export?platform=${p.slug}&scope=new&hours=24`}
                  className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
                >
                  Download new 24h
                </a>
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/public/export?platform=${p.slug}&scope=new&hours=24`);
                    const text = await res.text();
                    await navigator.clipboard.writeText(text);
                    toast.success(`Copied ${text.trim() ? text.trim().split("\n").length : 0} hosts`);
                  }}
                  className="label-mono inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-accent"
                >
                  <Copy className="size-3" /> Copy new
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

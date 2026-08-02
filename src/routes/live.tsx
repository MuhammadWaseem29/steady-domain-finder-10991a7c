import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Check,
  Copy,
  Download,
  Globe,
  Loader2,
  Radio,
  Search,
  Trash2,
} from "lucide-react";

import { Reveal, SiteShell, Stat } from "@/components/site/chrome";
import { EASE_SIGNATURE, Skeleton } from "@/components/site/motion";
import { useSession } from "@/lib/use-session";
import { download, timeAgo } from "@/lib/chaos-data";
import {
  addLiveHosts,
  clearLiveHosts,
  deleteLiveHosts,
  listLiveHosts,
} from "@/lib/live-hosts.functions";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live hosts — your verified subdomain workspace" },
      {
        name: "description",
        content:
          "Paste, store and organise the subdomains you have verified as live. Search, annotate, copy, export as TXT/CSV/JSON and open any host in a new tab.",
      },
      { property: "og:title", content: "Live hosts — your verified subdomain workspace" },
      {
        property: "og:description",
        content: "A private workspace for the subdomains you confirmed are live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Pull hostnames out of any pasted blob: URLs, CSV, whitespace-separated lists. */
export function parseHosts(input: string): { hosts: string[]; invalid: number } {
  const parts = input.split(/[\s,;|]+/).filter(Boolean);
  const out = new Set<string>();
  let invalid = 0;
  for (const raw of parts) {
    let value = raw.trim().toLowerCase();
    value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
    value = value.replace(/^[^@]*@/, "");
    const cut = value.search(/[/?#]/);
    if (cut !== -1) value = value.slice(0, cut);
    value = value.split(":")[0] ?? "";
    value = value.replace(/\.$/, "");
    if (!value) continue;
    if (value.length <= 253 && HOST_RE.test(value)) out.add(value);
    else invalid += 1;
  }
  return { hosts: [...out], invalid };
}

function rootOf(host: string): string {
  const parts = host.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : host;
}

type SortKey = "newest" | "alpha" | "root";

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function LivePage() {
  const { user, loading } = useSession();
  const qc = useQueryClient();

  const load = useServerFn(listLiveHosts);
  const add = useServerFn(addLiveHosts);
  const remove = useServerFn(deleteLiveHosts);
  const clearAll = useServerFn(clearLiveHosts);

  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const hostsQuery = useQuery({
    queryKey: ["live-hosts"],
    queryFn: () => load({ data: undefined }),
    enabled: !!user,
    staleTime: 10_000,
  });

  const rows = useMemo(() => hostsQuery.data ?? [], [hostsQuery.data]);

  const addMutation = useMutation({
    mutationFn: (vars: { hosts: string[]; note?: string }) => add({ data: vars }),
    onSuccess: (res) => {
      toast.success(
        `${res.added.toLocaleString()} added${res.skipped ? ` · ${res.skipped.toLocaleString()} already saved` : ""}`,
      );
      setPaste("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["live-hosts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => remove({ data: { ids } }),
    onSuccess: () => {
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["live-hosts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearAll({ data: undefined }),
    onSuccess: () => {
      toast.success("Workspace cleared");
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["live-hosts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = useMemo(() => parseHosts(paste), [paste]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.host.includes(q) || (r.note ?? "").includes(q)) : rows;
    const sorted = [...list];
    if (sort === "alpha") sorted.sort((a, b) => a.host.localeCompare(b.host));
    else if (sort === "root")
      sorted.sort(
        (a, b) => rootOf(a.host).localeCompare(rootOf(b.host)) || a.host.localeCompare(b.host),
      );
    return sorted;
  }, [rows, search, sort]);

  const stats = useMemo(() => {
    const roots = new Set(rows.map((r) => rootOf(r.host)));
    const dayAgo = Date.now() - 86_400_000;
    return {
      total: rows.length,
      roots: roots.size,
      today: rows.filter((r) => new Date(r.created_at).getTime() > dayAgo).length,
      latest: rows[0]?.created_at ?? null,
    };
  }, [rows]);

  function copy(lines: string[], label: string) {
    if (!lines.length) {
      toast.error("Nothing to copy");
      return;
    }
    void navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`${lines.length.toLocaleString()} ${label} copied`);
  }

  function exportAs(format: "txt" | "csv" | "json") {
    if (!filtered.length) {
      toast.error("Nothing to export");
      return;
    }
    if (format === "txt") {
      download("live-hosts.txt", filtered.map((r) => r.host).join("\n"));
    } else if (format === "csv") {
      const body = filtered
        .map((r) => `${r.host},${JSON.stringify(r.note ?? "")},${r.created_at}`)
        .join("\n");
      download("live-hosts.csv", `host,note,added_at\n${body}`);
    } else {
      download("live-hosts.json", JSON.stringify(filtered, null, 2));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!loading && !user) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <Radio className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-3xl font-extrabold">Live hosts</h1>
          <p className="mt-3 text-muted-foreground">
            Your live-host workspace is private to your account. Sign in to paste, store and export
            the subdomains you have verified as live.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-12">
        <Reveal>
          <p className="label-mono text-muted-foreground">Workspace</p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-extrabold tracking-tight">
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="inline-block size-2.5 rounded-full bg-emerald-500"
            />
            Live hosts
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Paste anything — URLs, lists, CSV. Hostnames are extracted, de-duplicated and saved to
            your private workspace. Open, copy or export them any time.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Live hosts" value={stats.total} index={0} />
          <Stat label="Root domains" value={stats.roots} index={1} />
          <Stat label="Added today" value={stats.today} index={2} />
          <Stat
            label="Last added"
            value={stats.latest ? timeAgo(stats.latest) : "—"}
            index={3}
          />
        </div>

        <Reveal className="rounded-lg border border-border bg-card p-5">
          <p className="label-mono text-muted-foreground">Add hosts</p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            placeholder={"https://admin.example.com\nvpn.example.com:443\napi.example.org, dev.example.org"}
            className="mt-3 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs outline-none transition focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="Optional note for this batch (e.g. admin panels)"
              className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none transition focus:border-primary"
            />
            <span className="chip-mono text-muted-foreground">
              {preview.hosts.length.toLocaleString()} valid
              {preview.invalid ? ` · ${preview.invalid} skipped` : ""}
            </span>
            <button
              disabled={!preview.hosts.length || addMutation.isPending}
              onClick={() =>
                addMutation.mutate({
                  hosts: preview.hosts,
                  ...(note.trim() ? { note: note.trim() } : {}),
                })
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Save hosts
            </button>
          </div>
        </Reveal>

        <Reveal className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-mono text-muted-foreground">Saved</p>
              <p className="text-sm text-muted-foreground">
                {filtered.length.toLocaleString()} shown of {rows.length.toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={() => copy(rows.map((r) => r.host), "hosts")}>
                <Copy className="size-3.5" /> Copy all
              </GhostButton>
              <GhostButton onClick={() => copy(filtered.map((r) => r.host), "hosts")}>
                <Copy className="size-3.5" /> Copy filtered
              </GhostButton>
              <GhostButton onClick={() => exportAs("txt")}>
                <Download className="size-3.5" /> TXT
              </GhostButton>
              <GhostButton onClick={() => exportAs("csv")}>
                <Download className="size-3.5" /> CSV
              </GhostButton>
              <GhostButton onClick={() => exportAs("json")}>
                <Download className="size-3.5" /> JSON
              </GhostButton>
              <GhostButton
                onClick={() => {
                  if (!rows.length) return toast.error("Nothing to clear");
                  if (confirm(`Delete all ${rows.length} saved hosts?`)) clearMutation.mutate();
                }}
              >
                <Trash2 className="size-3.5" /> Clear all
              </GhostButton>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter hosts and notes…"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 font-mono text-xs outline-none transition focus:border-primary"
              />
            </div>
            <GhostButton
              onClick={() =>
                setSort((s) => (s === "newest" ? "alpha" : s === "alpha" ? "root" : "newest"))
              }
            >
              <ArrowUpDown className="size-3.5" />
              {sort === "newest" ? "Newest" : sort === "alpha" ? "A–Z" : "By root domain"}
            </GhostButton>
            {selected.size > 0 && (
              <GhostButton
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate([...selected])}
              >
                <Trash2 className="size-3.5" /> Delete {selected.size}
              </GhostButton>
            )}
          </div>

          {hostsQuery.isLoading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="mt-4 max-h-[620px] overflow-auto rounded-md border border-border">
              <AnimatePresence initial={false}>
                {filtered.map((row, i) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(i, 12) * 0.012,
                      ease: EASE_SIGNATURE,
                    }}
                    className="group flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/60"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="size-3.5 shrink-0 accent-[color:var(--color-primary)]"
                      aria-label={`Select ${row.host}`}
                    />
                    <a
                      href={`https://${row.host}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="min-w-0 flex-1 truncate font-mono text-xs transition-colors hover:underline"
                    >
                      {row.host}
                    </a>
                    {row.note ? (
                      <span className="chip-mono hidden shrink-0 text-muted-foreground sm:inline">
                        {row.note}
                      </span>
                    ) : null}
                    <span className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <a
                        href={`https://${row.host}`}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="chip-mono rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        https
                      </a>
                      <a
                        href={`http://${row.host}`}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="chip-mono rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        http
                      </a>
                      <button
                        onClick={() => copy([row.host], "host")}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        aria-label={`Copy ${row.host}`}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate([row.id])}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${row.host}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(row.created_at)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Globe className="size-4" /> No live hosts saved yet — paste some above.
            </p>
          )}
        </Reveal>
      </div>
    </SiteShell>
  );
}

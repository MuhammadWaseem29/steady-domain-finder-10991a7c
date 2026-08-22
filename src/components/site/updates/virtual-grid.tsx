import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownUp, ArrowUp, ChevronRight, Copy, Download } from "lucide-react";

import { Skeleton } from "@/components/site/motion";
import {
  domainNewSubsQuery,
  timeAgo,
  type DomainUpdateRow,
  type UpdatesSort,
} from "@/lib/chaos-data";

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`
      : String(n);

function PlatformChip({ row }: { row: DomainUpdateRow }) {
  if (!row.platform_slug) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
      style={{
        borderColor: row.platform_color ?? "var(--color-border)",
        color: row.platform_color ?? "var(--color-muted-foreground)",
        background: row.platform_color
          ? `color-mix(in oklab, ${row.platform_color} 12%, transparent)`
          : "transparent",
      }}
    >
      {row.platform_name ?? row.platform_slug}
    </span>
  );
}

function ExpandedHosts({
  domainId,
  domain,
  since,
}: {
  domainId: string;
  domain: string;
  since: string;
}) {
  const { data, isLoading } = useQuery(domainNewSubsQuery(domainId, since, 100));
  const hosts = data ?? [];
  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!hosts.length)
    return <p className="text-xs text-muted-foreground">No new hosts for {domain} in this window.</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="label-mono text-muted-foreground">Newest {hosts.length} hosts</p>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(hosts.map((h) => h.host).join("\n"));
            toast.success(`Copied ${hosts.length} hosts`);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
        >
          <Copy className="size-3" /> Copy shown
        </button>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {hosts.map((h) => (
          <li key={h.id} className="flex items-center gap-2 font-mono text-xs">
            <span className="truncate">{h.host}</span>
            <a
              href={`https://${h.host}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              https
            </a>
            <a
              href={`http://${h.host}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              http
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SortHead({
  label,
  value,
  sort,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  value: UpdatesSort;
  sort: UpdatesSort;
  dir: "asc" | "desc";
  onSort: (s: UpdatesSort) => void;
  className?: string;
}) {
  const active = sort === value;
  return (
    <button
      onClick={() => onSort(value)}
      className={`label-mono inline-flex items-center gap-1.5 transition-colors hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${className}`}
    >
      {label}
      <ArrowDownUp
        className={`size-3 transition-transform ${active && dir === "asc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function UpdatesGrid({
  rows,
  loading,
  dense,
  since,
  sort,
  dir,
  onSort,
  selected,
  onToggle,
  onToggleAll,
  expanded,
  onExpand,
  onDownloadRow,
  height = 620,
}: {
  rows: DomainUpdateRow[];
  loading: boolean;
  dense: boolean;
  since: string;
  sort: UpdatesSort;
  dir: "asc" | "desc";
  onSort: (s: UpdatesSort) => void;
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onDownloadRow: (domain: string) => void;
  height?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowH = dense ? 38 : 52;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i]?.id === expanded ? rowH + 190 : rowH),
    overscan: 12,
    getItemKey: (i) => rows[i]?.id ?? i,
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const cols = "40px minmax(180px,1.6fr) 110px 130px 150px 120px 90px";

  return (
    <div className="rounded-xl border border-border bg-card">
      <div
        className="sticky top-0 z-10 grid items-center gap-2 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur"
        style={{ gridTemplateColumns: cols }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          aria-label="Select all rows on this page"
          className="size-3.5 accent-current"
        />
        <SortHead label="Company" value="domain" sort={sort} dir={dir} onSort={onSort} />
        <SortHead
          label="New"
          value="new"
          sort={sort}
          dir={dir}
          onSort={onSort}
          className="justify-end"
        />
        <SortHead
          label="Subdomains"
          value="total"
          sort={sort}
          dir={dir}
          onSort={onSort}
          className="justify-end"
        />
        <span className="label-mono text-muted-foreground">Platform</span>
        <span className="label-mono text-muted-foreground">Last seen</span>
        <span className="label-mono text-right text-muted-foreground">Actions</span>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          No companies match these filters.
        </p>
      ) : (
        <div ref={parentRef} className="overflow-auto" style={{ height }}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const row = rows[v.index]!;
              const isOpen = expanded === row.id;
              const isNew = Number(row.new_count) > 0;
              return (
                <div
                  key={v.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${v.start}px)`,
                  }}
                  className="border-b border-border/60"
                >
                  <div
                    className={`grid items-center gap-2 px-4 transition-colors hover:bg-accent/40 ${
                      dense ? "py-1.5" : "py-3"
                    } ${isOpen ? "bg-accent/30" : ""}`}
                    style={{ gridTemplateColumns: cols }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => onToggle(row.id)}
                      aria-label={`Select ${row.domain}`}
                      className="size-3.5 accent-current"
                    />
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        onClick={() => onExpand(isOpen ? null : row.id)}
                        aria-label={`Toggle hosts for ${row.domain}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight
                          className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                      </button>
                      <Link
                        to="/domain/$domain"
                        params={{ domain: row.domain }}
                        className="truncate font-medium hover:underline"
                      >
                        {row.domain}
                      </Link>
                    </div>
                    <div className="text-right">
                      {isNew ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-2 py-0.5 font-mono text-xs font-semibold text-success">
                          <ArrowUp className="size-3" />
                          {compact(Number(row.new_count))}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="text-right font-mono text-sm tabular-nums">
                      {Number(row.total_subdomains).toLocaleString()}
                    </div>
                    <PlatformChip row={row} />
                    <span className="text-xs text-muted-foreground">
                      {row.last_seen ? timeAgo(row.last_seen) : "—"}
                    </span>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onDownloadRow(row.domain)}
                        aria-label={`Download new hosts for ${row.domain}`}
                        className="rounded-md border border-border p-1.5 hover:bg-accent"
                      >
                        <Download className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border/60 bg-background/50 p-3">
                      <ExpandedHosts domainId={row.id} domain={row.domain} since={since} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

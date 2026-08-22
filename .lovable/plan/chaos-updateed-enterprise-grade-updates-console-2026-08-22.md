# /chaos_updateed — enterprise-grade updates console

A brand-new page at `/chaos_updateed`, built for speed and depth. The existing `/chaos_updates` stays exactly as it is, untouched.

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Command bar: window picker | search | platform | ⌘K palette  │
├──────────────────────────────────────────────────────────────┤
│ KPI strip: companies · with new · new hosts · total subs     │
│ (animated count-ups + inline sparkline per card)             │
├─────────────────────────────┬────────────────────────────────┤
│ Discovery chart (area/bars) │ Platform share donut           │
│ Top movers bar strip        │ Discovery cadence heatmap      │
├─────────────────────────────┴────────────────────────────────┤
│ Virtualized data grid: company | new ↑N | total | platform   │
│ row expand → newest hosts, http/https, copy, notes           │
├──────────────────────────────────────────────────────────────┤
│ Workbench tabs: Hosts · Query editor · Export preview        │
│   Monaco editor: live filter DSL + editable host list        │
└──────────────────────────────────────────────────────────────┘
```

## Features

**Speed**
- Virtualized table and host lists (TanStack Virtual) so 100k rows scroll at 60fps.
- Server-side aggregation via the existing updates RPCs; only the visible page is fetched.
- Prefetch on hover/next page, `keepPreviousData` so window/sort changes never blank the screen.
- Web Worker for client-side filtering, dedupe, sorting and text building of huge host lists, so copy/export never freezes the UI.
- Streamed downloads straight from `/api/public/export` (no memory blowups), with progress toast.

**Monaco workbench**
- A Monaco editor tab that acts as a query/filter console: type include/exclude patterns, regex, `platform:`, `new>0`, wildcard host globs — applied live to the grid and to every copy/export action.
- A second Monaco tab shows the resolved host list (read-only, syntax-highlighted), editable before copying/downloading, with one-click TXT/CSV/JSON/JSONL/Markdown conversion.
- Editor is lazy-loaded client-side only, so it costs nothing on first paint.

**Charts and diagrams**
- Discovery over the selected window (area + cumulative toggle).
- Top-10 movers horizontal bars, platform share donut, day/hour discovery heatmap.
- Per-row mini sparkline of that company's discovery trend.
- Company → platform relationship diagram (Mermaid-style flow) for the top movers.

**Table**
- Windows: 1h / 6h / 12h / 24h / 3d / 7d / 30d / 90d / 6mo / custom range.
- Only-new toggle, host keyword filter, sort by new/total/company, density switch.
- Row checkboxes + selection bar: copy or export selected companies' new hosts.
- Sticky header, keyboard navigation (j/k, space to select, enter to expand).
- Every control lives in the URL; ⌘K palette jumps to windows, platforms and actions.

**Copy / export**
- Copy new hosts, all hosts, company list, or the current Monaco buffer — page-scope, selection-scope, or entire filtered set.
- Download TXT / CSV / JSON / JSONL / Markdown; per row, per selection, or whole filtered set.
- Large-copy guard with a count confirmation and progress feedback.

**Live**
- Auto-refresh (off / 30s / 2m / 5m) with "updated X ago", plus a live pulse when new rows arrive since last refresh.

## Technical notes

- New route `src/routes/chaos_updateed.tsx` with its own `head()` metadata; nav link added in `src/components/site/chrome.tsx`. `/chaos_updates` and its data helpers stay unchanged.
- Page split into components under `src/components/site/updates/` (command bar, KPI strip, charts, grid, workbench) so code-splitting keeps the initial bundle small.
- New deps: `@monaco-editor/react` + `monaco-editor` (lazy, client-only), `@tanstack/react-virtual`, `comlink` for the worker. Charts reuse the existing recharts components; motion reuses framer-motion.
- Reuses existing RPCs (`domain_updates_page`, `domain_updates_count`, `domain_updates_summary`, `domain_new_subs`, sparkline) and `/api/public/export` — no schema changes, no new backend endpoints.
- Worker at `src/lib/updates-worker.ts` handles parse/filter/format of host batches off the main thread.

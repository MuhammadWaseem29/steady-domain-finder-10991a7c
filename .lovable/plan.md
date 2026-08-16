# Make /chaos_updates a full-featured updates console

Upgrade the page from a simple table into the main "what changed" workspace: any time window, real totals, bulk copy/export of new hosts, and per-row detail.

## Time windows

Window switcher gains: 1h, 6h, 12h, 24h, 3d, 7d, 30d, 90d, 6 months, plus **Custom** (pick a start/end date-time, or type "last N hours/days"). The chosen window drives every number, badge, copy and download on the page.

## Copy and export

- **Copy all new subdomains** for the current window across the whole filtered set (not just the visible page), with a count confirmation before large copies.
- **Download new subs** for the window in TXT / CSV / JSON, again for the whole filtered set (respects search + platform filter).
- **Copy company list** (kept) and **download all subs** for the filtered set.
- Per row: copy new hosts, copy all hosts, download new, download all.
- Row checkboxes with a selection bar: copy or download the selected companies' new hosts in one action.

## Table and filtering

- "Only companies with new finds" toggle.
- Host keyword filter (e.g. `dev`, `api`, `staging`) that narrows both the new counts and the exports.
- Rows per page selector (25 / 50 / 100 / 250) and jump-to-page.
- Expandable row: click a company to reveal its newest hosts inside the window inline, each with http/https links, copy and "add to notes".
- Sticky table header, keyboard focus states, and a compact/comfortable density toggle.
- Every control is stored in the URL, so a filtered view is shareable and survives refresh.

## Stats and visuals

- Summary cards show totals for the **entire filtered set** (companies tracked, companies with new finds, total new hosts, total subdomains), not just the current page.
- A small discovery sparkline for the selected window above the table.
- Top-5 movers strip: the companies with the biggest new counts in the window.
- Optional auto-refresh (off / 30s / 2m / 5m) with the existing "Updated X ago" indicator.

## Technical notes

- New read-only RPC `domain_updates_summary(_since, _search, _platform_id, _keyword, _only_new)` returning companies, companies_with_new, new_hosts, total_subdomains for the filtered set; granted to `anon`/`authenticated` like the other public read functions.
- `domain_updates_page` / `domain_updates_count` extended with `_keyword` and `_only_new` arguments (new overloads, defaults preserve current behaviour), so filtering and paging stay in SQL against the multi-million-row `subdomains` table.
- `/api/public/export` extended to accept `since`/`until` ISO timestamps (in addition to `hours`), a `keyword` param, and a repeatable `domains=` list so bulk and selection downloads stream from the existing chunked exporter — no new export pipeline.
- Bulk "copy all new subs" fetches the same export endpoint as text and writes to the clipboard, with a guard + toast above ~200k hosts.
- New helpers in `src/lib/chaos-data.ts`: `chaosUpdatesSummaryQuery`, `chaosUpdatesSparklineQuery`, and updated options objects; URL state via TanStack Router search params on `src/routes/chaos_updates.tsx`.
- Row expansion reuses `domain_new_subs`; styling, motion and badges reuse the existing site components.

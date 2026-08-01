## What's actually wrong (verified in the database)

For `natwest.com` (domain id `5e05…3e94`):

- The subdomains table holds **3,986** hosts, and **5 of them were first seen at 2026-08-01 06:15:26 UTC** (`apply-cloud.natwest.com`, `cora-spending-assistant.gentest.assistant.natwest.com`, `www.cora-spending-assistant…`, `self-service-backend.kappa2-p.assistant…`, `www.self-service-backend…`).
- The scan history table has **no scan row at all at 06:15** — its most recent row is 01:03 UTC with `new_count = 0`, and `domains.last_scanned_at` is also still 01:03 while `total_subdomains` still says 3,981.

So the discovery genuinely happened; the bookkeeping around it did not.

**Root cause:** in the scanner, the hosts are ingested first, and the scan-history row plus the domain counters are written **only at the very end** of the run, in one final batch. When a cron sweep hits its time budget (or the worker request is cut off) after the ingest but before that final write, the newly inserted rows exist while the scan row, `new_count`, `last_scanned_at` and `total_subdomains` are simply never written. Those writes also never check for errors, so a failed insert is silent. The result the user sees: a long list of `+0` scans even though new hosts landed in the database.

(The "5h 32m ago" next to "06:03:05" is not a bug — the row is stored 01:03 UTC and rendered in your local timezone; the elapsed time is correct.)

## Part 1 — Make new-subdomain accounting durable (all platforms)

1. **Open the scan row up front.** Insert the `scans` row with `status = running` before ingesting, and keep its id. Every ingest chunk immediately updates that row with the running `new_count`, `total_returned`, and `processed` progress. A truncated run then still leaves an accurate, visible record instead of nothing.
2. **Update domain counters incrementally** in the same step (`last_scanned_at`, `total_subdomains`, `new_subdomains_last_scan`) rather than only after the last chunk.
3. **Do the counting in the database.** Extend the ingest function so the per-chunk insert also increments the scan row's counter transactionally — the count can't be lost by a dying worker.
4. **Self-healing reconciliation.** Add a database routine (run at the start of each cron tick) that, for any finished scan whose `new_count` is 0, recomputes it as the number of subdomains for that domain whose `first_seen_at` falls inside the scan's start/finish window, and closes out scans stuck in `running`. This retroactively repairs the existing history, including natwest's 06:15 discovery, across every program/platform.
5. **Check write errors** on the scans/domains writes and surface failures into `last_scan_status` instead of swallowing them.
6. **Verify**: re-run a cron sweep and a manual scan, then query the database to confirm scan rows, `new_count`, and `first_seen_at` all agree for natwest and a couple of large programs.

## Part 2 — New `/recentsubs` page (flagship design)

A dedicated, premium page devoted entirely to newly discovered subdomains:

- **Hero band** with animated count-up KPIs: new in last 1h / 24h / 7d / 30d / 6mo, active programs contributing, discovery velocity (new per hour), and the single most recent find with a live ticking timestamp.
- **Charts**: a large gradient-filled discovery timeline (switchable hour/day/week/month buckets), a per-platform stacked share chart, a top-programs bar chart, and a scan-health sparkline — all animated on mount.
- **Live feed**: newest hosts streaming in with animated row insertion, platform-colored badges, root-domain links, relative + exact time, per-row copy, and a filter/search bar (by platform, program, text).
- **Bulk actions**: copy all new hosts for the selected window, and export TXT/CSV/JSON through the existing streaming export endpoint.
- **Breakdown tables**: top programs and top root domains by new finds in the window, with delta indicators.
- Colorful but on-brand: platform accent colors, gradient surfaces, spotlight cards, scroll reveals, skeleton shimmer while loading, and full reduced-motion support. Route linked from the navbar.

## Technical notes

- Migration: add a scan-progress update function + a `reconcile_scan_counts()` routine; keep existing GRANT/RLS conventions.
- Edits: `src/lib/chaos.server.ts` (scan row lifecycle), `src/routes/api/public/hooks/scan.ts` (call reconciliation per tick), `src/lib/chaos-data.ts` (new queries for the recent-subs page), new `src/routes/recentsubs.tsx`, new chart components in `src/components/site/charts.tsx`, navbar link in `src/components/site/chrome.tsx`.
- Verification is done against the live database and with browser screenshots of the new page.

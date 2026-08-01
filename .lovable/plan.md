## Goal
Remove the 300-host cap on the "Every new subdomain" feed on `/recentsubs`, and expand the page into a full analytics surface.

## 1. Unlimited feed
- Replace the fixed `recentNewSubsQuery(range, 300)` with an infinite/paged query (`useInfiniteQuery`, 500 rows per page, keyset paging on `first_seen_at` + `id`) so the feed can load every new subdomain in the selected range, not just 300.
- Virtualized/windowed rendering of rows so tens of thousands of hosts stay smooth (render in chunks with a "Load more" + auto-load-on-scroll sentinel).
- Header shows real total (from an exact count for the range) instead of "300 hosts".
- "Copy all" and "Export" pull the **entire** range server-side (reuse the existing streaming `/api/public/export` route with a range filter), not just the loaded rows.

## 2. New charts and panels (owner's picks)
- **Discovery velocity sparkline strip**: new subs per hour/day for the range with delta vs previous equal-length period (▲/▼ % badge).
- **Hour-of-day heatmap**: 7×24 grid showing when discoveries land — makes cadence gaps obvious.
- **Cumulative growth line**: running total of new subs across the range next to the existing area chart.
- **Program leaderboard**: ranked list with share bars, new count, domains affected, sparkline per program.
- **Newest TLD / keyword breakdown**: top subdomain label prefixes (api, dev, stage, admin, vpn…) — high-signal for recon, rendered as a bar chart plus quick filter chips.
- **Interesting hosts panel**: highlights hosts matching high-value patterns (admin, internal, staging, vpn, jenkins, git, s3, jira…) with copy/export for that subset.
- **Scan reliability strip**: scans run, errors, success rate and full-cycle coverage for the range.

## 3. Feed controls
- Search box (host/domain substring), program filter, and root-domain filter applied to the feed.
- Sort toggle: newest first / grouped by root domain.
- Per-row copy, and per-group "copy all for this domain".
- Live-append: new discoveries slide in at the top while the page is open (keeps the existing AnimatePresence motion).

## 4. Polish
- Keep the existing premium motion language (spring range pill, CountUp KPIs, spotlight cards); add shimmer skeletons for the new panels and reduced-motion safety.

## Technical notes
- New DB helper RPCs: `new_subs_hour_heatmap(since)`, `new_subs_label_breakdown(since, lim)`, `new_subs_cumulative(bucket, since)`, and a `count_new_subs(since)` exact counter — all `STABLE`, `SET search_path = public`, with `GRANT EXECUTE` to `anon`/`authenticated`.
- Paging uses an index-friendly keyset on the existing `subdomains(first_seen_at DESC)` index; no new indexes expected.
- Export/copy-all routed through the existing streaming export endpoint to avoid loading everything into browser memory.

## Goal

1. Show, live, which domains/programs are being scanned right now.
2. Add a new `/updates` page listing programs with newly discovered subdomains.

## 1. Live scan activity

New database function `running_scans_detail()` returning, for each scan with `status = 'running'`:
domain, platform name/slug/color, trigger, `started_at`, elapsed seconds — ordered oldest first.
A second function `scan_activity_summary()` returns: running count, domains claimed in the last 5 minutes, scans finished in the last 5 minutes, and new subdomains found in the last 5 minutes.

UI: a "Live scan activity" section on `/dashboard` (below the existing scan-cycle health panel):
- Header with pulsing live dot and the summary counters.
- A rolling list of in-flight domains, each with its program badge and a ticking elapsed timer (reuse `live-time.tsx`).
- Rows animate in/out with `AnimatePresence`; refetch every 5s.
- Empty state: "No scans in flight — next sweep starts within a minute."

## 2. `/updates` page (Program updates)

New route `src/routes/updates.tsx`, linked in the navbar next to Programs.

New database function `platform_updates(since timestamptz)` returning per platform:
platform id/slug/name/color, count of new subdomains since `since`, number of distinct domains affected, and the timestamp of the most recent discovery.
Plus `platform_recent_subdomains(_platform_id uuid, lim int)` for the drill-down list.

Page layout:
- Range selector (1h / 24h / 7d / 30d) reusing the existing `RANGES` keys.
- Cards per program sorted by new-subdomain count, showing count-up numbers, affected-domain count, last-activity time, and a colored program accent.
- Each card expands to show the newest hosts (host, root domain, first-seen time) with copy-all and export buttons for that program's new subs.
- A combined "All new subdomains in range" list at the bottom with copy/export, reusing the existing export endpoint.
- Auto-refresh every 15s so new finds appear without a reload.

## Technical notes

- All new SQL functions are `STABLE`, `SECURITY INVOKER`, `SET search_path = public`, with `GRANT EXECUTE` to `anon` and `authenticated` (matching existing read-only public policies).
- Query helpers added to `src/lib/chaos-data.ts` (`runningScansQuery`, `scanActivityQuery`, `platformUpdatesQuery`, `platformRecentSubsQuery`).
- `/updates` gets its own `head()` metadata (title, description, og tags).
- Queries stay index-friendly: the new-subdomain aggregations use the existing `subdomains(first_seen_at DESC)` and `subdomains(domain_id, first_seen_at DESC)` indexes.

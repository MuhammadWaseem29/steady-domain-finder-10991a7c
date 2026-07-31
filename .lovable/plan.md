## What I found (verified against the live database)

- The cron job `chaos-rolling-scan` runs every minute and fires correctly (30/30 runs succeeded in the last 30 min).
- But the sweep is **stalling, not cycling**: each run *claims* 200 domains, yet only ~25 actually finish. In the last hour: 1,542 successful scans, **394 scans stuck/timed out** (auto-closed after ~25 min), 52 still hanging.
- Root cause: the Chaos fetch has **no timeout**. A slow domain hangs a worker for the whole run, so the other claimed domains are skipped — but they were already stamped as "scanned", so they wait a full cycle. Oldest domain was last touched **3h 14m ago** instead of within 30 min.
- Display: the UI only shows relative time (`timeAgo`), so a scan 3h 14m old reads as "3h ago" — that's the "3 hour / 1 hour" you're seeing.
- New-subdomain detection itself is correct: it upserts on the unique `(domain_id, host)` index, so re-scans only record genuinely new hosts, which is what feeds "Recently added subdomains".

## Plan

### 1. Make the scanner fast enough for a 30-minute full cycle
Target: 10,461 domains / 30 min = **~350 domains per minute**.

- Add a hard per-request timeout (AbortController, ~15s) on the Chaos API call so one slow domain can't block a worker.
- Raise the concurrency ceiling from 12 to 64 and run the cron with `limit=400&concurrency=40&budgetMs=50000`.
- Skip the extra `scans` row insert/update round-trips for the common path by writing the scan record once at completion (still recording start time, returned, new, removed, status).
- Keep the orphan cleanup, but close stuck `running` scans after 3 minutes instead of 10.

### 2. Stop lying about `last_scanned_at`
- Add a `claimed_at` column to `domains`. The sweep claims on `claimed_at`; `last_scanned_at` is only written when a scan actually finishes. Queue ordering uses `claimed_at`, so nothing is re-picked mid-run and the displayed "last scanned" is real.

### 3. Cron job
- Keep the every-minute rolling sweep (it gives a smooth full pass in ~30 min and survives worker time limits better than one giant 30-minute job).
- Re-tune the job's URL parameters, and add a lightweight second job that reports cycle health.
- Verify after deploy: confirm `max(now() - last_scanned_at)` across all enabled domains drops under 30 minutes, error count stays near zero, and `cron.job_run_details` shows clean runs.

### 4. Exact, live timestamps in the UI
- Add an `exactTime()` helper (e.g. `31 Jul 2026, 18:12:44`) and show it everywhere a scan time appears: scan history tables, domain detail header, dashboard root-domain table, program pages.
- Format: exact timestamp as the primary value with the relative age as a muted suffix (`18:12:44 · 1m ago`), and full ISO on hover.
- Make the relative part tick live (1s interval) and drop the scan-history/feed refetch interval to 10s so the page reflects the database in near real time.
- Add a "next full sweep completes in ~X" / "oldest domain scanned Xm ago" indicator on the dashboard so cycle health is visible at a glance.

### 5. New-subdomain flow (confirm + surface)
- Behaviour stays: first scan stores everything, re-scans insert only hosts not already present, and those rows get a fresh `first_seen_at` so they appear in "Recently added subdomains".
- Add the count of new subs found in the current 30-minute cycle to the dashboard header, alongside last-hour / 24h.

### Technical notes
- Files touched: `src/lib/chaos.server.ts` (timeout, concurrency, claim logic, single scan write), `src/routes/api/public/hooks/scan.ts` (param defaults), `src/lib/chaos-data.ts` (`exactTime`, faster refetch), `src/routes/domain.$domain.tsx`, `dashboard.tsx`, `index.tsx`, `new.tsx`, `program.$slug.tsx` (timestamp display).
- One migration: `domains.claimed_at` + index on `(enabled, claimed_at)`.
- Cron reschedule via a data statement (not a migration), then verified by querying `cron.job_run_details` and domain staleness.

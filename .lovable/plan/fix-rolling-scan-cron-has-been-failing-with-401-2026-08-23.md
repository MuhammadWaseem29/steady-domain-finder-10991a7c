# Fix: rolling scan cron has been failing with 401

## What's wrong

The scheduled sweep runs every minute as designed, but every single call is
rejected. Confirmed from the database:

- `cron.job_run_details` shows the job firing each minute and "succeeding"
  (it only reports that the HTTP request was sent).
- The actual HTTP responses in `net._http_response` are **401 Unauthorized**
  for every tick.
- No enabled domain has been scanned in the last 2 hours; the newest
  `last_scanned_at` across 22,491 domains is 2026-08-22 12:53 UTC — roughly
  20 hours stale.

Root cause: the cron job authenticates with a `x-cron-secret` header, but the
endpoint `/api/public/hooks/scan` was changed to require an `apikey` header
matching the project's anon key. The two never match, so the scan handler exits
before doing any work.

A second issue: the cron URL points at the preview (`-dev`) host rather than the
stable production host, so scanning depends on the preview build being current.

## The fix

1. Update the endpoint to accept the correct credential:
   - Accept the `apikey` header (anon key) as the canonical auth, and also
     accept the existing `x-cron-secret` value so the switchover can't leave a
     gap.
2. Re-create the cron job (`chaos-rolling-scan`) with:
   - the `apikey` header set to the project anon key,
   - the URL pointed at the stable production host
     `project--52925200-8fb8-442c-88e1-e747035fac35.lovable.app`,
   - the same every-minute schedule and `cycleMinutes=120` parameters, so the
     full root-domain list is swept once per 2 hours as intended.
3. Unblock the backlog: mark all enabled domains due (`claimed_at = null`) so
   the sweep starts immediately instead of waiting out stale claim windows.
4. Verify: call the endpoint once directly, then re-check
   `net._http_response` for 200s and confirm `last_scanned_at` and `scans` rows
   start advancing.

## Technical notes

- File touched: `src/routes/api/public/hooks/scan.ts` (auth check only; scan
  logic in `src/lib/chaos.server.ts` is unchanged and working).
- Cron changes applied via `cron.unschedule` + `cron.schedule` in a migration.
- No schema changes, no UI changes.

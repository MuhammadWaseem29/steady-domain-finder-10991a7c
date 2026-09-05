# Faster live probing — thousands of hosts in parallel, always running

## What I found
- The probe engine already uses a continuous worker pool (900 hosts in flight per worker, results stream to the DB as they land) — it is not one-at-a-time.
- The real bottleneck: **no cron job exists for the probe hook** (only the scan cron is scheduled), so parallel probing only runs when someone presses a button. Default fan-out is also 0.
- `claim_probe_job` uses `FOR UPDATE SKIP LOCKED` and reclaims stale jobs after 2 minutes, so many workers can safely run the same queue at once.

## Plan

1. **Schedule continuous probing** — new `chaos-live-probe` pg_cron job (every minute) calling
   `/api/public/hooks/probe?workers=6&fanout=3&budgetMs=50000` with the cron auth headers.
   Each minute that spawns ~24 concurrent workers x 900 hosts each ≈ 20k+ hosts in flight.

2. **Tune the engine** (`src/lib/probe.server.ts`):
   - CONCURRENCY 900 → 1200 (hosts in flight per worker).
   - FLUSH_EVERY 500 → 400 (results appear sooner).
   - Keep 4s timeout / prefetch / chained writes as-is.

3. **Tune the hook** (`src/routes/api/public/hooks/probe.ts`):
   - Default `workers` 4 → 6.
   - Allow `fanout` up to 12 (unchanged) and document the tuned URL in the cron command.

4. **Verify**: trigger the hook once, confirm multiple jobs claimed in parallel, watch the live-hosts count grow on /live and /livesubs, and check pg_cron run history shows success every minute.

## Technical notes
- All parallelism stays inside the existing SKIP LOCKED job queue — no duplicate probing, automatic resume of stalled jobs.
- No schema changes; only one new cron schedule row plus constant tweaks.

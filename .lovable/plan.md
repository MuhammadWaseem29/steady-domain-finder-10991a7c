## Verified first

- Cron job `chaos-rolling-scan` exists and is **active**, schedule `* * * * *` (every minute, 200 domains per sweep → full 10.4k pass roughly hourly). No fix needed; I'll add a visible "scanner health" panel so you can see last run time, per-hour scan counts and any errors instead of guessing.
- Current tables: `domains`, `subdomains`, `scans`. There is no platform column yet, and no daily/weekly rollup data — both get added.

## 1. Bug bounty platforms

New `platforms` table seeded with 5 rows: HackerOne, Bugcrowd, Intigriti, YesWeHack, Self-hosted. `domains` gets a `platform_id` column (nullable → existing 10.4k domains stay under "Unassigned"/Self).

Each platform gets one placeholder root domain seeded so the page isn't empty; you add the real root domains later manually or by bulk paste.

New pages:
- `/platforms` — grid of the 5 platforms with domain count, total subdomains, new-subs-last-24h per platform.
- `/platform/{slug}` — that platform's domain list (search + pagination), its stats, its recent subdomains feed, copy/export of **every subdomain across that whole platform**, and a "Scan all domains in this platform" button.

## 2. Copy / export everywhere

- Copy-all + export (TXT / CSV / JSON) buttons at three scopes: single domain (already there), per platform, and **global — all subdomains of all programs**.
- Separate "Copy new only" for last-24h / since-last-scan.
- Big exports stream in 1000-row pages with a progress toast so a 500k-row copy doesn't freeze the tab.

## 3. New-subs dashboard

- Dedicated `/new` view: everything first seen in a selected window (last scan, 1h, 24h, 7d, 30d), grouped by root domain, with platform badge, copy/export, and live auto-refresh.
- "Run scan" on any domain immediately re-checks and any newly discovered host lands in this feed with a NEW badge.

## 4. Stats & graphs

New rollup so history is cheap to chart: a `daily_stats` table (per day, and per platform) filled by a small SQL aggregation the cron also touches, plus on-the-fly hourly aggregation for the last 48h.

Charts (recharts, already installed):
- Subdomains discovered over time — toggles for Hourly / Daily / Weekly / Monthly / 6 months / All time.
- Scans run + errors per period.
- Top domains by new subs in period.
- Platform share (donut).
- Scan health strip: success/error ratio per hour.

Stat cards: total domains, total subdomains, new in last scan, new 24h/7d/30d, last scan time, next sweep countdown.

## 5. Dark theme + animation

- Dark is already the base; I'll add a proper theme toggle (dark default, light available) wired through tokens in `src/styles.css` so nothing hardcodes colors.
- Motion: staggered fade/slide-in on cards and table rows, animated counters on stat numbers, shimmer skeletons while loading, pulse on the live "new sub" feed, smooth chart draw-in, hover lift on domain rows, subtle terminal-style scan progress animation.

## 6. Adding domains

Single-domain input **and** multi-paste/upload textarea, both with a platform selector, on the dashboard and on each platform page.

## Technical notes

- Migration: `platforms` table + seed, `domains.platform_id` FK + index, `daily_stats` table, indexes on `subdomains.first_seen_at` and `(domain_id, first_seen_at)` for fast window queries; public read policies + GRANTs matching the existing tables.
- Aggregations run as SQL RPC functions (security definer, read-only) so charts don't pull hundreds of thousands of rows to the browser.
- Scanner logic unchanged apart from writing a daily stats row after each sweep.

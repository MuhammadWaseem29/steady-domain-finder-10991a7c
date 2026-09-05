# Recent subs — LIVE page

Add a new tab "Recent live" next to the existing "Recent subs" tab. It shows subdomains that recently started answering (confirmed live by our prober), newest first — mirroring the look and feel of the /recentsubs page.

## What you'll get

- New page at **/livesubs**, styled like /recentsubs (same dark theme, animations, tables, charts):
  - **Stats row:** live hosts found in the last hour / 24h / 7d / 30d, total live hosts ever seen, and live-per-hour rate.
  - **Activity chart:** live discoveries over time (hourly bars for 24h–7d, daily for 30d+), same style as the Recent subs growth charts.
  - **Status-code breakdown:** small chart showing 200 / redirects / 401-403 / 5xx share of recent live hosts.
  - **Table:** host, domain, platform badge, status code, page title, "points to" (third-party owner), takeover flag, and when it went live — sorted newest first, with search and time-window filters (1h / 24h / 7d / 30d).
  - **Copy / export:** "Copy all" button and TXT / CSV / JSON download of the filtered list (reuses the existing raw export endpoints).
- New nav tab **"Recent live"** right after "Recent subs" in the top navigation.
- Live auto-refresh every 15 seconds, like the Recent subs page.

## Technical details

- New route `src/routes/livesubs.tsx` reusing the visual patterns/components from `src/routes/recentsubs.tsx`.
- Data comes from the existing `probe_results` table (`failed = false`, ordered by `probed_at DESC`) — no database changes needed.
- Reuses the existing `liveHostsPage` server function in `src/lib/probe.functions.ts` for the table; adds one small new server function for the stats/chart aggregates (counts bucketed by hour/day over the selected window).
- Nav entry added in `src/components/site/chrome.tsx` (after "Recent subs").
- Unique SEO head (title/description) for /livesubs.

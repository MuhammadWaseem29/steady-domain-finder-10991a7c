# Chaos-style updates table at /chaos_updates

A new page that mirrors the layout on chaos.projectdiscovery.io: one row per company/root domain, with a green "new subdomains" badge, the total subdomain count, its platform, and a per-row download button — sorted so the domains that just found new subs float to the top.

## What the page shows

Row columns:
- **Company** — root domain, links to its existing detail page
- **New** — green `↑ N` badge = subdomains first seen inside the selected window (1h / 24h / 7d / 30d). Rows with no new finds show nothing, exactly like the reference.
- **Subdomains** — total count for that domain
- **Platform** — colored platform chip (HackerOne, Bugcrowd, Intigriti, YesWeHack, self)
- **Download** — per-row export of that domain's hosts (all, or only the new ones in the window)

Controls above the table:
- Search company
- Platform filter chips (from the existing platforms list)
- Time window switcher (1h / 24h / 7d / 30d)
- Sort by New / Subdomains / Company, ascending or descending
- "Updated X ago" freshness indicator
- Copy-all and export buttons for the currently filtered set

Paging: 50 rows per page with prev/next, plus summary stats (domains with new finds, total new hosts, total subdomains in view).

Styling follows the existing site: dark card table, mono numerals, framer-motion row reveals and animated count-ups, same badges used on /updates.

## Technical notes

- New database function `domain_updates_page(_since, _search, _platform_id, _sort, _dir, _limit, _offset)` returning domain id, domain, total_subdomains, platform slug/name/color, new_count (count of `subdomains.first_seen_at >= _since`), and last_seen; plus `domain_updates_count(...)` for pagination. Doing the aggregation in SQL keeps it fast against the multi-million-row `subdomains` table; both are read-only and granted to `anon`/`authenticated` like the other public read RPCs.
- New query helpers in `src/lib/chaos-data.ts` (`chaosUpdatesPageQuery`, `chaosUpdatesCountQuery`) following the existing `queryOptions` pattern.
- New route `src/routes/chaos_updates.tsx` with its own `head()` metadata (title, description, og/twitter tags).
- Per-row downloads reuse the existing `/api/public/export` endpoint (`?domain=…&scope=new|all&hours=…&format=txt|csv|json`) — no new export code.
- Header nav in `src/components/site/chrome.tsx` gains a "Chaos updates" link.

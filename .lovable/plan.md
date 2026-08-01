## What's wrong

Confirmed in the database: `vodafone.com.tr` really has **99,381** subdomains stored (and 99,381 first seen in the last 24h). The page shows 60,000 because of the frontend, not the data.

`subdomainsQuery` in `src/lib/chaos-data.ts` pulls every subdomain row into the browser in pages of 1,000, with a hard stop at 60 pages = **60,000 rows**. Every stat on the domain page is then computed from that truncated in-memory array:

- "Total subdomains" = `all.length` → caps at 60,000
- "New (24h)" = filter over the same array → caps too
- "Showing X of Y hosts" → caps too

So any program with more than 60,000 hosts is wrong, and even under that limit the page downloads up to 60k rows on every visit (and re-fetches them every 60s), which is why big programs feel slow.

## The fix

Stop counting in the browser. Count in the database, and page the table.

**1. Database helpers (one migration)**
- `domain_subdomain_stats(_domain_id uuid)` → returns `total`, `new_24h`, `new_7d`, `active`, `inactive`, `latest_seen` in one query.
- `domain_subdomains_page(_domain_id, _search, _filter, _limit, _offset)` → returns one page of hosts plus an exact `total_count` for the current filter/search, ordered newest-first.

Both read-only and `STABLE`, callable by `anon` like the existing public RPCs.

**2. Domain page rewrite of the data layer (`src/lib/chaos-data.ts`)**
- Replace `subdomainsQuery` (the 60-page loop) with:
  - `domainStatsQuery(domainId)` → the stats RPC
  - `domainSubdomainsPageQuery(domainId, search, filter, page)` → 100 rows per page
- Delete the 60,000-row ceiling entirely.

**3. Domain page UI (`src/routes/domain.$domain.tsx`)**
- Stat cards read from the stats RPC: real 99,381 total, real 24h count. "New last scan" keeps using the domain row.
- Table becomes server-paged with Prev / Next and "Page N of M · X hosts", replacing the current "preview limited to 500 rows" note.
- Search and the all/new/inactive filter move server-side (they currently filter the truncated array, so they were also under-reporting).
- Copy all / export txt / csv / json switch to the existing streaming export endpoint (`/api/public/export`) with the current filter and search applied, so they emit the full set instead of whatever was loaded — this is what makes exports correct for 100k+ host programs.

**4. Same bug on other pages**
Audit and apply the same server-count treatment anywhere else a count is derived from a fetched array rather than from the database — program/platform pages and the dashboard totals — so the fix covers every platform, not just this one page.

## Notes

- Nothing about the scanner, cron cycle, or ingestion changes; the stored data was already correct.
- After this, the domain page loads a fixed ~100 rows regardless of program size, so `taobao.com` and `vodafone.com.tr` open as fast as small ones.

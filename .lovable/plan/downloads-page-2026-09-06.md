# Downloads page

A single page at `/downloads` where anyone (no login) can grab the full data sets as files.

## What the page offers

Two sections:

**Root domains**
- One card per platform (HackerOne, Bugcrowd, Intigriti, YesWeHack, Self-hosted) plus an "All platforms" card.
- Each card shows the domain count and buttons: TXT, CSV, JSON, and Copy.

**Subdomains**
- One card per platform plus "All platforms".
- Scope switch: All / New (last 24h) / Inactive, and a Live-only option.
- Same TXT / CSV / JSON buttons; downloads stream, so very large programs work.

Each card also shows the direct URL so it can be used with curl or a script.

## Technical notes

- New public route `src/routes/api/public/roots.ts` (`/api/public/roots`) streaming the `domains` table: params `platform`, `format=txt|csv|json`, default one domain per line, sorted, paged 1000 rows at a time through the admin client. Returns only `domain`, `platform slug`, `subdomain count` — no user data. CORS `*`, 404 on unknown platform.
- Subdomain downloads reuse the existing `/api/public/export` endpoint (already supports `platform`, `scope`, `format`, streaming) — no new backend work there. Live-only reuses `/raw/{platform}?scope=live`.
- New page `src/routes/downloads.tsx` with its own head metadata, counts from the existing platform stats query, and anchor-based downloads (no client-side buffering of huge files).
- Add "Downloads" to the top nav in `src/components/site/chrome.tsx`, and link it from `/programs` and `/docs/api/raw`.
- No database migration needed.

## Verification

- Download HackerOne root domains and confirm the line count matches the domain count shown on `/programs`.
- Download Bugcrowd subdomains as CSV and confirm headers plus row count.
- Confirm both work signed out and with plain `curl`.

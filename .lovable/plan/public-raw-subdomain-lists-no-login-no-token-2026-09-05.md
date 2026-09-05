# Public raw subdomain lists (no login, no token)

Add plain-text pages, one per program, that anyone can open in a browser or fetch with curl — just hosts, one per line, exactly like the raw lists on the reference site.

## URLs

```text
/raw/tesla.com                  all hosts for one root domain
/raw/tesla.com/new              only hosts first seen in the last 24 hours
/raw/hackerone                  every host across a platform
/raw/hackerone/tesla            every host for one program on that platform
```

Rules:
- No API key, no sign-in, no rate limit.
- Response is `text/plain`, one host per line, sorted, streamed so huge programs (100k+ hosts) work.
- Optional `?format=csv` or `?format=json` for the same data in other shapes.
- Optional `?hours=24` to change the "new" window, `?scope=inactive` for retired hosts.
- Unknown domain or platform returns an empty body with 404 so scripts can tell the difference.

## Discoverability

- A short "Raw lists" page at `/docs/api/raw` explaining the URL patterns with copy buttons.
- On each domain page and each program page, a "Raw list" link pointing at that program's URL.
- The raw pages are excluded from the sitemap (data, not content) but stay open to scripts.

## Technical notes

- New file route `src/routes/api/public/raw/$.ts` handling the splat, reusing the streaming/chunking logic already in `src/routes/api/public/export.ts` (chunked `domain_id` `in()` lists, 1000-row pages) rather than duplicating it — the shared part moves into `src/lib/raw-export.server.ts` and both routes call it.
- Pretty URLs `/raw/*` are served by a thin route that forwards to the same handler, so both `/raw/...` and `/api/public/raw/...` work.
- Platform-wide dumps use the existing `platform_subdomains_page` function with cursor paging inside the stream; single-program lookups reuse the same `program` name matching added to the v1 endpoint.
- Reads go through the admin client server-side; only `host`, `first_seen_at`, `last_seen_at`, `is_active` are ever exposed — no user data, no keys.
- No database migration and no change to the authenticated v1 API.

## Verification

- Fetch `/raw/tesla.com` and confirm the line count matches the count the dashboard shows for that domain.
- Fetch `/raw/hackerone` and confirm it pages past 10k hosts without truncation.
- Confirm the endpoints work with no `Authorization` header and from a signed-out browser.

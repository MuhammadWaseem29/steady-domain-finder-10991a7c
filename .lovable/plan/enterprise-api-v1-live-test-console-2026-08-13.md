# Enterprise API v1 + Live Test Console

Upgrade the existing token API into a full, documented, self-serve platform API with an interactive "try it" console like the ProjectDiscovery docs.

## What you get

1. **A richer API surface** — every dataset in the app reachable by token:
   - Domains: list, search, single domain with live stats, its subdomains (paged, filterable).
   - Subdomains: new discoveries across everything, plus new discoveries scoped to a single platform or a single domain; global host search.
   - Platforms: list with stats, single platform, its domains, its subdomains, its new hosts.
   - Scans: history (filter by domain/platform/status), single scan detail, queue a scan, full re-scan, queue/worker status.
   - Stats: global totals + time-series (hour/day/week/month/6-month) and per-platform / per-domain breakdowns.
   - Export: streaming TXT/CSV/JSON for any scope.
   - Account: `/me` with key info and usage.
2. **Enterprise behaviour on every endpoint**
   - Consistent `{ data, meta }` / `{ error: { code, message } }` envelope.
   - Cursor pagination on large lists plus `limit`/`offset` for small ones.
   - Per-key rate limiting with `X-RateLimit-*` headers and `429 rate_limited`.
   - `X-Request-Id` on every response, request logging per key (endpoint, status, duration) so `/account` can show usage.
   - Scoped keys: read-only vs read+write (write = queue scans), enforced server-side.
   - `ETag`/`Cache-Control: no-store` correctness, strict input validation, clean 4xx codes.
3. **Live API console at `/docs/api`**
   - Left nav of endpoints, center panel with description, params and response schema, right panel a runnable request builder: pick endpoint, fill path/query params and body, paste or auto-fill your `chs_live_` token, hit **Send**.
   - Shows real status code, timing, response headers and pretty-printed JSON, with copy-as-cURL / JS / Python snippets that update as you type.
   - Token is stored only in the browser for the session, never sent anywhere but your own API.
4. **Machine-readable spec** — `GET /api/v1/openapi.json` (OpenAPI 3.1) so the console, Postman and codegen all read from one source of truth.

## Technical notes

- Extend `src/lib/api-v1.server.ts` into a small router module set: `api-v1.server.ts` (dispatch, envelope, rate limit, logging) plus per-resource handlers in `src/lib/api/*.server.ts`. Both `/api/v1/$` and `/api/public/v1/$` keep forwarding to it.
- New tables (migration, RLS + GRANTs): `api_request_logs` (key_id, method, path, status, duration_ms, created_at) and `api_key_scopes` — or a `scopes text[]` column on `api_keys` with default `{read}`. Rate limiting via a counter RPC keyed on `(key_id, minute)`.
- Stats endpoints reuse existing RPCs (`platform_stats`, `domain_subdomain_stats`, `new_subs_page`, `domain_cycle_counts`) and add a time-bucket RPC for the series.
- Console lives at `src/routes/docs/api.tsx` (rewritten) with a reusable `src/components/site/api-console.tsx`; requests go from the browser straight to `/api/v1/...` with the user's token, so CORS stays as-is.
- `/account` gains scope selection when creating a key and a usage panel fed by `api_request_logs`.

## Testing before I hand it back

- Create a live key, then exercise every endpoint end-to-end against the real database: domains, subdomains/new, platform-scoped new hosts, stats series, scan history, queue scan (202), export streaming, openapi.json.
- Verify auth failures (missing/invalid/revoked token), scope enforcement on write endpoints, rate-limit 429 + headers, pagination cursors returning non-overlapping pages, and 404/405/400 codes.
- Drive the console in a real browser: send a request, confirm the rendered response matches a cURL run of the same call.

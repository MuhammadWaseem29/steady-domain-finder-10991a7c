# Enterprise API Reference with Live Console

Replace the current static API page with a full reference site styled like docs.projectdiscovery.io: a three-pane layout with endpoint navigation, rich documentation, and a runnable request console on every endpoint page.

## What you get

1. **A dedicated page per endpoint** at `/docs/api/{endpoint}` — every endpoint in the existing spec (domains, subdomains, new discoveries, platforms, scans, stats, export, account) gets its own shareable URL, title and description.
2. **Three-pane layout**
   - Left: grouped endpoint list with method badges (GET/POST) and search-as-you-type filter.
   - Center: endpoint summary, auth requirement, path/query/body parameters with types, defaults and enums, plus response schema and error codes.
   - Right: sticky "Try it" console and code samples.
3. **Live console**
   - Paste your `chs_live_` token once; it is remembered in the browser only and reused across every endpoint page.
   - Fill path/query params from generated inputs, hit Send, and see real status code, timing, response headers and pretty-printed JSON with copy button.
   - Auto-fill of the token from your account when signed in.
4. **Code samples that track your inputs** — cURL, JavaScript (fetch) and Python (requests) tabs regenerate as you edit parameters, with one-click copy.
5. **Polish** — overview landing page at `/docs/api` (auth, base URLs, envelope, pagination, rate limits, error table), keyboard-friendly nav, dark/light aware, mobile drawer for the endpoint list, and a link to the machine-readable `/api/v1/openapi.json`.

## Technical notes

- `src/lib/api-spec.ts` stays the single source of truth; the new pages, samples and OpenAPI output all read from it. Extend entries with response-schema field lists and per-endpoint error codes where missing.
- New route files: `src/routes/docs/api.tsx` becomes a layout rendering the shell plus `<Outlet />`, `src/routes/docs/api.index.tsx` is the overview, `src/routes/docs/api.$endpoint.tsx` renders one endpoint from the spec (404 for unknown ids). Each defines its own `head()` metadata.
- New components under `src/components/site/api/`: `reference-shell.tsx` (nav + panes), `try-it-console.tsx` (form, send, response viewer), `code-samples.tsx`, `param-table.tsx`, `schema-view.tsx`.
- Requests go from the browser directly to `/api/v1/...` (same origin), so no backend or CORS change is needed. Token kept in `sessionStorage` only.
- No changes to API behaviour, auth, rate limiting or the database.

## Verification

- Load every generated endpoint page and confirm params, samples and metadata render from the spec.
- Drive the console in a real browser with a live token: send a GET (domains, subdomains/new, stats) and confirm the rendered response matches the same call made with cURL; confirm a missing token returns the documented 401 shape.
- Check the mobile layout and that the sitemap includes the new endpoint pages.

## Goal

Add accounts to the site and a real API so data can be pulled programmatically with a token. Browsing stays public; actions (scan now, full re-scan, add/edit/delete domains and programs, queue cancel) and API-key management require sign-in.

## 1. Authentication

- New public route `/auth` — single card with **Continue with Google** (managed broker) and email/password sign-in + sign-up tabs, styled to match the Chaos look.
- Google provider gets enabled on the backend in the same step, so the first click works.
- Profiles table (`profiles`: user id, email, display name, avatar) auto-created on signup by a trigger, so the header can show who's signed in.
- Header changes: `Sign in` button when signed out; avatar/email menu with **Account** and **Sign out** when signed in.
- Session listener wired once at the app root so the header and gated buttons react instantly to sign-in/out.

## 2. Gating actions (site stays public)

Every page keeps working for anonymous visitors. These become sign-in-required, with an inline "Sign in to do this" prompt instead of a redirect:

- Dashboard: add/import domains, edit, delete, scan now
- Programs: create/edit/delete program, per-domain actions
- Queue: full re-scan, cancel job
- Domain page: scan now

Server-side each of those switches to an authenticated server function, so gating is enforced on the backend, not just hidden in the UI.

## 3. API tokens

- New `api_keys` table: owner, name, key prefix (shown in UI), hashed secret, created/last-used timestamps, revoked flag. Only the hash is stored; the full key `chs_live_…` is shown once at creation.
- New **Account / API keys** page (`/account`): create a named key, copy it once, see prefix + last used, revoke.

## 4. Public REST API

Base: `https://steady-domain-finder.lovable.app/api/v1/…`, auth via `Authorization: Bearer chs_live_…`. JSON responses, consistent `{ data, meta }` envelope and clear error codes.

Read endpoints:
- `GET /api/v1/domains` — list with search, platform filter, paging
- `GET /api/v1/domains/{domain}` — domain detail + counts
- `GET /api/v1/domains/{domain}/subdomains` — paged hosts, filters `all|new|inactive`, search
- `GET /api/v1/subdomains/new` — newly discovered hosts across everything, `since`/`window` param
- `GET /api/v1/platforms` — program list with stats
- `GET /api/v1/platforms/{slug}/domains`
- `GET /api/v1/scans` — recent scan history, filterable by domain
- `GET /api/v1/export` — streaming bulk export (txt/csv/json) with the same scope filters as the UI

Write endpoints:
- `POST /api/v1/scans` — queue a scan for a domain
- `POST /api/v1/scans/rescan-all` — mark everything due

All endpoints validate input, resolve the token to a user, stamp `last_used_at`, and never expose backend keys.

## 5. Docs

New `/docs/api` page in the existing docs layout: authentication, every endpoint with parameters, curl examples and sample JSON — matching the current docs styling. Header/footer links updated.

## Technical notes

- Tables `profiles` and `api_keys` get row-level security scoped to the owner, plus the required grants; the API routes live under `src/routes/api/v1/*` and verify the bearer token themselves (SHA-256 compare against the stored hash) before touching data with the service client.
- Existing `/api/public/export` stays as-is for the in-app download buttons.

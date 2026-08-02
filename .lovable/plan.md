## 1. Professional API docs with an interactive "Try it" console

Rework `/docs/api` into a proper reference page:

- **Docs shell upgrade** (`src/components/site/docs.tsx`): add a copy-to-clipboard button on every code block, a `Method` badge palette (GET green / POST amber), and an anchor-linked section header.
- **New `ApiConsole` component** (`src/components/site/api-console.tsx`):
  - One console per endpoint, collapsed by default.
  - Token field at the top of the page (stored in `sessionStorage`, never persisted to disk or sent anywhere but this API), shared by all consoles.
  - Editable inputs for every path param (`{domain}`, `{slug}`) and query param (`limit`, `offset`, `search`, `platform`, `filter`, `hours`, `scope`, `format`), plus a JSON body box for the POST endpoints.
  - Live-updating curl snippet that reflects the current inputs, with a one-click Copy.
  - **Send** button → fetches `/api/public/v1/...` from the browser, shows status code, response time, and pretty-printed JSON (truncated with a "copy full response" action). Export endpoint shows a download link instead of dumping the body.
  - Errors surface the API's `{ error: { code, message } }` shape.
- **Docs content**: every endpoint gets purpose, auth requirement, full parameter table (`Param` rows), a sample response, and a live console. Add sections for rate/size notes, pagination + cursors, and a quick-start (create token → first call → export). Base URL selector (`/api/v1` vs `/api/public/v1`) drives the snippets. The base URL uses the current origin so the docs work on the custom domain too.

## 2. Recent-subs feed: open hosts in a new tab

In `src/routes/recentsubs.tsx` (and the same row renderer used elsewhere in that page):

- Each host row keeps its monospace text but gains two small icon buttons on hover/right side: **https** and **http**, each opening `https://host` / `http://host` in a new tab (`target="_blank"`, `rel="noopener noreferrer nofollow"`).
- Host text itself stays selectable/copyable; the existing copy-per-row action remains.
- Same treatment applied to the grouped-by-domain view.

## 3. New `/live` page

A workspace for hosts you have manually verified as live.

- Route `src/routes/live.tsx` with its own `head()` metadata, added to the header nav.
- **Paste box**: paste any blob of text; it parses out hostnames (one per line, comma/space separated, strips `http(s)://`, ports, paths), de-dupes against what's already stored, and reports how many were added/skipped.
- **List view**: search filter, sort (newest / A–Z / by root domain), per-row https/http open-in-new-tab buttons, per-row copy and delete, multi-select with bulk delete.
- **Bulk tools**: Copy all, Copy filtered, Export as TXT / CSV / JSON, and Clear all (with confirm).
- **Stats strip**: total live hosts, unique root domains, added today, last added time.
- Optional note field per host (short label like "admin panel").
- Styling and motion match the rest of the site (animated counters, staggered row entry, dark-mode tokens).

### Technical notes

- Storage: a new `live_hosts` table (host, note, added_at, user_id) with RLS so each signed-in owner sees only their own rows; reads/writes go through server functions using the authenticated Supabase client. If you are not signed in, the page prompts sign-in rather than silently storing locally.
- The API console calls the existing `/api/public/v1/*` splat route — no backend changes needed; only the export endpoint is handled specially (link instead of inline body).
- Token entered in the docs console is kept in memory/`sessionStorage` only and is never logged or stored server-side.
- Host parsing and all inputs are validated with zod (max lengths, hostname regex) both client-side and in the server functions.

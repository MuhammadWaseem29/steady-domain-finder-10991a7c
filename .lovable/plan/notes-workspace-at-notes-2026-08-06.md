# Notes workspace at /notes

A colorful, professional page where a signed-in user keeps their own research notes about hosts: live subdomains, interesting data, AI-generated sites, and anything else they want to track.

## What the page does

- Four built-in boards, each a colored card column:
  - **Live subdomains** — hosts confirmed alive
  - **Interesting data** — endpoints, leaks, odd responses
  - **AI generated sites** — hosts that look AI-built
  - **Other notes** — free-form catch-all
- Each board starts empty with a friendly empty state and an "Add entry" box.
- An entry has: host (optional), scheme (http / https / both), a note body, and optional tags.
- Hosts render as clickable links using the chosen scheme; when "both" is picked, two small http / https launch buttons appear side by side.
- Inline edit, delete, and drag-free "move to another board" via a small board selector on each entry.
- Bulk paste: paste many hosts at once into a board and each line becomes an entry (scheme auto-detected from `http://` / `https://` prefixes, defaults to https).
- Search box filters across all boards; per-board counters; copy-all-hosts and export (TXT / CSV / JSON) per board.
- Data is private per user: you only ever see your own notes. Signed-out visitors see the page layout with a sign-in prompt instead of data.

## Look and feel

Matches the existing site (dark/light theme tokens, Figtree + JetBrains Mono, framer-motion reveals). Each board gets its own accent color token, animated counters, hover lift on cards, and staggered entry reveals — consistent with `/recentsubs` quality level.

## Technical notes

- New table `public.notes`: `id`, `user_id`, `board` (enum-like text: live/interesting/ai/other), `host` (nullable), `scheme` (`http` | `https` | `both`, default `https`), `body`, `tags text[]`, `created_at`, `updated_at`, plus `updated_at` trigger. Migration includes `GRANT` to `authenticated` + `service_role` and RLS policies scoped to `auth.uid() = user_id` for select/insert/update/delete. No anon access.
  - The existing unused `live_hosts` table stays untouched.
- New `src/lib/notes.functions.ts` with `listNotes`, `upsertNote`, `bulkAddNotes`, `deleteNote`, `moveNote`, all behind `requireSupabaseAuth` (RLS as the user, no admin client).
- New route `src/routes/notes.tsx` with its own `head()` metadata, using TanStack Query (`useQuery` + mutations, not loader — the data is auth-gated) and existing chrome components (`SiteShell`, `Reveal`, `Stat`, `SignInNotice`).
- New `src/components/site/notes-board.tsx` for the board column + entry card, keeping the route file thin.
- Add "Notes" to the header nav in `src/components/site/chrome.tsx`.
- Host input validated with zod (length + hostname charset), note body capped at 4000 chars; exports built client-side from already-loaded rows.

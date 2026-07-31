## Goal

A clone of chaos.projectdiscovery.io that continuously monitors domains with the Chaos DNS API, stores every subdomain in a database, re-scans automatically every hour, and highlights newly discovered subdomains with copy/export tools. First tracked domain: `lovable.app`.

## Verified facts

- Chaos endpoint: `GET https://dns.projectdiscovery.io/dns/{domain}/subdomains` with header `Authorization: <API_KEY>`.
- Response: `{"domain":"lovable.app","subdomains":["www","connect","yt",...],"count":N}` — labels are relative, full host = `label + "." + domain`.
- Tested the provided key against `lovable.app`: it works and returns thousands of labels.

## What gets built

### 1. Backend (Lovable Cloud)

Tables:
- `domains` — root domain, enabled flag, last_scanned_at, subdomain counts.
- `subdomains` — domain_id, label, full host, first_seen_at, last_seen_at, is_active. Unique on (domain_id, host).
- `scans` — scan run log: domain, started/finished, total returned, new count, removed count, status, error message.

Scan logic (server function + public API route):
- Fetch Chaos for a domain, diff against stored rows.
- Insert unseen hosts (marked new, timestamped), refresh `last_seen_at` on existing, flag missing ones inactive.
- Write a `scans` row with the new-subdomain delta.

Scheduling:
- `pg_cron` job running hourly, calling a secured `/api/public/cron/scan` route with a shared cron secret; the route scans every enabled domain.
- Manual "Run scan now" button triggers the same logic on demand.

The Chaos API key is stored as a backend secret (never shipped to the browser). All Chaos calls happen server-side.

### 2. Frontend — Chaos site clone

Public marketing pages styled like chaos.projectdiscovery.io (dark ProjectDiscovery aesthetic, monospace accents, terminal-style code blocks):
- Home: hero, live stats (domains tracked, total subdomains, new in last 24h), search box, feature grid, footer.
- Docs pages mirroring "Fetch Subdomains" and "API Key" layout with sidebar + on-this-page nav.

Dashboard (the working part):
- Domain list with counts, last scan time, next scan countdown.
- Domain detail: full subdomain table with search/filter, "New" badges, tabs for All / New (last 24h / since last scan) / Removed.
- Scan history timeline with per-run new-subdomain deltas.
- Copy all, copy new only, export as TXT / CSV / JSON.
- Manual rescan button with live status.

### 3. Multi-domain support

The schema and scanner are domain-agnostic from day one, so later you can paste or upload `root_domains.txt` to bulk-add domains and they all get scanned on the same hourly cycle. Initially seeded with `lovable.app` only.

## Technical notes

- Scanner is one server function reused by both cron and manual triggers; concurrency-guarded per domain so overlapping runs can't double-insert.
- Chaos responses for large domains (10k+ labels) are inserted in chunked batches to stay within request limits.
- Row Level Security: public read on domains/subdomains/scans (this is public recon data), writes restricted to the server role.
- Cron secret and Chaos key both stored as backend secrets; you'll be prompted to confirm the Chaos key gets saved securely rather than hardcoded.

# Live subdomains with real httpx

## Is httpx compatible?

Not inside this site's backend. Real httpx is a compiled Go program that opens its own network connections; the backend here runs in a sandbox that cannot execute programs or open raw sockets. Any "live check" written in the site itself would be a weak imitation, not httpx.

The way to use the real thing: the site becomes the control panel and the database, and actual httpx runs in a free runner you own. You press "Probe live hosts" on a program; the runner picks the job up, runs genuine `projectdiscovery/httpx`, and streams results back into the site. Nothing changes about how httpx behaves — it is the official binary, with all its flags.

## Recommended runner: GitHub Actions (free, nothing to maintain)

You don't need a server. A small repository with one workflow file:

- Checks every 5 minutes (and can be started instantly by a button press on the site).
- Installs httpx from ProjectDiscovery's official release.
- Pulls the queued job, runs httpx over that program's host list, posts results back.
- Free minutes cover a lot; long programs simply continue in the next run.

I will generate the whole repository content for you to paste — one file, plus one secret (a runner token the site issues). A Docker one-liner for a VPS will be documented too, in case you later want continuous probing; the same job queue serves both.

## What you get on the site

1. **"Probe live hosts" button** on each program page and each domain page. Choose the host set: all hosts, only new ones, or a search-filtered subset.
2. **Job status panel** — queued / running / finished, hosts probed, live count, elapsed time, live progress while the runner works.
3. **Live hosts page** at `/live` and a live tab per program/domain, showing everything useful httpx returns:
   URL, status code, page title, content length, response time, web server, detected technologies, CDN, IP and ASN, CNAME, redirect chain, TLS issuer and expiry, favicon hash.
4. **Filter and sort** by status code, technology, title text, CDN, host — plus "only 200s", "only redirects", "only interesting" presets.
5. **Copy and export** the live list as TXT / CSV / JSON, matching the existing export style, and a public raw list at `/raw/{program}/live` alongside the current raw lists.
6. **History** — each probe run is kept, so you can see which hosts went live or died between runs.

## Technical notes

**Database (one migration)**
- `probe_jobs` — target domain or platform+program, scope (all/new/search), status, counts, timestamps, claimed_at, requested_by.
- `probe_results` — job_id, host, url, scheme, port, status_code, title, content_length, response_time_ms, webserver, technologies text[], cdn, ip, asn, cname, redirect_chain, tls_issuer, tls_expires_at, favicon_hash, failed flag, probed_at. Unique on (job_id, url); index on host.
- `probe_runners` — hashed runner tokens, name, last_seen_at, revoked.
- RLS: results and jobs readable publicly (they describe public scope data), writes only by service role. Job creation goes through a signed-in server function so runs can be attributed.

**Endpoints (TanStack server routes under `src/routes/api/public/probe/`)**
- `POST /next` — runner claims one queued job (atomic claim RPC), receives the host list in pages.
- `POST /results` — runner posts httpx JSONL batches; upserted into `probe_results`, job counters updated.
- `POST /complete` — marks finished/failed. All three authenticate with `Authorization: Bearer <runner token>` verified against `probe_runners`; unauthenticated calls are rejected.
- Stale jobs (claimed but silent for 20 minutes) are re-queued automatically.

**Runner workflow** — checkout-free workflow that downloads the httpx release, runs
`httpx -l hosts.txt -json -sc -title -cl -rt -server -td -cdn -ip -asn -cname -location -tls-grab -favicon -silent`,
splits output into batches and POSTs them. Concurrency and rate flags are configurable in the workflow file.

**Frontend** — new route `src/routes/live.tsx`, a `LiveHostsPanel` component reused on program and domain pages, and a `ProbeButton` that creates a job and polls status. Docs page under `/docs/api` covering the runner setup and the probe endpoints.

## Verification

- Create a job from a program page, run the runner locally against the preview URL, confirm results land and the panel updates.
- Confirm an unauthenticated call to each probe endpoint is rejected.
- Probe a program with tens of thousands of hosts and confirm batching, resume-after-timeout and export all hold up.

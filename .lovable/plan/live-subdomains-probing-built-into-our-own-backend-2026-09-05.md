# Live subdomains — probing built into our own backend

You asked for no GitHub Actions and nothing installed on your side. So the probing runs entirely on our backend, triggered from the site.

One honest note up front, because it changes what I build: ProjectDiscovery's httpx is a compiled Go program, and our backend cannot execute programs or open raw sockets. What it *can* do is make HTTPS requests and DNS lookups at high concurrency. So the prober is written into our backend and produces the exact same result fields httpx produces, from the same kind of probe (a real request to `https://host` and `http://host`, following redirects). Nothing to install, nothing for you to run — you press a button and results appear.

If you ever want the literal Go binary too, the same queue and tables accept results posted by a self-hosted httpx runner; that stays possible later without redesigning anything.

## What you get

1. **"Probe live hosts" button** on each program page and each domain page. Pick the host set: all hosts, only new ones, or the current search filter.
2. **Background probe jobs** — the request queues instantly and our backend works through it in batches (a few hundred hosts per pass, high concurrency, resumable), so a program with 100k hosts finishes without timing out.
3. **Live progress** — probed / live / dead counters, elapsed time, and results appearing as they land.
4. **Per-host detail, httpx-style fields:**
   - URL, final URL after redirects, scheme, port, status code, response time
   - page title, content length, content type, body hash, favicon hash
   - web server header, detected technologies, CDN/WAF detection
   - resolved IP and ASN, CNAME chain, redirect chain
   - TLS issuer, subject CN, SAN list and expiry date
5. **Live hosts view** at `/live` plus a Live tab on program and domain pages: filter by status code, technology, title text, CDN; presets for "only 200s", "redirects", "auth-walled (401/403)", "interesting".
6. **Copy and export** as TXT / CSV / JSON, matching existing exports, plus public raw lists at `/raw/{program}/live`.
7. **History** — each run is kept, so you can see hosts that went live or died between runs, and the API exposes the live data at `/api/v1/live`.

## Technical notes

- **Migration:** `probe_jobs` (target domain or platform+program, scope, status, counters, claimed_at, cursor) and `probe_results` (job_id, domain_id, host, url, final_url, status_code, title, content_length, content_type, response_time_ms, webserver, technologies text[], cdn, ip, asn, cname, redirect_chain, tls_issuer, tls_subject, tls_expires_at, body_hash, favicon_hash, failed, error, probed_at). Unique on (host, url); index on domain_id and status_code. Public read, service-role write, job creation via an authenticated server function.
- **Probe engine** in `src/lib/probe.server.ts`: batches of hosts, ~50 concurrent `fetch` calls with a short timeout and `redirect: "manual"` so the redirect chain is recorded; HTTPS first, HTTP fallback; title/length/hash parsed from a capped body read; CDN/tech inferred from headers and body fingerprints; IP/CNAME via DNS-over-HTTPS (1.1.1.1) and ASN via the Team Cymru DoH lookup; TLS details from the DoH/certificate transparency lookup where the runtime does not expose the handshake.
- **Job driver:** `POST /api/public/hooks/probe` (secret-header protected, same pattern as the existing scan hook) claims the next queued job and processes one batch per invocation, driven by pg_cron every minute; the button also kicks one pass immediately so results start within seconds.
- **Frontend:** `src/routes/live.tsx`, a reusable `LiveHostsPanel`, a `ProbeButton` that creates a job and polls it, and a docs page under `/docs/api` describing the live endpoints and the field list.

## Verification

- Queue a probe for a small program, confirm results, counters and the panel update live, then compare a handful of hosts against a manual request to check status, title and redirect chain match.
- Queue a large program and confirm batching, resume after interruption, and export of the full list.
- Confirm the probe hook rejects unauthenticated calls.

# Live subdomains (in-backend probing)

- [ ] Migration: probe_jobs + probe_results tables, claim/upsert RPCs
- [ ] Probe engine src/lib/probe.server.ts (fetch batches, title/status/tech/CDN/IP/ASN)
- [ ] Hook route POST /api/public/hooks/probe + pg_cron schedule
- [ ] Server fns: createProbeJob, probeJobStatus, liveHostsPage
- [ ] UI: ProbeButton, LiveHostsPanel, /live route, domain + program page integration
- [ ] Public raw lists /raw/{program}/live (+ api v1 /live endpoints)
- [ ] Docs page /docs/api/live
- [ ] Verify: small probe live in browser, large program batching, hook auth rejection

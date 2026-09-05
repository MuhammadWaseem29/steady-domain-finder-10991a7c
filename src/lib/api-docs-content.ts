/** Static reference content for the API documentation site. Client-safe. */

export type DocError = {
  status: number;
  code: string;
  when: string;
  fix: string;
};

export const API_ERRORS: DocError[] = [
  {
    status: 400,
    code: "invalid_body",
    when: "A POST body was missing or was not valid JSON.",
    fix: 'Send Content-Type: application/json with a body such as { "domain": "example.com" }.',
  },
  {
    status: 400,
    code: "invalid_domain",
    when: "The supplied domain is not a valid root domain.",
    fix: "Use the bare root domain, lowercase, with no scheme or path.",
  },
  {
    status: 400,
    code: "invalid_query",
    when: "A required query parameter was missing or too short.",
    fix: "Check the parameter table for the endpoint — search needs at least 2 characters.",
  },
  {
    status: 400,
    code: "invalid_id",
    when: "A path id was not a UUID.",
    fix: "Pass the id exactly as returned by the list endpoint.",
  },
  {
    status: 401,
    code: "missing_token",
    when: "No Authorization or X-API-Key header was sent.",
    fix: "Add Authorization: Bearer chs_live_… to the request.",
  },
  {
    status: 401,
    code: "invalid_token",
    when: "The token is malformed or unknown.",
    fix: "Create a fresh token on the account page; tokens are shown once at creation.",
  },
  {
    status: 401,
    code: "revoked_token",
    when: "The token was revoked by its owner.",
    fix: "Create a new token and update your integration.",
  },
  {
    status: 403,
    code: "insufficient_scope",
    when: "A write endpoint was called with a read-only key.",
    fix: "Create a key with the write scope for queueing scans.",
  },
  {
    status: 404,
    code: "not_found",
    when: "The domain, platform, scan or endpoint does not exist.",
    fix: "Check the path; list endpoints show every valid value.",
  },
  {
    status: 404,
    code: "unknown_platform",
    when: "The platform slug is not one of the tracked programs.",
    fix: "Call GET /platforms for the current slugs.",
  },
  {
    status: 405,
    code: "method_not_allowed",
    when: "The HTTP verb is not supported on that path.",
    fix: "Use the verb shown on the endpoint page.",
  },
  {
    status: 500,
    code: "query_failed",
    when: "A database query failed while serving the request.",
    fix: "Retry once; if it persists, include the X-Request-Id when reporting it.",
  },
  {
    status: 500,
    code: "server_error",
    when: "An unexpected error occurred.",
    fix: "Retry with exponential back-off and report the X-Request-Id.",
  },
];

export type DocGuide = {
  id: string;
  title: string;
  intro: string;
  language: string;
  code: string;
};

export const API_GUIDES: DocGuide[] = [
  {
    id: "watch-new-hosts",
    title: "Watch for new hosts every hour",
    intro:
      "Poll the global discovery feed on a schedule and act on anything first seen since your last run.",
    language: "bash",
    code: `# cron: 5 * * * *
curl -s "$BASE/subdomains/new?hours=1&limit=2000" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" \\
  | jq -r '.data[].host' >> new-hosts.txt`,
  },
  {
    id: "paginate-cursor",
    title: "Page through a large discovery window",
    intro:
      "Cursor pagination never skips or repeats rows, even while new hosts are landing mid-run.",
    language: "python",
    code: `import requests

base = "https://chaos.thescope.top/api/v1"
headers = {"Authorization": f"Bearer {TOKEN}"}
params = {"hours": 24, "limit": 2000}
hosts = []

while True:
    r = requests.get(f"{base}/subdomains/new", headers=headers, params=params, timeout=60)
    r.raise_for_status()
    body = r.json()
    hosts += [row["host"] for row in body["data"]]
    cursor = body["meta"].get("next_cursor")
    if not cursor or not body["data"]:
        break
    params.update(cursor)

print(len(hosts), "hosts")`,
  },
  {
    id: "bulk-export",
    title: "Export 100k+ hosts for a whole program",
    intro: "The export endpoint streams, so memory stays flat no matter how large the program is.",
    language: "bash",
    code: `curl -N "$BASE/export?platform=bugcrowd&scope=all&format=txt" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" \\
  -o bugcrowd-hosts.txt`,
  },
  {
    id: "queue-and-poll",
    title: "Queue a re-scan and poll for the result",
    intro:
      "Queueing returns 202 immediately; large domains finish in the background across worker ticks.",
    language: "bash",
    code: `curl -s -X POST "$BASE/scans" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"lovable.app"}'

# then poll history for the freshest scan of that domain
curl -s "$BASE/scans?domain=lovable.app&limit=1" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" | jq '.data[0]'`,
  },
  {
    id: "mirror",
    title: "Keep a local mirror in sync",
    intro: "Full snapshot once, then hourly deltas — the cheapest way to stay current.",
    language: "bash",
    code: `# 1. one-time snapshot
curl -N "$BASE/export?format=csv" -H "Authorization: Bearer $CHAOS_TOKEN" -o all.csv

# 2. hourly delta
curl -s "$BASE/subdomains/new?hours=1&limit=2000" \\
  -H "Authorization: Bearer $CHAOS_TOKEN" | jq -r '.data[] | [.host,.domain,.first_seen_at] | @csv' >> all.csv`,
  },
];

export type DocChange = { date: string; title: string; items: string[] };

export const API_CHANGELOG: DocChange[] = [
  {
    date: "2026-09-05",
    title: "Reference site + full coverage",
    items: [
      "New documentation site with a runnable console on every endpoint.",
      "Added /stats, /stats/timeseries, /stats/top-domains, /subdomains/search, /scans/status, /scans/{id}, /platforms/{slug}/subdomains/new and /domains/{domain}/subdomains/new.",
      "Every response now carries an X-Request-Id header.",
      "Scope enforcement: queueing scans requires a key with the write scope.",
      "Machine-readable spec published at /api/v1/openapi.json.",
    ],
  },
  {
    date: "2026-08-13",
    title: "API v1",
    items: [
      "Bearer-token authentication with chs_live_ keys.",
      "Domains, subdomains, platforms, scans and streaming export endpoints.",
    ],
  },
];

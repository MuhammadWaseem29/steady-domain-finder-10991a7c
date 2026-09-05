/**
 * Single source of truth for the public REST API (v1).
 * Client-safe: powers the live console, the docs page and /api/v1/openapi.json.
 */

export type ApiParam = {
  name: string;
  in: "path" | "query" | "body";
  type: "string" | "integer" | "boolean";
  required?: boolean;
  description: string;
  default?: string | number;
  enum?: string[];
  example?: string | number;
};

export type ApiEndpoint = {
  id: string;
  group: string;
  method: "GET" | "POST";
  /** Template path relative to the API base, e.g. /domains/{domain} */
  path: string;
  summary: string;
  description: string;
  scope: "read" | "write";
  params: ApiParam[];
  responseExample: string;
};

export const API_GROUPS = [
  "Getting started",
  "Domains",
  "Subdomains",
  "Platforms",
  "Scans",
  "Stats",
  "Export",
] as const;

const limit = (def: number, max: number): ApiParam => ({
  name: "limit",
  in: "query",
  type: "integer",
  description: `Rows to return (max ${max}).`,
  default: def,
});

const offset: ApiParam = {
  name: "offset",
  in: "query",
  type: "integer",
  description: "Rows to skip.",
  default: 0,
};

const hours: ApiParam = {
  name: "hours",
  in: "query",
  type: "integer",
  description: "Look-back window in hours. Ignored when `since` is supplied.",
  default: 24,
};

const since: ApiParam = {
  name: "since",
  in: "query",
  type: "string",
  description: "ISO-8601 timestamp; overrides `hours`.",
  example: "2026-08-01T00:00:00Z",
};

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "index",
    group: "Getting started",
    method: "GET",
    path: "/",
    summary: "API index",
    description:
      "Unauthenticated discovery document listing the API version, docs URL and every available endpoint.",
    scope: "read",
    params: [],
    responseExample: `{ "data": { "version": "1", "endpoints": ["GET /domains", "…"] } }`,
  },
  {
    id: "me",
    group: "Getting started",
    method: "GET",
    path: "/me",
    summary: "Current token",
    description:
      "Identity behind the presented token: owner, key name and granted scopes.",
    scope: "read",
    params: [],
    responseExample: `{ "data": { "user_id": "…", "key": { "name": "recon-laptop", "scopes": ["read"] } } }`,
  },
  {
    id: "openapi",
    group: "Getting started",
    method: "GET",
    path: "/openapi.json",
    summary: "OpenAPI 3.1 spec",
    description:
      "Machine-readable specification of every endpoint — import it into Postman, Insomnia or a codegen tool.",
    scope: "read",
    params: [],
    responseExample: `{ "openapi": "3.1.0", "info": { "title": "Chaos Subdomain Monitor API", "version": "1.0.0" } }`,
  },

  {
    id: "domains-list",
    group: "Domains",
    method: "GET",
    path: "/domains",
    summary: "List tracked domains",
    description: "Every root domain the monitor scans, with live counters and last scan status.",
    scope: "read",
    params: [
      {
        name: "search",
        in: "query",
        type: "string",
        description: "Case-insensitive substring match on the domain.",
      },
      {
        name: "platform",
        in: "query",
        type: "string",
        description: "Filter by platform slug (hackerone, bugcrowd, intigriti, yeswehack, self).",
      },
      {
        name: "enabled",
        in: "query",
        type: "boolean",
        description: "Only enabled (true) or disabled (false) domains.",
      },
      {
        name: "sort",
        in: "query",
        type: "string",
        description: "Ordering of the result set.",
        enum: ["domain", "total_subdomains", "new_subdomains_last_scan", "last_scanned_at"],
        default: "domain",
      },
      limit(100, 1000),
      offset,
    ],
    responseExample: `{ "data": [ { "domain": "lovable.app", "total_subdomains": 9948 } ], "meta": { "limit": 100, "offset": 0, "total": 10461 } }`,
  },
  {
    id: "domain-get",
    group: "Domains",
    method: "GET",
    path: "/domains/{domain}",
    summary: "Get one domain",
    description: "A single root domain with computed stats: total, new 24h / 7d, active, inactive.",
    scope: "read",
    params: [
      {
        name: "domain",
        in: "path",
        type: "string",
        required: true,
        description: "Root domain.",
        example: "lovable.app",
      },
    ],
    responseExample: `{ "data": { "domain": "lovable.app", "stats": { "total": 9948, "new_24h": 12 } } }`,
  },
  {
    id: "domain-subdomains",
    group: "Domains",
    method: "GET",
    path: "/domains/{domain}/subdomains",
    summary: "List a domain's hosts",
    description: "Paged hosts for one root domain, newest first. Handles 100k+ hosts.",
    scope: "read",
    params: [
      {
        name: "domain",
        in: "path",
        type: "string",
        required: true,
        description: "Root domain.",
        example: "lovable.app",
      },
      {
        name: "filter",
        in: "query",
        type: "string",
        description: "Subset of hosts to return.",
        enum: ["all", "new", "inactive"],
        default: "all",
      },
      { name: "search", in: "query", type: "string", description: "Substring match on the host." },
      limit(100, 1000),
      offset,
    ],
    responseExample: `{ "data": [ { "host": "www.lovable.app", "first_seen_at": "2026-07-02T10:00:00Z", "is_active": true } ], "meta": { "total": 9948 } }`,
  },
  {
    id: "domain-new",
    group: "Domains",
    method: "GET",
    path: "/domains/{domain}/subdomains/new",
    summary: "New hosts for a domain",
    description: "Hosts first seen for this root domain inside the requested window.",
    scope: "read",
    params: [
      {
        name: "domain",
        in: "path",
        type: "string",
        required: true,
        description: "Root domain.",
        example: "lovable.app",
      },
      hours,
      since,
      limit(500, 2000),
    ],
    responseExample: `{ "data": [ { "host": "vpn-new.lovable.app", "first_seen_at": "2026-08-13T09:12:00Z" } ], "meta": { "since": "…", "count": 1 } }`,
  },

  {
    id: "subs-new",
    group: "Subdomains",
    method: "GET",
    path: "/subdomains/new",
    summary: "New hosts across everything",
    description:
      "Every newly discovered host across all programs, newest first. Page with `meta.next_cursor`.",
    scope: "read",
    params: [
      hours,
      since,
      limit(500, 2000),
      {
        name: "before_ts",
        in: "query",
        type: "string",
        description: "Cursor: `first_seen_at` of the last row from the previous page.",
      },
      {
        name: "before_id",
        in: "query",
        type: "string",
        description: "Cursor: `id` of the last row from the previous page.",
      },
    ],
    responseExample: `{ "data": [ { "host": "a.example.com", "domain": "example.com", "first_seen_at": "…" } ], "meta": { "next_cursor": { "before_ts": "…", "before_id": "…" } } }`,
  },
  {
    id: "subs-search",
    group: "Subdomains",
    method: "GET",
    path: "/subdomains/search",
    summary: "Search all hosts",
    description: "Global substring search across every host in the database.",
    scope: "read",
    params: [
      {
        name: "q",
        in: "query",
        type: "string",
        required: true,
        description: "Substring to search for (min 2 characters).",
        example: "vpn",
      },
      limit(100, 1000),
      offset,
    ],
    responseExample: `{ "data": [ { "host": "vpn.example.com", "domain": "example.com" } ], "meta": { "q": "vpn", "limit": 100 } }`,
  },

  {
    id: "platforms-list",
    group: "Platforms",
    method: "GET",
    path: "/platforms",
    summary: "List platforms",
    description: "Bug-bounty programs with domain counts, subdomain totals and 24h discoveries.",
    scope: "read",
    params: [],
    responseExample: `{ "data": [ { "slug": "hackerone", "domain_count": 4210, "subdomain_count": 1200334, "new_24h": 812 } ] }`,
  },
  {
    id: "platform-get",
    group: "Platforms",
    method: "GET",
    path: "/platforms/{slug}",
    summary: "Get one platform",
    description: "Metadata for a single platform.",
    scope: "read",
    params: [
      {
        name: "slug",
        in: "path",
        type: "string",
        required: true,
        description: "Platform slug.",
        example: "hackerone",
      },
    ],
    responseExample: `{ "data": { "slug": "hackerone", "name": "HackerOne" } }`,
  },
  {
    id: "platform-domains",
    group: "Platforms",
    method: "GET",
    path: "/platforms/{slug}/domains",
    summary: "Platform domains",
    description: "Root domains belonging to one program.",
    scope: "read",
    params: [
      {
        name: "slug",
        in: "path",
        type: "string",
        required: true,
        description: "Platform slug.",
        example: "hackerone",
      },
      limit(200, 1000),
      offset,
    ],
    responseExample: `{ "data": [ { "domain": "example.com", "total_subdomains": 120 } ], "meta": { "total": 4210 } }`,
  },
  {
    id: "platform-new",
    group: "Platforms",
    method: "GET",
    path: "/platforms/{slug}/subdomains/new",
    summary: "Platform new hosts",
    description: "Hosts first seen inside one program during the requested window.",
    scope: "read",
    params: [
      {
        name: "slug",
        in: "path",
        type: "string",
        required: true,
        description: "Platform slug.",
        example: "hackerone",
      },
      hours,
      since,
      limit(500, 2000),
    ],
    responseExample: `{ "data": [ { "host": "new.example.com", "domain": "example.com", "first_seen_at": "…" } ] }`,
  },

  {
    id: "scans-list",
    group: "Scans",
    method: "GET",
    path: "/scans",
    summary: "Scan history",
    description: "Completed and running scans, newest first.",
    scope: "read",
    params: [
      { name: "domain", in: "query", type: "string", description: "Filter by root domain." },
      { name: "platform", in: "query", type: "string", description: "Filter by platform slug." },
      {
        name: "status",
        in: "query",
        type: "string",
        description: "Filter by scan status.",
        enum: ["running", "success", "error"],
      },
      limit(50, 500),
      offset,
    ],
    responseExample: `{ "data": [ { "trigger": "cron", "status": "success", "new_count": 17 } ], "meta": { "total": 90210 } }`,
  },
  {
    id: "scans-status",
    group: "Scans",
    method: "GET",
    path: "/scans/status",
    summary: "Worker status",
    description:
      "Live health of the scanning fleet: running scans, sweep coverage, errors and pending queue depth.",
    scope: "read",
    params: [],
    responseExample: `{ "data": { "health": { "running_scans": 12, "scanned_30m": 2500 }, "cycle": { "due_domains": 400, "total_domains": 10461 } } }`,
  },
  {
    id: "scan-get",
    group: "Scans",
    method: "GET",
    path: "/scans/{id}",
    summary: "Get one scan",
    description: "A single scan record by id, including its domain.",
    scope: "read",
    params: [
      { name: "id", in: "path", type: "string", required: true, description: "Scan UUID." },
    ],
    responseExample: `{ "data": { "id": "…", "domain": "lovable.app", "new_count": 17 } }`,
  },
  {
    id: "scan-create",
    group: "Scans",
    method: "POST",
    path: "/scans",
    summary: "Queue a scan",
    description:
      "Queue an immediate re-scan of one tracked domain. Returns 202 — large programs continue in the background. Requires a key with the `write` scope.",
    scope: "write",
    params: [
      {
        name: "domain",
        in: "body",
        type: "string",
        required: true,
        description: "Root domain to re-scan.",
        example: "lovable.app",
      },
    ],
    responseExample: `{ "data": { "domain": "lovable.app", "status": "queued" } }`,
  },
  {
    id: "scan-rescan-all",
    group: "Scans",
    method: "POST",
    path: "/scans/rescan-all",
    summary: "Full re-scan",
    description:
      "Mark every enabled domain as due so the worker starts a full sweep on the next tick. Requires the `write` scope.",
    scope: "write",
    params: [],
    responseExample: `{ "data": { "queued_domains": 10461 } }`,
  },

  {
    id: "stats",
    group: "Stats",
    method: "GET",
    path: "/stats",
    summary: "Global stats",
    description:
      "Platform-wide totals plus new-host counts for the last hour, day, week, month and six months.",
    scope: "read",
    params: [],
    responseExample: `{ "data": { "new": { "last_hour": 320, "last_day": 8123 }, "platforms": [ … ] } }`,
  },
  {
    id: "stats-timeseries",
    group: "Stats",
    method: "GET",
    path: "/stats/timeseries",
    summary: "Discovery time-series",
    description: "Bucketed new-host counts for charting.",
    scope: "read",
    params: [
      {
        name: "bucket",
        in: "query",
        type: "string",
        description: "Bucket width.",
        enum: ["hour", "day", "week", "month"],
        default: "hour",
      },
      hours,
      since,
    ],
    responseExample: `{ "data": [ { "ts": "2026-08-13T09:00:00Z", "new_subdomains": 143 } ] }`,
  },
  {
    id: "stats-top-domains",
    group: "Stats",
    method: "GET",
    path: "/stats/top-domains",
    summary: "Top domains by new hosts",
    description: "Root domains producing the most new hosts inside the window.",
    scope: "read",
    params: [hours, since, limit(20, 200)],
    responseExample: `{ "data": [ { "domain": "taobao.com", "new_count": 4210 } ] }`,
  },

  {
    id: "export",
    group: "Export",
    method: "GET",
    path: "/export",
    summary: "Bulk export",
    description:
      "Streaming export of hosts for any scope. Handles 100k+ rows; returns text, CSV or JSON rather than the standard envelope.",
    scope: "read",
    params: [
      { name: "domain", in: "query", type: "string", description: "Export one root domain." },
      { name: "platform", in: "query", type: "string", description: "Export a whole platform." },
      {
        name: "scope",
        in: "query",
        type: "string",
        description: "Which hosts to include.",
        enum: ["all", "new", "inactive"],
        default: "all",
      },
      hours,
      { name: "search", in: "query", type: "string", description: "Substring match on the host." },
      {
        name: "format",
        in: "query",
        type: "string",
        description: "Output format.",
        enum: ["txt", "csv", "json"],
        default: "txt",
      },
    ],
    responseExample: `www.lovable.app\nconnect.lovable.app\nyt.lovable.app`,
  },
];


export function endpointById(id: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find((e) => e.id === id);
}

import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH = 150;
const CONCURRENCY = 40;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const BODY_CAP = 128 * 1024;

type ProbeRow = {
  domain_id: string | null;
  host: string;
  url: string;
  final_url: string | null;
  status_code: number | null;
  title: string | null;
  content_length: number | null;
  content_type: string | null;
  response_time_ms: number | null;
  webserver: string | null;
  technologies: string[];
  cdn: string | null;
  ip: string | null;
  asn: string | null;
  cname: string | null;
  redirect_chain: string[];
  tls_issuer: string | null;
  tls_expires_at: string | null;
  body_hash: string | null;
  failed: boolean;
  error: string | null;
};

const CDN_HINTS: Array<[RegExp, string]> = [
  [/cloudflare/i, "Cloudflare"],
  [/akamai|ghost/i, "Akamai"],
  [/fastly/i, "Fastly"],
  [/amazons3|aws|cloudfront/i, "AWS/CloudFront"],
  [/gws|google/i, "Google"],
  [/azure|microsoft/i, "Azure"],
  [/incapsula|imperva/i, "Imperva"],
  [/sucuri/i, "Sucuri"],
  [/vercel/i, "Vercel"],
  [/netlify/i, "Netlify"],
  [/bunny/i, "BunnyCDN"],
];

const TECH_HINTS: Array<[RegExp, string]> = [
  [/_next|__NEXT_DATA__|x-powered-by:\s*next/i, "Next.js"],
  [/wp-content|wp-includes|wordpress/i, "WordPress"],
  [/react/i, "React"],
  [/laravel/i, "Laravel"],
  [/django/i, "Django"],
  [/drupal/i, "Drupal"],
  [/shopify/i, "Shopify"],
  [/jquery/i, "jQuery"],
  [/bootstrap/i, "Bootstrap"],
  [/graphql/i, "GraphQL"],
  [/swagger|openapi/i, "Swagger/OpenAPI"],
  [/jenkins/i, "Jenkins"],
  [/grafana/i, "Grafana"],
  [/kibana/i, "Kibana"],
  [/phpmyadmin/i, "phpMyAdmin"],
];

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data.slice(0, BODY_CAP));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function doh(name: string, type: string): Promise<Array<{ data: string }>> {
  try {
    const res = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ data: string }> };
    return json.Answer ?? [];
  } catch {
    return [];
  }
}

async function lookupDns(host: string): Promise<{ ip: string | null; cname: string | null; asn: string | null }> {
  const [a, cname] = await Promise.all([doh(host, "A"), doh(host, "CNAME")]);
  const ip = a.find((r) => /^\d+\.\d+\.\d+\.\d+$/.test(r.data))?.data ?? null;
  const cnameVal = cname[0]?.data?.replace(/\.$/, "") ?? null;
  let asn: string | null = null;
  if (ip) {
    const rev = ip.split(".").reverse().join(".");
    const txt = await doh(`${rev}.origin.asn.cymru.com`, "TXT");
    const raw = txt[0]?.data?.replace(/"/g, "");
    if (raw) {
      const [num, , , , desc] = raw.split(" | ");
      asn = desc ? `AS${num} ${desc}` : `AS${num}`;
    }
  }
  return { ip, cname: cnameVal, asn };
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]{0,300})<\/title>/i.exec(html);
  return m ? m[1].trim().replace(/\s+/g, " ").slice(0, 200) : null;
}

function detectTech(headers: Headers, body: string): string[] {
  const hay = `${[...headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n")}\n${body.slice(0, 30000)}`;
  const found = new Set<string>();
  for (const [re, name] of TECH_HINTS) if (re.test(hay)) found.add(name);
  const powered = headers.get("x-powered-by");
  if (powered) found.add(powered.split("/")[0].trim());
  return [...found].slice(0, 12);
}

function detectCdn(headers: Headers): string | null {
  const cf = headers.get("cf-ray");
  if (cf) return "Cloudflare";
  const hay = [headers.get("server"), headers.get("via"), headers.get("x-cdn"), headers.get("x-cache")]
    .filter(Boolean)
    .join(" ");
  for (const [re, name] of CDN_HINTS) if (re.test(hay)) return name;
  return null;
}

async function fetchChain(startUrl: string): Promise<{
  final: Response;
  finalUrl: string;
  chain: string[];
  bodyText: string;
  timeMs: number;
}> {
  let url = startUrl;
  const chain: string[] = [];
  const started = Date.now();
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; chaos-monitor/1.0; live-host probe)",
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.arrayBuffer().catch(() => undefined);
      if (!loc) return { final: res, finalUrl: url, chain, bodyText: "", timeMs: Date.now() - started };
      chain.push(`${res.status} ${url} -> ${new URL(loc, url).toString()}`);
      url = new URL(loc, url).toString();
      continue;
    }
    const buf = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
    const capped = buf.slice(0, BODY_CAP);
    const bodyText = new TextDecoder().decode(capped);
    return { final: res, finalUrl: url, chain, bodyText, timeMs: Date.now() - started };
  }
  // Redirect loop
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { final: res, finalUrl: url, chain, bodyText: "", timeMs: Date.now() - started };
}

async function probeHost(domainId: string | null, host: string): Promise<ProbeRow> {
  const base: ProbeRow = {
    domain_id: domainId,
    host,
    url: `https://${host}`,
    final_url: null,
    status_code: null,
    title: null,
    content_length: null,
    content_type: null,
    response_time_ms: null,
    webserver: null,
    technologies: [],
    cdn: null,
    ip: null,
    asn: null,
    cname: null,
    redirect_chain: [],
    tls_issuer: null,
    tls_expires_at: null,
    body_hash: null,
    failed: false,
    error: null,
  };

  const dns = await lookupDns(host);
  base.ip = dns.ip;
  base.cname = dns.cname;
  base.asn = dns.asn;
  if (!dns.ip && !dns.cname) {
    return { ...base, failed: true, error: "no_dns" };
  }

  for (const scheme of ["https", "http"] as const) {
    const url = `${scheme}://${host}`;
    try {
      const { final, finalUrl, chain, bodyText, timeMs } = await fetchChain(url);
      base.url = url;
      base.final_url = finalUrl;
      base.status_code = final.status;
      base.response_time_ms = timeMs;
      base.redirect_chain = chain;
      base.webserver = final.headers.get("server");
      base.content_type = final.headers.get("content-type")?.split(";")[0] ?? null;
      base.cdn = detectCdn(final.headers);
      base.technologies = detectTech(final.headers, bodyText);
      const bodyBytes = new TextEncoder().encode(bodyText);
      base.content_length = bodyBytes.length;
      base.title = extractTitle(bodyText);
      base.body_hash = await sha256Hex(bodyBytes);
      base.failed = false;
      return base;
    } catch (e) {
      base.error = e instanceof Error ? e.message.slice(0, 200) : "request_failed";
      if (scheme === "http") base.failed = true;
    }
  }
  return base;
}

export async function processProbeJobs(budgetMs: number): Promise<{ jobId: string | null; probed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const started = Date.now();
  let probed = 0;

  const { data: job } = await supabaseAdmin.rpc("claim_probe_job");
  const j = Array.isArray(job) ? job[0] : job;
  if (!j) return { jobId: null, probed: 0 };

  // Resolve the target host list lazily from the cursor.
  for (let pass = 0; pass < 200 && Date.now() - started < budgetMs; pass++) {
    const hosts = await fetchHostBatch(supabaseAdmin, j, BATCH);
    if (hosts.length === 0) {
      await supabaseAdmin.rpc("record_probe_batch", {
        _job_id: j.id,
        _results: [],
        _cursor_host: j.cursor_host,
        _done: true,
      });
      break;
    }

    const results: ProbeRow[] = [];
    for (let i = 0; i < hosts.length; i += CONCURRENCY) {
      const slice = hosts.slice(i, i + CONCURRENCY);
      const rows = await Promise.all(slice.map((h) => probeHost(h.domainId, h.host)));
      results.push(...rows);
    }

    const done = hosts.length < BATCH;
    const { error } = await supabaseAdmin.rpc("record_probe_batch", {
      _job_id: j.id,
      _results: results,
      _cursor_host: hosts[hosts.length - 1].host,
      _done: done,
    });
    if (error) throw new Error(error.message);
    probed += results.length;
    if (done) break;
  }

  return { jobId: j.id, probed };
}

async function fetchHostBatch(
  supabaseAdmin: SupabaseClient,
  job: {
    id: string;
    domain_id: string | null;
    platform_slug: string | null;
    program: string | null;
    scope: string;
    search: string | null;
    cursor_host: string;
  },
  limit: number,
): Promise<Array<{ host: string; domainId: string | null }>> {
  let q = supabaseAdmin
    .from("subdomains")
    .select("host, domain_id")
    .gt("host", job.cursor_host)
    .order("host", { ascending: true })
    .limit(limit);

  if (job.domain_id) {
    q = q.eq("domain_id", job.domain_id);
  } else {
    const { data: plat } = await supabaseAdmin
      .from("platforms")
      .select("id")
      .eq("slug", job.platform_slug)
      .maybeSingle();
    if (!plat) return [];
    let dq = supabaseAdmin.from("domains").select("id").eq("platform_id", plat.id);
    if (job.program) dq = dq.ilike("domain", `%${job.program}%`);
    const { data: doms } = await dq;
    const ids = (doms ?? []).map((d) => d.id);
    if (!ids.length) return [];
    q = q.in("domain_id", ids);
  }
  if (job.scope === "new") q = q.gte("first_seen_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if (job.scope === "active") q = q.eq("is_active", true);
  if (job.search) q = q.ilike("host", `%${job.search}%`);

  const { data } = await q;
  return (data ?? []).map((r) => ({ host: r.host, domainId: r.domain_id }));
}

export async function probeJobTargets(job: { domain_id: string | null; platform_slug: string | null; program: string | null; scope: string; search: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const probe = { ...job, cursor_host: "" };
  let total = 0;
  for (;;) {
    const batch = await fetchHostBatch(supabaseAdmin, probe as never, 1000);
    if (!batch.length) break;
    total += batch.length;
    (probe as { cursor_host: string }).cursor_host = batch[batch.length - 1].host;
    if (total > 500_000) break;
  }
  return total;
}

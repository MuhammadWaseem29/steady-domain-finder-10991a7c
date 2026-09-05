import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH = 1500;
const CONCURRENCY = 250;
const FLUSH_EVERY = 300;
const TIMEOUT_MS = 5000;
const DNS_TIMEOUT_MS = 2500;
const MAX_REDIRECTS = 3;
const BODY_CAP = 64 * 1024;

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

async function doh(name: string, type: string, timeoutMs = DNS_TIMEOUT_MS): Promise<Array<{ data: string; type?: number }>> {
  try {
    const res = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(timeoutMs) },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ data: string; type?: number }> };
    return json.Answer ?? [];
  } catch {
    return [];
  }
}

const asnCache = new Map<string, string | null>();

async function lookupAsn(ip: string): Promise<string | null> {
  const key = ip.split(".").slice(0, 3).join(".");
  if (asnCache.has(key)) return asnCache.get(key) ?? null;
  const rev = ip.split(".").reverse().join(".");
  const txt = await doh(`${rev}.origin.asn.cymru.com`, "TXT", 2000);
  const raw = txt[0]?.data?.replace(/"/g, "");
  let asn: string | null = null;
  if (raw) {
    const [num, , , , desc] = raw.split(" | ");
    asn = desc ? `AS${num} ${desc}` : `AS${num}`;
  }
  if (asnCache.size < 20000) asnCache.set(key, asn);
  return asn;
}

// A single A query already returns any CNAME records in the answer chain,
// so one round trip is enough to resolve both.
async function lookupDns(host: string): Promise<{ ip: string | null; cname: string | null }> {
  const answers = await doh(host, "A");
  const ip = answers.find((r) => /^\d+\.\d+\.\d+\.\d+$/.test(r.data))?.data ?? null;
  const cname =
    answers.find((r) => r.type === 5 || /^[a-z0-9.-]+\.$/i.test(r.data))?.data?.replace(/\.$/, "") ?? null;
  return { ip, cname };
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]{0,300})<\/title>/i.exec(html);
  return m && m[1] ? m[1].trim().replace(/\s+/g, " ").slice(0, 200) : null;
}

function detectTech(headers: Headers, body: string): string[] {
  const hay = `${[...headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n")}\n${body.slice(0, 30000)}`;
  const found = new Set<string>();
  for (const [re, name] of TECH_HINTS) if (re.test(hay)) found.add(name);
  const powered = headers.get("x-powered-by");
  if (powered?.split("/")[0]) found.add(powered.split("/")[0]!.trim());
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

  // DNS runs in parallel with the first request instead of blocking it.
  const dnsPromise = lookupDns(host);

  const attempt = async (scheme: "https" | "http", retry: boolean): Promise<boolean> => {
    for (let tries = 0; tries <= (retry ? 1 : 0); tries++) {
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
        base.error = null;
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 200) : "request_failed";
        base.error = msg;
        // Only retry transient network/timeout errors, never hard DNS/TLS failures.
        if (!/timeout|timed out|reset|network|socket|EAI_AGAIN|fetch failed/i.test(msg)) break;
      }
    }
    return false;
  };

  let ok = await attempt("https", true);
  if (!ok) ok = await attempt("http", false);

  const dns = await dnsPromise;
  base.ip = dns.ip;
  base.cname = dns.cname;
  if (ok && dns.ip) base.asn = await lookupAsn(dns.ip);

  if (!ok) {
    base.failed = true;
    if (!dns.ip && !dns.cname) base.error = "no_dns";
  }
  return base;
}

export async function processProbeJobs(budgetMs: number): Promise<{ jobId: string | null; probed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const started = Date.now();
  let probed = 0;

  const { data: job } = await supabaseAdmin.rpc("claim_probe_job");
  const j = Array.isArray(job) ? job[0] : job;
  if (!j || !j.id) return { jobId: null, probed: 0 };

  const timeLeft = () => budgetMs - (Date.now() - started);

  // Keep the next page of hosts loading while the current one is being probed.
  let nextBatch: Promise<Array<{ host: string; domainId: string | null }>> = fetchHostBatch(
    supabaseAdmin,
    j,
    BATCH,
  );

  for (let pass = 0; pass < 500 && timeLeft() > 2000; pass++) {
    const hosts = await nextBatch;
    if (hosts.length === 0) {
      await supabaseAdmin.rpc("record_probe_batch", {
        _job_id: j.id,
        _results: [],
        _cursor_host: j.cursor_host,
        _done: true,
      });
      break;
    }

    const lastHost = hosts[hosts.length - 1]!.host;
    const done = hosts.length < BATCH;
    // Prefetch the following page immediately (cursor advances to this page's end).
    nextBatch = done
      ? Promise.resolve([])
      : fetchHostBatch(supabaseAdmin, { ...j, cursor_host: lastHost }, BATCH);

    // Continuous worker pool: a finished worker grabs the next host straight away,
    // so one slow host can never hold up the rest of the batch.
    let index = 0;
    let pending: ProbeRow[] = [];
    // Writes are chained so results stream into the database as they land,
    // without competing with the probe requests for outbound sockets.
    let writeChain: Promise<void> = Promise.resolve();

    const flush = (cursor: string, finished: boolean) => {
      const rows = pending;
      pending = [];
      if (!rows.length && !finished) return;
      writeChain = writeChain.then(async () => {
        const { error } = await supabaseAdmin.rpc("record_probe_batch", {
          _job_id: j.id,
          _results: rows,
          _cursor_host: cursor,
          _done: finished,
        });
        if (error) console.error("record_probe_batch failed:", error.message);
      });
    };

    const worker = async () => {
      for (;;) {
        const i = index++;
        if (i >= hosts.length) return;
        if (timeLeft() < 1500) return;
        const h = hosts[i]!;
        const row = await probeHost(h.domainId, h.host);
        pending.push(row);
        probed++;
        // Intermediate flushes keep the cursor where it was: hosts finish out of
        // order, so only the end of the page is a safe resume point.
        if (pending.length >= FLUSH_EVERY) flush(j.cursor_host, false);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hosts.length) }, worker));
    const complete = index >= hosts.length;
    flush(complete ? lastHost : j.cursor_host, done && complete);
    await writeChain;
    if (complete) j.cursor_host = lastHost;

    if (done || !complete) break;
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
  } else if (job.platform_slug) {
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
    (probe as { cursor_host: string }).cursor_host = batch[batch.length - 1]!.host;
    if (total > 500_000) break;
  }
  return total;
}

/**
 * Keeps a rolling "new subdomains -> is it live?" job in flight so freshly
 * discovered hosts land in the live list without anyone pressing a button.
 */
export async function ensureAutoProbeJob(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: open } = await supabaseAdmin
    .from("probe_jobs")
    .select("id")
    .in("status", ["queued", "running"])
    .limit(1);
  if (open && open.length) return null;

  const { data: recent } = await supabaseAdmin
    .from("probe_jobs")
    .select("id")
    .is("domain_id", null)
    .is("platform_slug", null)
    .gte("created_at", new Date(Date.now() - 20 * 60_000).toISOString())
    .limit(1);
  if (recent && recent.length) return null;

  const { data, error } = await supabaseAdmin
    .from("probe_jobs")
    .insert({ scope: "new", status: "queued" })
    .select("id")
    .single();
  if (error) {
    console.error("ensureAutoProbeJob failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

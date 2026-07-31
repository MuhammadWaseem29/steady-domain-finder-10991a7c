// Server-only Chaos scanning logic. Never imported from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHAOS_BASE = "https://dns.projectdiscovery.io/dns";

export type ScanResult = {
  domain: string;
  status: "success" | "error";
  total: number;
  newCount: number;
  removedCount: number;
  error?: string;
};

async function fetchChaosSubdomains(domain: string): Promise<string[]> {
  const key = process.env.CHAOS_API_KEY;
  if (!key) throw new Error("CHAOS_API_KEY is not configured");

  const res = await fetch(`${CHAOS_BASE}/${encodeURIComponent(domain)}/subdomains`, {
    headers: { Authorization: key, Connection: "close" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chaos API failed [${res.status}]: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { subdomains?: string[] | null };
  const list = Array.isArray(json.subdomains) ? json.subdomains : [];
  return Array.from(new Set(list.filter((s) => typeof s === "string")));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function scanDomain(
  domainRow: { id: string; domain: string },
  trigger: "manual" | "cron",
): Promise<ScanResult> {
  const now = new Date().toISOString();

  const { data: scanRow } = await supabaseAdmin
    .from("scans")
    .insert({ domain_id: domainRow.id, trigger, status: "running", started_at: now })
    .select("id")
    .single();

  const scanId = scanRow?.id;

  try {
    const labels = await fetchChaosSubdomains(domainRow.domain);
    const hosts = labels.map((label) => ({
      label,
      host: label === "" ? domainRow.domain : `${label}.${domainRow.domain}`,
    }));

    const { data: existingRows } = await supabaseAdmin
      .from("subdomains")
      .select("host, is_active")
      .eq("domain_id", domainRow.id);

    const existing = new Map((existingRows ?? []).map((r) => [r.host, r.is_active]));
    const seen = new Set(hosts.map((h) => h.host));

    const fresh = hosts.filter((h) => !existing.has(h.host));
    const stamp = new Date().toISOString();

    for (const batch of chunk(fresh, 500)) {
      await supabaseAdmin.from("subdomains").insert(
        batch.map((h) => ({
          domain_id: domainRow.id,
          label: h.label,
          host: h.host,
          first_seen_at: stamp,
          last_seen_at: stamp,
          is_active: true,
        })),
      );
    }

    // Refresh last_seen for hosts still present.
    const stillPresent = hosts.filter((h) => existing.has(h.host)).map((h) => h.host);
    for (const batch of chunk(stillPresent, 500)) {
      await supabaseAdmin
        .from("subdomains")
        .update({ last_seen_at: stamp, is_active: true })
        .eq("domain_id", domainRow.id)
        .in("host", batch);
    }

    // Flag hosts that disappeared from the feed.
    const gone = (existingRows ?? [])
      .filter((r) => r.is_active && !seen.has(r.host))
      .map((r) => r.host);
    for (const batch of chunk(gone, 500)) {
      await supabaseAdmin
        .from("subdomains")
        .update({ is_active: false })
        .eq("domain_id", domainRow.id)
        .in("host", batch);
    }

    await supabaseAdmin
      .from("domains")
      .update({
        last_scanned_at: stamp,
        last_scan_status: "success",
        total_subdomains: hosts.length,
        new_subdomains_last_scan: fresh.length,
        updated_at: stamp,
      })
      .eq("id", domainRow.id);

    if (scanId) {
      await supabaseAdmin
        .from("scans")
        .update({
          status: "success",
          finished_at: stamp,
          total_returned: hosts.length,
          new_count: fresh.length,
          removed_count: gone.length,
        })
        .eq("id", scanId);
    }

    return {
      domain: domainRow.domain,
      status: "success",
      total: hosts.length,
      newCount: fresh.length,
      removedCount: gone.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stamp = new Date().toISOString();

    if (scanId) {
      await supabaseAdmin
        .from("scans")
        .update({ status: "error", finished_at: stamp, error_message: message })
        .eq("id", scanId);
    }
    await supabaseAdmin
      .from("domains")
      .update({ last_scanned_at: stamp, last_scan_status: "error", updated_at: stamp })
      .eq("id", domainRow.id);

    console.error(`[chaos] scan failed for ${domainRow.domain}: ${message}`);
    return {
      domain: domainRow.domain,
      status: "error",
      total: 0,
      newCount: 0,
      removedCount: 0,
      error: message,
    };
  }
}

/**
 * Scans a batch of enabled domains, oldest-scanned first (never-scanned domains
 * come first). Runs a few requests in parallel so a full sweep of a large
 * root-domain list completes well inside an hour when called on a short cron.
 */
export async function scanAllEnabledDomains(
  trigger: "manual" | "cron",
  options: { limit?: number; concurrency?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 1000);
  const concurrency = Math.min(Math.max(options.concurrency ?? 6, 1), 12);

  const { data: domains } = await supabaseAdmin
    .from("domains")
    .select("id, domain")
    .eq("enabled", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const queue = [...(domains ?? [])];
  const results: ScanResult[] = [];

  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      results.push(await scanDomain(next, trigger));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

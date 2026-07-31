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

async function fetchChaosSubdomains(domain: string, timeoutMs = 15_000): Promise<string[]> {
  const key = process.env.CHAOS_API_KEY;
  if (!key) throw new Error("CHAOS_API_KEY is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${CHAOS_BASE}/${encodeURIComponent(domain)}/subdomains`, {
      headers: { Authorization: key, Connection: "close" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Chaos API failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { subdomains?: string[] | null };
    const list = Array.isArray(json.subdomains) ? json.subdomains : [];
    return Array.from(new Set(list.filter((s) => typeof s === "string")));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Chaos API timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

    const stamp = new Date().toISOString();
    let freshCount = 0;

    // Upsert with ignoreDuplicates: the (domain_id, host) unique index does the
    // diffing in the database, so we never have to page through millions of
    // existing rows. The returned rows are exactly the newly discovered hosts.
    for (const batch of chunk(hosts, 500)) {
      const { data: inserted, error } = await supabaseAdmin
        .from("subdomains")
        .upsert(
          batch.map((h) => ({
            domain_id: domainRow.id,
            label: h.label,
            host: h.host,
            first_seen_at: stamp,
            last_seen_at: stamp,
            is_active: true,
          })),
          { onConflict: "domain_id,host", ignoreDuplicates: true },
        )
        .select("host");
      if (error) throw new Error(error.message);
      freshCount += inserted?.length ?? 0;
    }

    await supabaseAdmin
      .from("domains")
      .update({
        last_scanned_at: stamp,
        last_scan_status: "success",
        total_subdomains: hosts.length,
        new_subdomains_last_scan: freshCount,
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
          new_count: freshCount,
          removed_count: 0,
        })
        .eq("id", scanId);
    }

    await supabaseAdmin.rpc("bump_daily_stats", { _new: freshCount, _errors: 0 });

    return {
      domain: domainRow.domain,
      status: "success",
      total: hosts.length,
      newCount: freshCount,
      removedCount: 0,
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

    await supabaseAdmin.rpc("bump_daily_stats", { _new: 0, _errors: 1 });

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
 * come first). Domains are claimed up front so a run that gets cut short by the
 * request budget never makes the next run replay the same slice, and any scan
 * left "running" by an earlier truncated run is closed out as an error.
 */
export async function scanAllEnabledDomains(
  trigger: "manual" | "cron",
  options: { limit?: number; concurrency?: number; budgetMs?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 1000);
  const concurrency = Math.min(Math.max(options.concurrency ?? 6, 1), 12);
  const budgetMs = Math.min(Math.max(options.budgetMs ?? 40_000, 5_000), 120_000);
  const deadline = Date.now() + budgetMs;

  // Close out scans orphaned by a previous truncated run.
  await supabaseAdmin
    .from("scans")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: "scan run timed out",
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 10 * 60_000).toISOString());

  const { data: domains } = await supabaseAdmin
    .from("domains")
    .select("id, domain")
    .eq("enabled", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const picked = domains ?? [];
  if (picked.length === 0) return [];

  // Claim immediately so the next cron tick advances to the next slice.
  const claimStamp = new Date().toISOString();
  for (const batch of chunk(picked.map((d) => d.id), 200)) {
    await supabaseAdmin
      .from("domains")
      .update({ last_scanned_at: claimStamp, updated_at: claimStamp })
      .in("id", batch);
  }

  const queue = [...picked];
  const results: ScanResult[] = [];

  async function worker() {
    while (queue.length > 0 && Date.now() < deadline) {
      const next = queue.shift();
      if (!next) return;
      results.push(await scanDomain(next, trigger));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}


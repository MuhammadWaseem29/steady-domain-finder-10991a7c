// Server-only Chaos scanning logic. Never imported from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHAOS_BASE = "https://dns.projectdiscovery.io/dns";

export type ScanResult = {
  domain: string;
  status: "success" | "partial" | "error";
  total: number;
  newCount: number;
  removedCount: number;
  error?: string;
};

async function fetchChaosSubdomains(domain: string, timeoutMs = 45_000): Promise<string[]> {
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
  options: {
    recordStats?: boolean;
    fetchTimeoutMs?: number;
    /** Wall-clock budget for the DB write phase; leftover batches are skipped. */
    writeBudgetMs?: number;
    /** How many upsert batches run in parallel. */
    writeConcurrency?: number;
  } = {},
): Promise<ScanResult> {
  const recordStats = options.recordStats ?? true;
  const writeBudgetMs = options.writeBudgetMs ?? 60_000;
  const writeConcurrency = Math.min(Math.max(options.writeConcurrency ?? 6, 1), 12);
  const startedAt = new Date().toISOString();

  try {
    const labels = await fetchChaosSubdomains(domainRow.domain, options.fetchTimeoutMs);
    const hosts = labels.map((label) => ({
      label,
      host: label === "" ? domainRow.domain : `${label}.${domainRow.domain}`,
    }));

    const stamp = new Date().toISOString();
    let freshCount = 0;
    let skipped = 0;
    const deadline = Date.now() + writeBudgetMs;

    // Upsert with ignoreDuplicates: the (domain_id, host) unique index does the
    // diffing in the database, so we never have to page through millions of
    // existing rows. Batches run in parallel so 100k+ host programs finish
    // inside the request budget instead of dying with a 500.
    const batches = chunk(hosts, 1000);
    let cursor = 0;

    async function writer() {
      while (cursor < batches.length) {
        const batch = batches[cursor++];
        if (!batch) return;
        if (Date.now() > deadline) {
          skipped += batch.length;
          continue;
        }
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
    }

    await Promise.all(Array.from({ length: writeConcurrency }, writer));

    const status = skipped > 0 ? ("partial" as const) : ("success" as const);
    const finishedAt = new Date().toISOString();

    // One write per scan instead of insert+update.
    await Promise.all([
      supabaseAdmin.from("scans").insert({
        domain_id: domainRow.id,
        trigger,
        status: "success",
        started_at: startedAt,
        finished_at: finishedAt,
        total_returned: hosts.length,
        new_count: freshCount,
        removed_count: 0,
        ...(skipped > 0
          ? { error_message: `${skipped} hosts deferred to the next scan (time budget)` }
          : {}),
      }),
      supabaseAdmin
        .from("domains")
        .update({
          last_scanned_at: finishedAt,
          claimed_at: finishedAt,
          last_scan_status: "success",
          total_subdomains: hosts.length,
          new_subdomains_last_scan: freshCount,
          updated_at: finishedAt,
        })
        .eq("id", domainRow.id),
    ]);

    if (recordStats) {
      await supabaseAdmin.rpc("bump_daily_stats", { _new: freshCount, _errors: 0 });
    }

    return {
      domain: domainRow.domain,
      status,
      total: hosts.length,
      newCount: freshCount,
      removedCount: 0,
      ...(skipped > 0
        ? { error: `${skipped.toLocaleString()} hosts deferred to the next scan` }
        : {}),
    };
  } catch (error) {

    const message = error instanceof Error ? error.message : String(error);
    const stamp = new Date().toISOString();

    await Promise.all([
      supabaseAdmin.from("scans").insert({
        domain_id: domainRow.id,
        trigger,
        status: "error",
        started_at: startedAt,
        finished_at: stamp,
        error_message: message,
      }),
      supabaseAdmin
        .from("domains")
        .update({
          last_scanned_at: stamp,
          claimed_at: stamp,
          last_scan_status: "error",
          updated_at: stamp,
        })
        .eq("id", domainRow.id),
    ]);

    if (recordStats) {
      await supabaseAdmin.rpc("bump_daily_stats", { _new: 0, _errors: 1 });
    }

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
 * Rolling sweep over every enabled root domain, oldest-claimed first.
 *
 * Domains are claimed on `claimed_at` up front so a run cut short by the time
 * budget never makes the next tick replay the same slice, while
 * `last_scanned_at` keeps reflecting a real, completed scan.
 */
export async function scanAllEnabledDomains(
  trigger: "manual" | "cron",
  options: { limit?: number; concurrency?: number; budgetMs?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 400, 1), 2000);
  const concurrency = Math.min(Math.max(options.concurrency ?? 40, 1), 64);
  const budgetMs = Math.min(Math.max(options.budgetMs ?? 50_000, 5_000), 120_000);
  const deadline = Date.now() + budgetMs;

  // Close out scans orphaned by an earlier truncated run.
  await supabaseAdmin
    .from("scans")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: "scan run timed out",
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 3 * 60_000).toISOString());

  const { data: domains } = await supabaseAdmin
    .from("domains")
    .select("id, domain")
    .eq("enabled", true)
    .order("claimed_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const picked = domains ?? [];
  if (picked.length === 0) return [];

  // Claim immediately so the next cron tick advances to the next slice.
  const claimStamp = new Date().toISOString();
  await Promise.all(
    chunk(
      picked.map((d) => d.id),
      500,
    ).map((batch) =>
      supabaseAdmin.from("domains").update({ claimed_at: claimStamp }).in("id", batch),
    ),
  );

  const queue = [...picked];
  const results: ScanResult[] = [];

  async function worker() {
    while (queue.length > 0 && Date.now() < deadline) {
      const next = queue.shift();
      if (!next) return;
      results.push(await scanDomain(next, trigger, { recordStats: false }));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  // One aggregated stats write per sweep instead of one per domain.
  const newTotal = results.reduce((a, r) => a + r.newCount, 0);
  const errorTotal = results.filter((r) => r.status === "error").length;
  await supabaseAdmin.rpc("bump_daily_stats", { _new: newTotal, _errors: errorTotal });

  return results;
}



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

export type ScanJobProgress = {
  id: string;
  domainId: string;
  status: "queued" | "fetching" | "processing" | "success" | "error";
  total: number;
  processed: number;
  newCount: number;
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

async function ingestChunk(
  domainId: string,
  hosts: { label: string; host: string }[],
  stamp: string,
) {
  const { data, error } = await supabaseAdmin.rpc("ingest_subdomain_chunk", {
    _domain_id: domainId,
    _hosts: hosts,
    _stamp: stamp,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
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
    const batches = chunk(hosts, 5000);
    let cursor = 0;

    async function writer() {
      while (cursor < batches.length) {
        const batch = batches[cursor++];
        if (!batch) return;
        if (Date.now() > deadline) {
          skipped += batch.length;
          continue;
        }
        freshCount += await ingestChunk(domainRow.id, batch, stamp);
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

export async function queueManualScan(domainId: string): Promise<ScanJobProgress> {
  const { data: active } = await supabaseAdmin
    .from("scan_jobs")
    .select("id, domain_id, status, total_hosts, processed_hosts, new_count, error_message")
    .eq("domain_id", domainId)
    .in("status", ["queued", "fetching", "processing"])
    .maybeSingle();

  let job = active;
  if (!job) {
    const { data, error } = await supabaseAdmin
      .from("scan_jobs")
      .insert({ domain_id: domainId, status: "queued" })
      .select("id, domain_id, status, total_hosts, processed_hosts, new_count, error_message")
      .single();
    if (error) {
      // A simultaneous click may have won the partial unique-index race.
      const { data: raced } = await supabaseAdmin
        .from("scan_jobs")
        .select("id, domain_id, status, total_hosts, processed_hosts, new_count, error_message")
        .eq("domain_id", domainId)
        .in("status", ["queued", "fetching", "processing"])
        .single();
      if (!raced) throw new Error(error.message);
      job = raced;
    } else {
      job = data;
    }
  }

  return {
    id: job.id,
    domainId: job.domain_id,
    status: job.status as ScanJobProgress["status"],
    total: job.total_hosts,
    processed: job.processed_hosts,
    newCount: job.new_count,
    ...(job.error_message ? { error: job.error_message } : {}),
  };
}

export async function getManualScanProgress(domainId: string): Promise<ScanJobProgress | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_jobs")
    .select("id, domain_id, status, total_hosts, processed_hosts, new_count, error_message")
    .eq("domain_id", domainId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    domainId: data.domain_id,
    status: data.status as ScanJobProgress["status"],
    total: data.total_hosts,
    processed: data.processed_hosts,
    newCount: data.new_count,
    ...(data.error_message ? { error: data.error_message } : {}),
  };
}

/** Processes resumable manual jobs for a bounded amount of wall-clock time. */
export async function processPendingScanJobs(budgetMs = 42_000) {
  const deadline = Date.now() + Math.min(Math.max(budgetMs, 5_000), 45_000);
  const stale = new Date(Date.now() - 2 * 60_000).toISOString();
  await supabaseAdmin
    .from("scan_jobs")
    .update({ status: "queued", claimed_at: null, updated_at: new Date().toISOString() })
    .in("status", ["fetching", "processing"])
    .lt("claimed_at", stale);

  const { data: pending } = await supabaseAdmin
    .from("scan_jobs")
    .select("id, domain_id, status, hosts, total_hosts, processed_hosts, new_count, started_at, domains(domain)")
    .in("status", ["queued", "fetching", "processing"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!pending) return null;

  const domainRelation = pending.domains as { domain?: string } | null;
  const domain = domainRelation?.domain;
  if (!domain) return null;
  const now = new Date().toISOString();

  try {
    let labels = Array.isArray(pending.hosts) ? (pending.hosts as string[]) : null;
    let processed = pending.processed_hosts;
    let newCount = pending.new_count;
    let startedAt = pending.started_at ?? now;

    if (!labels) {
      await supabaseAdmin.from("scan_jobs").update({
        status: "fetching",
        claimed_at: now,
        started_at: startedAt,
        updated_at: now,
      }).eq("id", pending.id);
      labels = await fetchChaosSubdomains(domain, Math.max(Math.min(deadline - Date.now() - 2_000, 40_000), 5_000));
      await supabaseAdmin.from("scan_jobs").update({
        status: "processing",
        hosts: labels,
        total_hosts: labels.length,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
    }

    while (processed < labels.length && Date.now() < deadline - 3_000) {
      const labelChunk = labels.slice(processed, processed + 5000);
      const hostChunk = labelChunk.map((label) => ({
        label,
        host: label === "" ? domain : `${label}.${domain}`,
      }));
      newCount += await ingestChunk(pending.domain_id, hostChunk, startedAt);
      processed += labelChunk.length;
      await supabaseAdmin.from("scan_jobs").update({
        status: "processing",
        processed_hosts: processed,
        new_count: newCount,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
    }

    if (processed < labels.length) {
      return { id: pending.id, status: "processing", processed, total: labels.length };
    }

    const finishedAt = new Date().toISOString();
    await Promise.all([
      supabaseAdmin.from("scan_jobs").update({
        status: "success", processed_hosts: processed, new_count: newCount,
        hosts: null, finished_at: finishedAt, claimed_at: finishedAt, updated_at: finishedAt,
      }).eq("id", pending.id),
      supabaseAdmin.from("scans").insert({
        domain_id: pending.domain_id, trigger: "manual", status: "success",
        started_at: startedAt, finished_at: finishedAt, total_returned: labels.length,
        new_count: newCount, removed_count: 0,
      }),
      supabaseAdmin.from("domains").update({
        last_scanned_at: finishedAt, claimed_at: finishedAt, last_scan_status: "success",
        total_subdomains: labels.length, new_subdomains_last_scan: newCount, updated_at: finishedAt,
      }).eq("id", pending.domain_id),
      supabaseAdmin.rpc("bump_daily_stats", { _new: newCount, _errors: 0 }),
    ]);
    return { id: pending.id, status: "success", processed, total: labels.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date().toISOString();
    await Promise.all([
      supabaseAdmin.from("scan_jobs").update({
        status: "error", error_message: message, hosts: null,
        finished_at: finishedAt, updated_at: finishedAt,
      }).eq("id", pending.id),
      supabaseAdmin.from("scans").insert({
        domain_id: pending.domain_id, trigger: "manual", status: "error",
        started_at: pending.started_at ?? now, finished_at: finishedAt, error_message: message,
      }),
    ]);
    return { id: pending.id, status: "error", error: message };
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
      results.push(
        await scanDomain(next, trigger, {
          recordStats: false,
          fetchTimeoutMs: 15_000,
          writeBudgetMs: Math.max(deadline - Date.now(), 2_000),
          writeConcurrency: 4,
        }),
      );
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  // One aggregated stats write per sweep instead of one per domain.
  const newTotal = results.reduce((a, r) => a + r.newCount, 0);
  const errorTotal = results.filter((r) => r.status === "error").length;
  await supabaseAdmin.rpc("bump_daily_stats", { _new: newTotal, _errors: errorTotal });

  return results;
}



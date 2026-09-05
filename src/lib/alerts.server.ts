// Server-only alert dispatcher. Never imported from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AlertSubscription = {
  id: string;
  user_id: string;
  email: string;
  frequency: "instant" | "continuous" | "hourly" | "daily";
  scope: "all" | "platforms" | "domains";
  platform_ids: string[];
  domain_ids: string[];
  keywords: string[];
  is_active: boolean;
  notify_live: boolean;
  last_sent_at: string | null;
  last_host_seen_at: string;
  last_live_seen_at: string;
  sent_count: number;
};

export type AlertHost = {
  host: string;
  domain: string;
  platform: string | null;
  first_seen_at: string;
};

const MIN_INTERVAL_MS: Record<AlertSubscription["frequency"], number> = {
  instant: 5 * 60_000,
  continuous: 15 * 60_000,
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

/** Max hosts listed inside one email; the rest are summarised with a site link. */
export const PREVIEW_LIMIT = 200;
const FETCH_LIMIT = 2000;

export function isDue(sub: AlertSubscription, now = Date.now()): boolean {
  if (!sub.is_active) return false;
  if (!sub.last_sent_at) return true;
  return now - new Date(sub.last_sent_at).getTime() >= MIN_INTERVAL_MS[sub.frequency];
}

/** Hosts discovered since the subscription's high-water mark, scoped and filtered. */
export async function pendingHosts(sub: AlertSubscription): Promise<AlertHost[]> {
  let query = supabaseAdmin
    .from("subdomains")
    .select("host, first_seen_at, domains!inner(domain, platform_id, platforms(name))")
    .gt("first_seen_at", sub.last_host_seen_at)
    .order("first_seen_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (sub.scope === "domains" && sub.domain_ids.length) {
    query = query.in("domain_id", sub.domain_ids);
  } else if (sub.scope === "platforms" && sub.platform_ids.length) {
    query = query.in("domains.platform_id", sub.platform_ids);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    host: string;
    first_seen_at: string;
    domains: { domain: string; platforms: { name: string } | null } | null;
  }[];

  const keywords = (sub.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);

  return rows
    .filter((r) => !keywords.length || keywords.some((k) => r.host.toLowerCase().includes(k)))
    .map((r) => ({
      host: r.host,
      domain: r.domains?.domain ?? "",
      platform: r.domains?.platforms?.name ?? null,
      first_seen_at: r.first_seen_at,
    }));
}

/** Hosts that answered a live probe since the subscription's live high-water mark. */
export async function pendingLiveHosts(sub: AlertSubscription): Promise<AlertHost[]> {
  const platformScoped = sub.scope === "platforms" && sub.platform_ids.length;
  let query = supabaseAdmin
    .from("probe_results")
    .select(
      platformScoped
        ? "host, probed_at, domains!inner(domain, platform_id, platforms(name))"
        : "host, probed_at, domains(domain, platform_id, platforms(name))",
    )
    .eq("failed", false)
    .gt("probed_at", sub.last_live_seen_at)
    .order("probed_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (sub.scope === "domains" && sub.domain_ids.length) {
    query = query.in("domain_id", sub.domain_ids);
  } else if (platformScoped) {
    query = query.in("domains.platform_id", sub.platform_ids);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    host: string;
    probed_at: string;
    domains: { domain: string; platforms: { name: string } | null } | null;
  }[];

  const keywords = (sub.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);

  return rows
    .filter((r) => r.domains)
    .filter((r) => !keywords.length || keywords.some((k) => r.host.toLowerCase().includes(k)))
    .map((r) => ({
      host: r.host,
      domain: r.domains?.domain ?? "",
      platform: r.domains?.platforms?.name ?? null,
      first_seen_at: r.probed_at,
    }));
}

export type DispatchResult = {
  sent: boolean;
  hosts: number;
  reason?: string;
};

/**
 * Renders and sends one subscription's digest, then advances its high-water mark.
 * `force` skips the frequency throttle (used by the "send now" button).
 */
export async function dispatchSubscription(
  sub: AlertSubscription,
  opts: { force?: boolean } = {},
): Promise<DispatchResult> {
  if (!opts.force && !isDue(sub)) return { sent: false, hosts: 0, reason: "not_due" };

  const hosts = await pendingHosts(sub);
  if (!hosts.length) return { sent: false, hosts: 0, reason: "nothing_new" };

  const { sendAlertEmail } = await import("@/lib/alerts-email.server");
  const result = await sendAlertEmail(sub, hosts);

  const newest = hosts.reduce(
    (max, h) => (h.first_seen_at > max ? h.first_seen_at : max),
    sub.last_host_seen_at,
  );

  await supabaseAdmin
    .from("alert_subscriptions")
    .update({
      last_sent_at: new Date().toISOString(),
      last_host_seen_at: newest,
      sent_count: sub.sent_count + (result.sent ? hosts.length : 0),
    })
    .eq("id", sub.id);

  return { sent: result.sent, hosts: hosts.length, ...(result.reason ? { reason: result.reason } : {}) };
}

/** Called from the background scan tick; processes every due subscription. */
export async function dispatchDueAlerts(budgetMs = 8_000): Promise<{
  processed: number;
  sent: number;
}> {
  const startedAt = Date.now();
  const { data, error } = await supabaseAdmin
    .from("alert_subscriptions")
    .select("*")
    .eq("is_active", true)
    .order("last_sent_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (error) throw new Error(error.message);

  let processed = 0;
  let sent = 0;
  for (const row of (data ?? []) as unknown as AlertSubscription[]) {
    if (Date.now() - startedAt > budgetMs) break;
    if (!isDue(row)) continue;
    processed += 1;
    try {
      const result = await dispatchSubscription(row);
      if (result.sent) sent += 1;
    } catch (err) {
      console.error(`alert dispatch failed for ${row.id}:`, err);
    }
  }
  return { processed, sent };
}

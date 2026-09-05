import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FREQUENCIES = ["instant", "continuous", "hourly", "daily"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  instant: "Instant (within ~1 minute)",
  continuous: "Continuous (every 15 minutes)",
  hourly: "Hourly digest",
  daily: "Daily digest",
};

const subscriptionInput = z.object({
  email: z.string().trim().email(),
  frequency: z.enum(FREQUENCIES),
  scope: z.enum(["all", "platforms", "domains"]),
  platform_ids: z.array(z.string().uuid()).max(50).default([]),
  domains: z.array(z.string().trim().min(1).max(253)).max(200).default([]),
  keywords: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  notify_live: z.boolean().default(false),
  live_status_codes: z
    .array(z.number().int().min(100).max(599))
    .max(20)
    .default([]),
});

export const LIVE_STATUS_CODES = [200, 201, 204, 301, 302, 307, 308, 400, 401, 403, 404, 500, 502, 503] as const;

export const listAlertSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alert_subscriptions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function resolveDomainIds(
  supabase: { from: (t: string) => any },
  domains: string[],
): Promise<string[]> {
  if (!domains.length) return [];
  const { data, error } = await supabase
    .from("domains")
    .select("id, domain")
    .in("domain", domains.map((d) => d.toLowerCase()));
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export const createAlertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subscriptionInput.parse(data))
  .handler(async ({ data, context }) => {
    const domain_ids =
      data.scope === "domains" ? await resolveDomainIds(context.supabase, data.domains) : [];
    if (data.scope === "domains" && domain_ids.length === 0) {
      throw new Error("None of those root domains are being monitored yet");
    }
    if (data.scope === "platforms" && data.platform_ids.length === 0) {
      throw new Error("Pick at least one program");
    }

    const { error } = await context.supabase.from("alert_subscriptions").insert({
      user_id: context.userId,
      email: data.email,
      frequency: data.frequency,
      scope: data.scope,
      platform_ids: data.scope === "platforms" ? data.platform_ids : [],
      domain_ids,
      keywords: data.keywords.map((k) => k.toLowerCase()),
      notify_live: data.notify_live,
      live_status_codes: data.live_status_codes,
      last_host_seen_at: new Date().toISOString(),
      last_live_seen_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-click "notify me when new live hosts appear" from /live.
 * Uses the signed-in user's account email; scope optional (domain or platform).
 */
export const createLiveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        frequency: z.enum(FREQUENCIES).default("hourly"),
        domain: z.string().trim().min(1).max(253).optional(),
        platformSlug: z.string().trim().min(1).max(100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let email = (context.claims?.email as string | undefined) ?? null;
    if (!email) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("email")
        .eq("id", context.userId)
        .maybeSingle();
      email = (profile as { email: string | null } | null)?.email ?? null;
    }
    if (!email) throw new Error("Your account has no email address");

    let scope: "all" | "platforms" | "domains" = "all";
    let domain_ids: string[] = [];
    let platform_ids: string[] = [];

    if (data.domain) {
      domain_ids = await resolveDomainIds(context.supabase, [data.domain]);
      if (!domain_ids.length) throw new Error("That root domain is not being monitored yet");
      scope = "domains";
    } else if (data.platformSlug) {
      const { data: platform, error } = await context.supabase
        .from("platforms")
        .select("id")
        .eq("slug", data.platformSlug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!platform) throw new Error("Unknown platform");
      platform_ids = [(platform as { id: string }).id];
      scope = "platforms";
    }

    // Reuse an existing identical live alert instead of duplicating it.
    const { data: existing } = await context.supabase
      .from("alert_subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("notify_live", true)
      .eq("scope", scope)
      .limit(10);
    const match = (existing ?? []).find(() => scope === "all"); // dedupe only for global alerts
    if (match) {
      await context.supabase
        .from("alert_subscriptions")
        .update({ is_active: true, frequency: data.frequency })
        .eq("id", (match as { id: string }).id);
      return { ok: true, reused: true };
    }

    const { error } = await context.supabase.from("alert_subscriptions").insert({
      user_id: context.userId,
      email,
      frequency: data.frequency,
      scope,
      platform_ids,
      domain_ids,
      keywords: [],
      notify_live: true,
      last_host_seen_at: new Date().toISOString(),
      last_live_seen_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, reused: false };
  });

export const setAlertSubscriptionActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alert_subscriptions")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAlertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alert_subscriptions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends the subscription's current pending hosts right now (also used as a test send). */
export const sendAlertNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("alert_subscriptions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Subscription not found");

    const { dispatchSubscription } = await import("@/lib/alerts.server");
    return dispatchSubscription(row as never, { force: true });
  });

/** Sends a sample digest to any address so users can verify email delivery. */
export const sendTestAlertEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().email() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { sendTestAlertEmailTo } = await import("@/lib/alerts-email.server");
    return sendTestAlertEmailTo(data.email);
  });

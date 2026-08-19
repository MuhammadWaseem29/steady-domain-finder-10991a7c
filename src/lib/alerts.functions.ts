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
});

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
      last_host_seen_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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

/** Sends a sample digest to an address the caller owns, so they can verify delivery. */
export const sendTestAlertEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().email() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const target = data.email.trim().toLowerCase();

    // Only allow addresses that provably belong to the caller: their own account
    // email, or an address already used by one of their alert subscriptions.
    const claimEmail =
      typeof context.claims["email"] === "string"
        ? (context.claims["email"] as string).toLowerCase()
        : null;

    let allowed = claimEmail === target;

    if (!allowed) {
      const { data: owned, error } = await context.supabase
        .from("alert_subscriptions")
        .select("id")
        .eq("user_id", context.userId)
        .ilike("email", target)
        .limit(1);
      if (error) throw new Error(error.message);
      allowed = (owned ?? []).length > 0;
    }

    if (!allowed) {
      throw new Error(
        "You can only send a test email to your own account email or an address already used by one of your alerts.",
      );
    }

    const { sendTestAlertEmailTo } = await import("@/lib/alerts-email.server");
    return sendTestAlertEmailTo(target);
  });


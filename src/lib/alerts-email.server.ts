// Server-only email rendering + send for subdomain alerts.
import type { AlertHost, AlertSubscription } from "@/lib/alerts.server";

export type SendResult = { sent: boolean; reason?: string };

/**
 * Sends one alert digest. Wired to the project's managed email sender once a
 * verified sender domain exists; until then it fails loudly instead of
 * silently dropping alerts.
 */
export async function sendAlertEmail(
  sub: AlertSubscription,
  hosts: AlertHost[],
): Promise<SendResult> {
  console.warn(
    `[alerts] email sender not configured — skipped ${hosts.length} hosts for ${sub.email}`,
  );
  return { sent: false, reason: "email_domain_not_configured" };
}

// Server-only email rendering + send for subdomain alerts.
import type { AlertHost, AlertSubscription } from "@/lib/alerts.server";
import { PREVIEW_LIMIT } from "@/lib/alerts.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export type SendResult = { sent: boolean; reason?: string };

const FREQUENCY_LABELS: Record<AlertSubscription["frequency"], string> = {
  instant: "Instant alert",
  continuous: "Continuous alert",
  hourly: "Hourly digest",
  daily: "Daily digest",
};

const SITE_URL = "https://chaos.thescope.top";

/** Sends one alert digest through the project's managed email sender. */
export async function sendAlertEmail(
  sub: AlertSubscription,
  hosts: AlertHost[],
): Promise<SendResult> {
  const shown = hosts.slice(0, PREVIEW_LIMIT);
  const newest = hosts.reduce(
    (max, h) => (h.first_seen_at > max ? h.first_seen_at : max),
    sub.last_host_seen_at,
  );

  try {
    const result = await sendTemplateEmail("new-subdomains", sub.email, {
      templateData: {
        hosts: shown.map((h) => ({
          host: h.host,
          domain: h.domain,
          platform: h.platform,
        })),
        totalCount: hosts.length,
        shownCount: shown.length,
        frequencyLabel: FREQUENCY_LABELS[sub.frequency],
        siteUrl: SITE_URL,
      },
      idempotencyKey: `new-subdomains-${sub.id}-${newest}`,
    });

    if (!result.sent) return { sent: false, reason: result.reason };
    return { sent: true };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "send_failed";
    console.error(`[alerts] send failed for ${sub.id}:`, err);
    return { sent: false, reason: code };
  }
}

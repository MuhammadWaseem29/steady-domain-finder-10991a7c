// Server-only email rendering + send for subdomain alerts (delivered via Resend).
import * as React from "react";
import { render } from "@react-email/render";

import type { AlertHost, AlertSubscription } from "@/lib/alerts.server";
import { PREVIEW_LIMIT } from "@/lib/alerts.server";
import { template as newSubdomainsTemplate } from "@/lib/email-templates/new-subdomains";
import { sendResendEmail } from "@/lib/resend.server";

export type SendResult = { sent: boolean; reason?: string; id?: string };

const FREQUENCY_LABELS: Record<AlertSubscription["frequency"], string> = {
  instant: "Instant alert",
  continuous: "Continuous alert",
  hourly: "Hourly digest",
  daily: "Daily digest",
};

const SITE_URL = "https://chaos.thescope.top";

type DigestData = {
  hosts: { host: string; domain?: string; platform?: string | null }[];
  totalCount: number;
  shownCount: number;
  frequencyLabel: string;
  siteUrl: string;
};

function subjectFor(data: DigestData): string {
  const s = newSubdomainsTemplate.subject;
  return typeof s === "function" ? s(data) : s;
}

async function renderDigest(data: DigestData): Promise<{ html: string; subject: string }> {
  const html = await render(React.createElement(newSubdomainsTemplate.component, data));
  return { html, subject: subjectFor(data) };
}

/** Sends one alert digest through Resend. */
export async function sendAlertEmail(
  sub: AlertSubscription,
  hosts: AlertHost[],
): Promise<SendResult> {
  const shown = hosts.slice(0, PREVIEW_LIMIT);
  const newest = hosts.reduce(
    (max, h) => (h.first_seen_at > max ? h.first_seen_at : max),
    sub.last_host_seen_at,
  );

  const data: DigestData = {
    hosts: shown.map((h) => ({ host: h.host, domain: h.domain, platform: h.platform })),
    totalCount: hosts.length,
    shownCount: shown.length,
    frequencyLabel: FREQUENCY_LABELS[sub.frequency],
    siteUrl: SITE_URL,
  };

  try {
    const { html, subject } = await renderDigest(data);
    const result = await sendResendEmail({
      to: sub.email,
      subject,
      html,
      idempotencyKey: `new-subdomains-${sub.id}-${newest}`,
    });
    return { sent: true, id: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    console.error(`[alerts] send failed for ${sub.id}:`, err);
    return { sent: false, reason: message };
  }
}

/** Sends a sample digest so users can verify delivery works. */
export async function sendTestAlertEmailTo(to: string): Promise<SendResult> {
  const sampleHosts = [
    { host: "api-staging.lovable.app", domain: "lovable.app", platform: "self" },
    { host: "internal-dashboard.lovable.app", domain: "lovable.app", platform: "self" },
    { host: "vpn.taobao.com", domain: "taobao.com", platform: "self" },
    { host: "dev-gateway.digimobil.es", domain: "digimobil.es", platform: "self" },
    { host: "admin.hackerone-demo.com", domain: "hackerone-demo.com", platform: "hackerone" },
  ];

  const data: DigestData = {
    hosts: sampleHosts,
    totalCount: sampleHosts.length,
    shownCount: sampleHosts.length,
    frequencyLabel: "Test email",
    siteUrl: SITE_URL,
  };

  try {
    const { html, subject } = await renderDigest(data);
    const result = await sendResendEmail({
      to,
      subject: `[Test] ${subject}`,
      html,
    });
    return { sent: true, id: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    console.error(`[alerts] test send failed for ${to}:`, err);
    return { sent: false, reason: message };
  }
}

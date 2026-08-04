// Server-only: sends email through the Resend connector via the Lovable gateway.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

/**
 * Verified sender. Override with ALERT_FROM_EMAIL once a domain is verified in
 * Resend; until then Resend's shared onboarding sender is used.
 */
export function alertFromAddress(): string {
  const configured = process.env["ALERT_FROM_EMAIL"];
  const address = configured && configured.includes("@") ? configured : "onboarding@resend.dev";
  return `Chaos Alerts <${address}>`;
}

export type ResendSendResult = { id: string };

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
}): Promise<ResendSendResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": resendKey,
  };
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey.slice(0, 256);

  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: alertFromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`[resend] send failed [${response.status}]: ${body}`);
    throw new Error(`Resend request failed [${response.status}]: ${body}`);
  }

  let parsed: { id?: string } = {};
  try {
    parsed = JSON.parse(body) as { id?: string };
  } catch {
    /* provider returned non-JSON on success */
  }
  return { id: parsed.id ?? "unknown" };
}

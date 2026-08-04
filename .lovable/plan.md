# Switch alert emails to Resend + add a test-email flow

Alerts already work end to end (subscriptions, aggregation, digest template, cron dispatch). Only the delivery layer changes: instead of Lovable's managed sender waiting on DNS verification, emails go out through the Resend connector via the Lovable gateway.

## What changes

**1. Connect Resend**
Link the Resend connection to this project (a connect card appears in chat). This exposes the gateway credentials to server code — no API key pasting.

**2. New delivery layer**
A server-only sender renders the existing React Email digest template to HTML and POSTs it to Resend through the gateway. It keeps the current behaviour: per-subscription idempotency, suppression/failure handling returning `{ sent, reason }`, and error logging.

The alert engine keeps calling one `sendAlertEmail(...)` function, so the cron dispatcher, instant/hourly/daily logic, and keyword filtering stay untouched.

**3. Sender address**
Resend requires a verified domain to email arbitrary recipients. Two options:
- If `chaos.thescope.top` (or a subdomain) is verified in the Resend account, send from e.g. `alerts@chaos.thescope.top`.
- Otherwise fall back to Resend's `onboarding@resend.dev`, which only delivers to the Resend account owner's own address.

I'll detect which is available after connecting by listing verified domains through the gateway, and use the best one automatically.

**4. Test-email option**
- A "Send test email" control on `/alerts` (authenticated users only) that sends a sample digest with realistic dummy subdomains to any address you type, defaulting to your account email.
- Backed by an authenticated server function so it can't be abused anonymously.
- Result is surfaced as a toast with the real provider response (delivered / error message from Resend).

**5. Tests I'll run**
- Send a live test email to `wgujjer11@gmail.com` and confirm Resend returns a message id.
- Fire a real digest for an existing subscription using actual recently-discovered subdomains and confirm it sends.
- Verify instant / hourly / daily gating: a subscription that has already been notified doesn't re-send, and a fresh discovery does.
- Verify the cron dispatcher path calls the new sender (run the dispatcher manually and read logs).
- Confirm the rendered HTML looks right (subject, host list, counts, links back to the site).

I'll report each check's result.

## Technical notes

- New `src/lib/resend.server.ts`: gateway POST to `https://connector-gateway.lovable.dev/resend/emails` with `Authorization: Bearer LOVABLE_API_KEY` and `X-Connection-Api-Key: RESEND_API_KEY`, surfacing provider status + body on failure.
- `src/lib/alerts-email.server.ts` rewired to render `new-subdomains` via `@react-email/render` and hand HTML to the Resend sender; same exported signature.
- `sendTestAlertEmail` server function added to `src/lib/alerts.functions.ts` with `requireSupabaseAuth`; UI control added to `src/routes/alerts.tsx`.
- `src/lib/email-templates/send-email.ts` stays in place (unused by alerts) so nothing else breaks.

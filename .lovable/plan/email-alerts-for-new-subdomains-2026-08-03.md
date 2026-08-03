# Email alerts for new subdomains

Signed-in users can subscribe to email alerts when new subdomains are discovered, choosing how often they want to hear about it.

## Prerequisite: sender domain

Emails must be sent from a domain you own. You already use `chaos.thescope.top`, so we can set up a sender subdomain (e.g. `notify.thescope.top`) through the email setup flow. DNS verification runs in the background; everything else can be built while it verifies.

## 1. Subscription model

A new subscriptions table, one row per user per subscription, storing:

- Frequency: **Instant**, **Hourly**, **Daily**, or **Continuous** (a rolling digest every 15 minutes)
- Scope: everything, specific programs (HackerOne / Bugcrowd / Intigriti / YesWeHack / Self), or specific root domains
- Optional keyword filter (e.g. only hosts containing `api`, `vpn`, `admin`)
- Active toggle, last-sent timestamp, and a high-water mark so no host is ever emailed twice
- Row-level security: each user only sees and edits their own subscriptions

Instant is throttled to at most one email every 5 minutes per subscription so a big scan burst can't flood the inbox.

## 2. Alerts page (`/alerts`)

New signed-in-only page, styled like the rest of the site:

- Create a subscription: pick frequency, scope, optional keyword filter, recipient address (defaults to the account email)
- List of existing subscriptions with last-sent time, hosts sent, pause/resume, edit, delete
- "Send me a test email" button
- Header/footer link added next to Account

Anonymous visitors see an inline prompt to sign in, matching the existing gating.

## 3. Email delivery

- A branded React email template matching the Chaos look: header, count of new hosts, grouped by program and root domain, a capped preview list (first ~200 hosts) with a link to the site for the full set, and a footer. Unsubscribe is handled automatically by the platform.
- A dispatcher runs on the existing background cron tick: it finds subscriptions that are due, pulls only hosts discovered since that subscription's high-water mark, applies scope and keyword filters, sends one email per subscription, and advances the mark. Subscriptions with nothing new send nothing.
- Instant subscriptions are evaluated on the same tick (the scan cycle already runs every minute), so alerts arrive within about a minute of discovery.

## 4. API parity

The `/api/v1` docs page gets a short section listing alert subscriptions and their frequencies as read-only endpoints, so tokens can inspect what is configured.

## Technical notes

- New `alert_subscriptions` table with owner-scoped RLS plus grants; sends recorded on the subscription row (`last_sent_at`, `last_host_seen_at`, `sent_count`) rather than a separate log table.
- Template lives in `src/lib/email-templates/`, sent through the platform's managed send helper — no queue tables, no third-party keys.
- Dispatcher lives in `src/lib/alerts.server.ts` and is invoked from the existing `/api/public/hooks/scan` handler within its time budget, so no new cron job is needed.
- Subscription CRUD goes through authenticated server functions in `src/lib/alerts.functions.ts`.

ALTER TABLE public.alert_subscriptions
  ADD COLUMN live_status_codes integer[] NOT NULL DEFAULT '{}';
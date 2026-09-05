ALTER TABLE public.alert_subscriptions
  ADD COLUMN IF NOT EXISTS notify_live boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_live_seen_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS probe_results_live_idx ON public.probe_results (probed_at DESC) WHERE failed = false;
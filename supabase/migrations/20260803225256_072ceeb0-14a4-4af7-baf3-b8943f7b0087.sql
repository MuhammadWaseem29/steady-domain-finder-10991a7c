CREATE TABLE public.alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily',
  scope text NOT NULL DEFAULT 'all',
  platform_ids uuid[] NOT NULL DEFAULT '{}',
  domain_ids uuid[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  last_host_seen_at timestamptz NOT NULL DEFAULT now(),
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_subscriptions TO authenticated;
GRANT ALL ON public.alert_subscriptions TO service_role;

ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alert subscriptions"
  ON public.alert_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own alert subscriptions"
  ON public.alert_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own alert subscriptions"
  ON public.alert_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own alert subscriptions"
  ON public.alert_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER alert_subscriptions_set_updated_at
  BEFORE UPDATE ON public.alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_alert_subscriptions_active ON public.alert_subscriptions (is_active, frequency, last_sent_at);
CREATE INDEX idx_alert_subscriptions_user ON public.alert_subscriptions (user_id);
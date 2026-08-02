CREATE TABLE public.live_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, host)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_hosts TO authenticated;
GRANT ALL ON public.live_hosts TO service_role;

ALTER TABLE public.live_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own live hosts" ON public.live_hosts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own live hosts" ON public.live_hosts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own live hosts" ON public.live_hosts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own live hosts" ON public.live_hosts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX live_hosts_user_created_idx ON public.live_hosts (user_id, created_at DESC);

CREATE TRIGGER live_hosts_set_updated_at
  BEFORE UPDATE ON public.live_hosts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
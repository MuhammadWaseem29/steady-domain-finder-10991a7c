ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['read']::text[];

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status integer NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own api logs" ON public.api_request_logs;
CREATE POLICY "Users can view their own api logs"
ON public.api_request_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS api_request_logs_key_created_idx
  ON public.api_request_logs (key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_user_created_idx
  ON public.api_request_logs (user_id, created_at DESC);

-- Per-minute rate limit counter for an API key.
CREATE OR REPLACE FUNCTION public.api_rate_check(_key_id uuid, _limit integer DEFAULT 120)
RETURNS TABLE (used integer, allowed boolean, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window timestamptz := date_trunc('minute', now());
  _used integer;
BEGIN
  SELECT count(*)::int INTO _used
  FROM public.api_request_logs
  WHERE key_id = _key_id AND created_at >= _window;

  used := _used;
  allowed := _used < _limit;
  reset_at := _window + interval '1 minute';
  RETURN NEXT;
END;
$$;

-- Usage summary for the signed-in user's keys.
CREATE OR REPLACE FUNCTION public.api_usage_summary(_user_id uuid)
RETURNS TABLE (
  key_id uuid,
  requests_1h bigint,
  requests_24h bigint,
  requests_7d bigint,
  last_request_at timestamptz,
  error_rate_24h numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.key_id,
    count(*) FILTER (WHERE l.created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE l.created_at > now() - interval '24 hours'),
    count(*) FILTER (WHERE l.created_at > now() - interval '7 days'),
    max(l.created_at),
    COALESCE(
      round(
        100.0 * count(*) FILTER (WHERE l.status >= 400 AND l.created_at > now() - interval '24 hours')
        / NULLIF(count(*) FILTER (WHERE l.created_at > now() - interval '24 hours'), 0), 1),
      0)
  FROM public.api_request_logs l
  WHERE l.user_id = _user_id
  GROUP BY l.key_id;
$$;

-- New hosts for a single root domain within a window.
CREATE OR REPLACE FUNCTION public.domain_new_subs(_domain_id uuid, since timestamptz, lim integer DEFAULT 500)
RETURNS TABLE (id uuid, host text, first_seen_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.host, s.first_seen_at
  FROM public.subdomains s
  WHERE s.domain_id = _domain_id AND s.first_seen_at >= since
  ORDER BY s.first_seen_at DESC
  LIMIT GREATEST(1, LEAST(lim, 2000));
$$;

-- Global host search across all tracked programs.
CREATE OR REPLACE FUNCTION public.search_subdomains(q text, lim integer DEFAULT 100, off integer DEFAULT 0)
RETURNS TABLE (id uuid, host text, domain text, first_seen_at timestamptz, is_active boolean)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.host, d.domain, s.first_seen_at, s.is_active
  FROM public.subdomains s
  JOIN public.domains d ON d.id = s.domain_id
  WHERE s.host ILIKE '%' || q || '%'
  ORDER BY s.first_seen_at DESC
  LIMIT GREATEST(1, LEAST(lim, 1000))
  OFFSET GREATEST(0, off);
$$;

GRANT EXECUTE ON FUNCTION public.api_rate_check(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_usage_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.domain_new_subs(uuid, timestamptz, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.search_subdomains(text, integer, integer) TO service_role, authenticated;
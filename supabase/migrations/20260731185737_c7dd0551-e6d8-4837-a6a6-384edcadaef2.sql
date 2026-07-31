CREATE OR REPLACE FUNCTION public.running_scans_detail(lim integer DEFAULT 50)
RETURNS TABLE(scan_id uuid, domain text, platform_name text, platform_slug text, platform_color text, trigger text, started_at timestamptz, elapsed_seconds numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT s.id, d.domain, p.name, p.slug, p.color, s.trigger, s.started_at,
         extract(epoch from (now() - s.started_at))::numeric
  FROM public.scans s
  JOIN public.domains d ON d.id = s.domain_id
  LEFT JOIN public.platforms p ON p.id = d.platform_id
  WHERE s.status = 'running'
  ORDER BY s.started_at ASC
  LIMIT greatest(least(coalesce(lim, 50), 200), 1)
$$;

CREATE OR REPLACE FUNCTION public.scan_activity_summary()
RETURNS TABLE(running bigint, claimed_5m bigint, finished_5m bigint, new_subs_5m bigint, new_subs_1h bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.scans WHERE status = 'running')::bigint,
    (SELECT count(*) FROM public.domains WHERE claimed_at > now() - interval '5 minutes')::bigint,
    (SELECT count(*) FROM public.scans WHERE finished_at > now() - interval '5 minutes')::bigint,
    (SELECT count(*) FROM public.subdomains WHERE first_seen_at > now() - interval '5 minutes')::bigint,
    (SELECT count(*) FROM public.subdomains WHERE first_seen_at > now() - interval '1 hour')::bigint
$$;

CREATE OR REPLACE FUNCTION public.platform_updates(since timestamptz)
RETURNS TABLE(platform_id uuid, slug text, name text, color text, new_count bigint, domains_affected bigint, last_seen timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT p.id, p.slug, p.name, p.color,
         count(s.id)::bigint,
         count(DISTINCT s.domain_id)::bigint,
         max(s.first_seen_at)
  FROM public.platforms p
  JOIN public.domains d ON d.platform_id = p.id
  JOIN public.subdomains s ON s.domain_id = d.id AND s.first_seen_at >= since
  GROUP BY p.id, p.slug, p.name, p.color
  ORDER BY 5 DESC
$$;

CREATE OR REPLACE FUNCTION public.platform_recent_subdomains(_platform_id uuid, since timestamptz, lim integer DEFAULT 100)
RETURNS TABLE(host text, domain text, first_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT s.host, d.domain, s.first_seen_at
  FROM public.subdomains s
  JOIN public.domains d ON d.id = s.domain_id
  WHERE d.platform_id = _platform_id AND s.first_seen_at >= since
  ORDER BY s.first_seen_at DESC
  LIMIT greatest(least(coalesce(lim, 100), 1000), 1)
$$;

GRANT EXECUTE ON FUNCTION public.running_scans_detail(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_activity_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_updates(timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_recent_subdomains(uuid, timestamptz, integer) TO anon, authenticated;
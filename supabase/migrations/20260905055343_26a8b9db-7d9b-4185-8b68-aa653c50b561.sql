CREATE OR REPLACE FUNCTION public.platform_live_stats()
RETURNS TABLE(platform_id uuid, live_hosts bigint, takeover_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (pr.host) pr.domain_id, pr.failed, pr.takeover_risk
    FROM public.probe_results pr
    ORDER BY pr.host, pr.probed_at DESC
  )
  SELECT d.platform_id,
         count(*) FILTER (WHERE NOT l.failed) AS live_hosts,
         count(*) FILTER (WHERE l.takeover_risk AND NOT l.failed) AS takeover_count
  FROM latest l
  JOIN public.domains d ON d.id = l.domain_id
  GROUP BY d.platform_id;
$$;

GRANT EXECUTE ON FUNCTION public.platform_live_stats() TO anon, authenticated, service_role;
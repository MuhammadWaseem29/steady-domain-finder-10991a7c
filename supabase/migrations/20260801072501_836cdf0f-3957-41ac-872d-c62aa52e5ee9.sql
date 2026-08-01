CREATE OR REPLACE FUNCTION public.domain_subdomain_stats(_domain_id uuid)
RETURNS TABLE(total bigint, new_24h bigint, new_7d bigint, active bigint, inactive bigint, latest_seen timestamptz)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT count(*)::bigint,
         count(*) FILTER (WHERE first_seen_at > now() - interval '24 hours')::bigint,
         count(*) FILTER (WHERE first_seen_at > now() - interval '7 days')::bigint,
         count(*) FILTER (WHERE is_active)::bigint,
         count(*) FILTER (WHERE NOT is_active)::bigint,
         max(last_seen_at)
  FROM public.subdomains
  WHERE domain_id = _domain_id
$$;

CREATE OR REPLACE FUNCTION public.domain_subdomains_page(
  _domain_id uuid,
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all',
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, host text, label text, first_seen_at timestamptz, last_seen_at timestamptz, is_active boolean, total_count bigint)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT s.id, s.host, s.label, s.first_seen_at, s.last_seen_at, s.is_active
    FROM public.subdomains s
    WHERE s.domain_id = _domain_id
      AND (_search IS NULL OR _search = '' OR s.host ILIKE '%' || _search || '%')
      AND (
        coalesce(_filter,'all') = 'all'
        OR (_filter = 'new' AND s.first_seen_at > now() - interval '24 hours')
        OR (_filter = 'inactive' AND NOT s.is_active)
      )
  ), counted AS (
    SELECT count(*)::bigint AS c FROM base
  )
  SELECT b.id, b.host, b.label, b.first_seen_at, b.last_seen_at, b.is_active, counted.c
  FROM base b CROSS JOIN counted
  ORDER BY b.first_seen_at DESC, b.id DESC
  LIMIT greatest(least(coalesce(_limit, 100), 1000), 1)
  OFFSET greatest(coalesce(_offset, 0), 0)
$$;

GRANT EXECUTE ON FUNCTION public.domain_subdomain_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.domain_subdomains_page(uuid, text, text, integer, integer) TO anon, authenticated, service_role;
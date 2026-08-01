DROP FUNCTION IF EXISTS public.domain_subdomains_page(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.domain_subdomains_page(
  _domain_id uuid,
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all',
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, host text, label text, first_seen_at timestamptz, last_seen_at timestamptz, is_active boolean)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT s.id, s.host, s.label, s.first_seen_at, s.last_seen_at, s.is_active
  FROM public.subdomains s
  WHERE s.domain_id = _domain_id
    AND (_search IS NULL OR _search = '' OR s.host ILIKE '%' || _search || '%')
    AND (
      coalesce(_filter,'all') = 'all'
      OR (_filter = 'new' AND s.first_seen_at > now() - interval '24 hours')
      OR (_filter = 'inactive' AND NOT s.is_active)
    )
  ORDER BY s.first_seen_at DESC, s.id DESC
  LIMIT greatest(least(coalesce(_limit, 100), 1000), 1)
  OFFSET greatest(coalesce(_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION public.domain_subdomains_count(
  _domain_id uuid,
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all'
)
RETURNS bigint
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT count(*)::bigint
  FROM public.subdomains s
  WHERE s.domain_id = _domain_id
    AND (_search IS NULL OR _search = '' OR s.host ILIKE '%' || _search || '%')
    AND (
      coalesce(_filter,'all') = 'all'
      OR (_filter = 'new' AND s.first_seen_at > now() - interval '24 hours')
      OR (_filter = 'inactive' AND NOT s.is_active)
    )
$$;

GRANT EXECUTE ON FUNCTION public.domain_subdomains_page(uuid, text, text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.domain_subdomains_count(uuid, text, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.domain_updates_page(
  _since timestamptz,
  _search text DEFAULT NULL,
  _platform_id uuid DEFAULT NULL,
  _sort text DEFAULT 'new',
  _dir text DEFAULT 'desc',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  domain text,
  total_subdomains integer,
  new_count bigint,
  last_seen timestamptz,
  last_scanned_at timestamptz,
  platform_id uuid,
  platform_slug text,
  platform_name text,
  platform_color text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT d.id,
         d.domain,
         d.total_subdomains,
         COALESCE(n.c, 0) AS new_count,
         n.last_seen,
         d.last_scanned_at,
         d.platform_id,
         p.slug,
         p.name,
         p.color
  FROM public.domains d
  LEFT JOIN public.platforms p ON p.id = d.platform_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS c, max(s.first_seen_at) AS last_seen
    FROM public.subdomains s
    WHERE s.domain_id = d.id AND s.first_seen_at >= _since
  ) n ON true
  WHERE (_platform_id IS NULL OR d.platform_id = _platform_id)
    AND (_search IS NULL OR _search = '' OR d.domain ILIKE '%' || _search || '%')
  ORDER BY
    CASE WHEN _sort = 'new' AND _dir = 'desc' THEN COALESCE(n.c, 0) END DESC NULLS LAST,
    CASE WHEN _sort = 'new' AND _dir = 'asc' THEN COALESCE(n.c, 0) END ASC NULLS LAST,
    CASE WHEN _sort = 'total' AND _dir = 'desc' THEN d.total_subdomains END DESC NULLS LAST,
    CASE WHEN _sort = 'total' AND _dir = 'asc' THEN d.total_subdomains END ASC NULLS LAST,
    CASE WHEN _sort = 'domain' AND _dir = 'desc' THEN d.domain END DESC NULLS LAST,
    CASE WHEN _sort = 'domain' AND _dir = 'asc' THEN d.domain END ASC NULLS LAST,
    d.total_subdomains DESC,
    d.domain ASC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0)
$$;

CREATE OR REPLACE FUNCTION public.domain_updates_count(
  _search text DEFAULT NULL,
  _platform_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.domains d
  WHERE (_platform_id IS NULL OR d.platform_id = _platform_id)
    AND (_search IS NULL OR _search = '' OR d.domain ILIKE '%' || _search || '%')
$$;

GRANT EXECUTE ON FUNCTION public.domain_updates_page(timestamptz, text, uuid, text, text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.domain_updates_count(text, uuid) TO anon, authenticated, service_role;
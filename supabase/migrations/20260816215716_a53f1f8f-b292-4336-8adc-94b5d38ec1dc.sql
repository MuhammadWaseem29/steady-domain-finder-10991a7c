DROP FUNCTION IF EXISTS public.domain_updates_page(timestamptz, text, uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.domain_updates_count(text, uuid);

CREATE OR REPLACE FUNCTION public.domain_updates_page(
  _since timestamptz,
  _search text DEFAULT NULL,
  _platform_id uuid DEFAULT NULL,
  _sort text DEFAULT 'new',
  _dir text DEFAULT 'desc',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _keyword text DEFAULT NULL,
  _only_new boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, domain text, total_subdomains integer, new_count bigint,
  last_seen timestamptz, last_scanned_at timestamptz,
  platform_id uuid, platform_slug text, platform_name text, platform_color text
)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT d.id, d.domain, d.total_subdomains, COALESCE(n.c, 0) AS new_count,
         n.last_seen, d.last_scanned_at, d.platform_id, p.slug, p.name, p.color
  FROM public.domains d
  LEFT JOIN public.platforms p ON p.id = d.platform_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS c, max(s.first_seen_at) AS last_seen
    FROM public.subdomains s
    WHERE s.domain_id = d.id AND s.first_seen_at >= _since
      AND (_keyword IS NULL OR _keyword = '' OR s.host ILIKE '%' || _keyword || '%')
  ) n ON true
  WHERE (_platform_id IS NULL OR d.platform_id = _platform_id)
    AND (_search IS NULL OR _search = '' OR d.domain ILIKE '%' || _search || '%')
    AND (NOT coalesce(_only_new, false) OR COALESCE(n.c, 0) > 0)
  ORDER BY
    CASE WHEN _sort = 'new' AND _dir = 'desc' THEN COALESCE(n.c, 0) END DESC NULLS LAST,
    CASE WHEN _sort = 'new' AND _dir = 'asc' THEN COALESCE(n.c, 0) END ASC NULLS LAST,
    CASE WHEN _sort = 'total' AND _dir = 'desc' THEN d.total_subdomains END DESC NULLS LAST,
    CASE WHEN _sort = 'total' AND _dir = 'asc' THEN d.total_subdomains END ASC NULLS LAST,
    CASE WHEN _sort = 'domain' AND _dir = 'desc' THEN d.domain END DESC NULLS LAST,
    CASE WHEN _sort = 'domain' AND _dir = 'asc' THEN d.domain END ASC NULLS LAST,
    d.total_subdomains DESC, d.domain ASC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0)
$function$;

CREATE OR REPLACE FUNCTION public.domain_updates_count(
  _search text DEFAULT NULL,
  _platform_id uuid DEFAULT NULL,
  _since timestamptz DEFAULT NULL,
  _keyword text DEFAULT NULL,
  _only_new boolean DEFAULT false
)
RETURNS bigint
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT count(*)
  FROM public.domains d
  WHERE (_platform_id IS NULL OR d.platform_id = _platform_id)
    AND (_search IS NULL OR _search = '' OR d.domain ILIKE '%' || _search || '%')
    AND (
      NOT coalesce(_only_new, false)
      OR (_since IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.subdomains s
        WHERE s.domain_id = d.id AND s.first_seen_at >= _since
          AND (_keyword IS NULL OR _keyword = '' OR s.host ILIKE '%' || _keyword || '%')
      ))
    )
$function$;

CREATE OR REPLACE FUNCTION public.domain_updates_summary(
  _since timestamptz,
  _search text DEFAULT NULL,
  _platform_id uuid DEFAULT NULL,
  _keyword text DEFAULT NULL,
  _only_new boolean DEFAULT false
)
RETURNS TABLE(companies bigint, companies_with_new bigint, new_hosts bigint, total_subdomains bigint)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT d.id, d.total_subdomains,
           (SELECT count(*) FROM public.subdomains s
             WHERE s.domain_id = d.id AND s.first_seen_at >= _since
               AND (_keyword IS NULL OR _keyword = '' OR s.host ILIKE '%' || _keyword || '%')
           ) AS c
    FROM public.domains d
    WHERE (_platform_id IS NULL OR d.platform_id = _platform_id)
      AND (_search IS NULL OR _search = '' OR d.domain ILIKE '%' || _search || '%')
  )
  SELECT count(*) FILTER (WHERE NOT coalesce(_only_new,false) OR c > 0),
         count(*) FILTER (WHERE c > 0),
         coalesce(sum(c) ,0)::bigint,
         coalesce(sum(total_subdomains) FILTER (WHERE NOT coalesce(_only_new,false) OR c > 0), 0)::bigint
  FROM base
$function$;

GRANT EXECUTE ON FUNCTION public.domain_updates_page(timestamptz, text, uuid, text, text, integer, integer, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.domain_updates_count(text, uuid, timestamptz, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.domain_updates_summary(timestamptz, text, uuid, text, boolean) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.platform_subdomains_page(
  _platform_id uuid,
  _after_domain uuid DEFAULT NULL,
  _after_host text DEFAULT ''::text,
  _lim integer DEFAULT 1000,
  _active_only boolean DEFAULT true,
  _domain_filter text DEFAULT NULL
)
RETURNS TABLE(domain_id uuid, domain text, host text, is_active boolean, first_seen_at timestamp with time zone, last_seen_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.domain_id, d.domain, s.host, s.is_active, s.first_seen_at, s.last_seen_at
  FROM subdomains s
  JOIN domains d ON d.id = s.domain_id
  WHERE d.platform_id = _platform_id
    AND (NOT _active_only OR s.is_active)
    AND (_domain_filter IS NULL OR d.domain ILIKE '%' || _domain_filter || '%')
    AND (_after_domain IS NULL
         OR (s.domain_id > _after_domain)
         OR (s.domain_id = _after_domain AND s.host > _after_host))
  ORDER BY s.domain_id, s.host
  LIMIT LEAST(GREATEST(_lim, 1), 10000);
$$;
REVOKE ALL ON FUNCTION public.platform_subdomains_page(uuid, uuid, text, integer, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_subdomains_page(uuid, uuid, text, integer, boolean, text) TO service_role;
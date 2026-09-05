
CREATE OR REPLACE FUNCTION public.live_program_stats(_limit integer DEFAULT 40, _platform_slug text DEFAULT NULL)
RETURNS TABLE(domain text, platform_name text, platform_slug text, platform_color text, live_hosts bigint, takeover_count bigint, ok_count bigint, auth_count bigint, last_probed_at timestamptz)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH latest AS (
    SELECT DISTINCT ON (pr.host) pr.domain_id, pr.failed, pr.takeover_risk, pr.status_code, pr.probed_at
    FROM public.probe_results pr
    ORDER BY pr.host, pr.probed_at DESC
  )
  SELECT d.domain, p.name, p.slug, p.color,
         count(*) FILTER (WHERE NOT l.failed) AS live_hosts,
         count(*) FILTER (WHERE l.takeover_risk) AS takeover_count,
         count(*) FILTER (WHERE NOT l.failed AND l.status_code BETWEEN 200 AND 299) AS ok_count,
         count(*) FILTER (WHERE NOT l.failed AND l.status_code IN (401,403)) AS auth_count,
         max(l.probed_at) AS last_probed_at
  FROM latest l
  JOIN public.domains d ON d.id = l.domain_id
  LEFT JOIN public.platforms p ON p.id = d.platform_id
  WHERE (_platform_slug IS NULL OR p.slug = _platform_slug)
  GROUP BY d.domain, p.name, p.slug, p.color
  HAVING count(*) FILTER (WHERE NOT l.failed) > 0
  ORDER BY live_hosts DESC
  LIMIT greatest(_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.live_status_stats(_platform_slug text DEFAULT NULL)
RETURNS TABLE(status_code integer, c bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH latest AS (
    SELECT DISTINCT ON (pr.host) pr.domain_id, pr.failed, pr.status_code
    FROM public.probe_results pr
    ORDER BY pr.host, pr.probed_at DESC
  )
  SELECT l.status_code, count(*) AS c
  FROM latest l
  JOIN public.domains d ON d.id = l.domain_id
  LEFT JOIN public.platforms p ON p.id = d.platform_id
  WHERE NOT l.failed AND l.status_code IS NOT NULL
    AND (_platform_slug IS NULL OR p.slug = _platform_slug)
  GROUP BY l.status_code
  ORDER BY c DESC;
$$;

CREATE OR REPLACE FUNCTION public.live_ip_points(_limit integer DEFAULT 300, _platform_slug text DEFAULT NULL)
RETURNS TABLE(ip text, hosts bigint, takeover_count bigint, sample_host text, sample_domain text, platform_name text, platform_color text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH latest AS (
    SELECT DISTINCT ON (pr.host) pr.host, pr.domain_id, pr.failed, pr.takeover_risk, pr.ip
    FROM public.probe_results pr
    ORDER BY pr.host, pr.probed_at DESC
  )
  SELECT l.ip,
         count(*) AS hosts,
         count(*) FILTER (WHERE l.takeover_risk) AS takeover_count,
         min(l.host) AS sample_host,
         min(d.domain) AS sample_domain,
         min(p.name) AS platform_name,
         min(p.color) AS platform_color
  FROM latest l
  JOIN public.domains d ON d.id = l.domain_id
  LEFT JOIN public.platforms p ON p.id = d.platform_id
  WHERE NOT l.failed AND l.ip IS NOT NULL AND l.ip <> ''
    AND (_platform_slug IS NULL OR p.slug = _platform_slug)
  GROUP BY l.ip
  ORDER BY hosts DESC
  LIMIT greatest(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.live_program_stats(integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.live_status_stats(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.live_ip_points(integer, text) TO anon, authenticated, service_role;

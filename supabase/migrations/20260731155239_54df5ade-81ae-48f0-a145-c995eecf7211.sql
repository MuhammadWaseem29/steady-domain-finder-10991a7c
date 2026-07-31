CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6ee7b7',
  website text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platforms TO anon, authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read platforms" ON public.platforms FOR SELECT USING (true);

INSERT INTO public.platforms (slug, name, color, website) VALUES
  ('hackerone', 'HackerOne', '#ff6a55', 'https://hackerone.com'),
  ('bugcrowd', 'Bugcrowd', '#f26122', 'https://bugcrowd.com'),
  ('intigriti', 'Intigriti', '#ff6d3c', 'https://intigriti.com'),
  ('yeswehack', 'YesWeHack', '#e34a4a', 'https://yeswehack.com'),
  ('self', 'Self-hosted', '#22d3ee', null);

ALTER TABLE public.domains ADD COLUMN platform_id uuid REFERENCES public.platforms(id) ON DELETE SET NULL;
CREATE INDEX idx_domains_platform ON public.domains(platform_id);

INSERT INTO public.domains (domain, platform_id)
SELECT v.d, p.id FROM (VALUES
  ('hackerone.com','hackerone'),
  ('bugcrowd.com','bugcrowd'),
  ('intigriti.com','intigriti'),
  ('yeswehack.com','yeswehack'),
  ('projectdiscovery.io','self')
) AS v(d, s)
JOIN public.platforms p ON p.slug = v.s
ON CONFLICT (domain) DO NOTHING;

UPDATE public.domains d SET platform_id = p.id
FROM public.platforms p, (VALUES
  ('hackerone.com','hackerone'),
  ('bugcrowd.com','bugcrowd'),
  ('intigriti.com','intigriti'),
  ('yeswehack.com','yeswehack'),
  ('projectdiscovery.io','self')
) AS v(dom, s)
WHERE d.domain = v.dom AND p.slug = v.s;

CREATE TABLE public.daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  new_subdomains integer NOT NULL DEFAULT 0,
  scans_run integer NOT NULL DEFAULT 0,
  scan_errors integer NOT NULL DEFAULT 0,
  total_subdomains integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_stats TO anon, authenticated;
GRANT ALL ON public.daily_stats TO service_role;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read daily stats" ON public.daily_stats FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_subdomains_first_seen ON public.subdomains(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_subdomains_domain_first_seen ON public.subdomains(domain_id, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_started ON public.scans(started_at DESC);

CREATE OR REPLACE FUNCTION public.discovery_timeseries(bucket text, since timestamptz)
RETURNS TABLE (ts timestamptz, new_subdomains bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc(
           CASE WHEN bucket IN ('hour','day','week','month') THEN bucket ELSE 'day' END,
           first_seen_at
         ) AS ts,
         count(*)::bigint
  FROM public.subdomains
  WHERE first_seen_at >= since
  GROUP BY 1
  ORDER BY 1
$$;
GRANT EXECUTE ON FUNCTION public.discovery_timeseries(text, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.scan_timeseries(bucket text, since timestamptz)
RETURNS TABLE (ts timestamptz, scans bigint, errors bigint, new_found bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc(
           CASE WHEN bucket IN ('hour','day','week','month') THEN bucket ELSE 'day' END,
           started_at
         ) AS ts,
         count(*)::bigint,
         count(*) FILTER (WHERE status = 'error')::bigint,
         coalesce(sum(new_count),0)::bigint
  FROM public.scans
  WHERE started_at >= since
  GROUP BY 1
  ORDER BY 1
$$;
GRANT EXECUTE ON FUNCTION public.scan_timeseries(text, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS TABLE (
  platform_id uuid,
  slug text,
  name text,
  color text,
  domain_count bigint,
  subdomain_count bigint,
  new_24h bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.slug, p.name, p.color,
    (SELECT count(*) FROM public.domains d WHERE d.platform_id = p.id)::bigint,
    coalesce((SELECT sum(d.total_subdomains) FROM public.domains d WHERE d.platform_id = p.id),0)::bigint,
    (SELECT count(*) FROM public.subdomains s
       JOIN public.domains d ON d.id = s.domain_id
      WHERE d.platform_id = p.id AND s.first_seen_at > now() - interval '24 hours')::bigint
  FROM public.platforms p
  ORDER BY p.name
$$;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.top_domains_by_new(since timestamptz, lim integer)
RETURNS TABLE (domain text, new_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.domain, count(*)::bigint AS new_count
  FROM public.subdomains s
  JOIN public.domains d ON d.id = s.domain_id
  WHERE s.first_seen_at >= since
  GROUP BY d.domain
  ORDER BY new_count DESC
  LIMIT greatest(least(coalesce(lim, 10), 50), 1)
$$;
GRANT EXECUTE ON FUNCTION public.top_domains_by_new(timestamptz, integer) TO anon, authenticated;
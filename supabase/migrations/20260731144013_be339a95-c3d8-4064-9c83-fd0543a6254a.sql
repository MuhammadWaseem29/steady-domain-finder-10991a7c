CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  last_scanned_at timestamptz,
  last_scan_status text,
  total_subdomains integer NOT NULL DEFAULT 0,
  new_subdomains_last_scan integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subdomains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  label text NOT NULL,
  host text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (domain_id, host)
);

CREATE INDEX idx_subdomains_domain ON public.subdomains(domain_id);
CREATE INDEX idx_subdomains_first_seen ON public.subdomains(domain_id, first_seen_at DESC);

CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_returned integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE INDEX idx_scans_domain ON public.scans(domain_id, started_at DESC);

GRANT SELECT ON public.domains TO anon, authenticated;
GRANT SELECT ON public.subdomains TO anon, authenticated;
GRANT SELECT ON public.scans TO anon, authenticated;
GRANT ALL ON public.domains TO service_role;
GRANT ALL ON public.subdomains TO service_role;
GRANT ALL ON public.scans TO service_role;

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdomains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read domains" ON public.domains FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read subdomains" ON public.subdomains FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read scans" ON public.scans FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.domains (domain) VALUES ('lovable.app');
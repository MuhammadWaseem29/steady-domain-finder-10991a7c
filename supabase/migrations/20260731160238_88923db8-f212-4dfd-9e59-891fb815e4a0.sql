CREATE INDEX IF NOT EXISTS idx_subdomains_first_seen_desc ON public.subdomains (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_subdomains_domain_first_seen ON public.subdomains (domain_id, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_started_at ON public.scans (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_domains_platform ON public.domains (platform_id);
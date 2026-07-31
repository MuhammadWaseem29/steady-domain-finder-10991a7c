ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
UPDATE public.domains SET claimed_at = last_scanned_at WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS domains_enabled_claimed_idx ON public.domains (enabled, claimed_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS domains_last_scanned_idx ON public.domains (last_scanned_at NULLS FIRST);

CREATE OR REPLACE FUNCTION public.scan_cycle_health()
RETURNS TABLE(total_domains bigint, scanned_30m bigint, never_scanned bigint, oldest_scan timestamptz, newest_scan timestamptz, running_scans bigint, errors_1h bigint, new_subs_30m bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM public.domains WHERE enabled)::bigint,
    (SELECT count(*) FROM public.domains WHERE enabled AND last_scanned_at > now() - interval '30 minutes')::bigint,
    (SELECT count(*) FROM public.domains WHERE enabled AND last_scanned_at IS NULL)::bigint,
    (SELECT min(last_scanned_at) FROM public.domains WHERE enabled),
    (SELECT max(last_scanned_at) FROM public.domains WHERE enabled),
    (SELECT count(*) FROM public.scans WHERE status = 'running')::bigint,
    (SELECT count(*) FROM public.scans WHERE status = 'error' AND started_at > now() - interval '1 hour')::bigint,
    (SELECT count(*) FROM public.subdomains WHERE first_seen_at > now() - interval '30 minutes')::bigint
$$;

GRANT EXECUTE ON FUNCTION public.scan_cycle_health() TO anon, authenticated, service_role;
CREATE TABLE public.scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','fetching','processing','success','error')),
  hosts jsonb,
  total_hosts integer NOT NULL DEFAULT 0,
  processed_hosts integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.scan_jobs TO service_role;
ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX scan_jobs_one_active_per_domain
  ON public.scan_jobs(domain_id)
  WHERE status IN ('queued','fetching','processing');
CREATE INDEX scan_jobs_pending_idx ON public.scan_jobs(status, created_at);

CREATE OR REPLACE FUNCTION public.ingest_subdomain_chunk(
  _domain_id uuid,
  _hosts jsonb,
  _stamp timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  WITH input_rows AS (
    SELECT DISTINCT
      nullif(item->>'label', '') AS raw_label,
      item->>'host' AS host
    FROM jsonb_array_elements(_hosts) AS item
    WHERE item ? 'host' AND item->>'host' <> ''
  ), inserted AS (
    INSERT INTO public.subdomains(domain_id, label, host, first_seen_at, last_seen_at, is_active)
    SELECT _domain_id, coalesce(raw_label, ''), host, _stamp, _stamp, true
    FROM input_rows
    ON CONFLICT (domain_id, host) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted_count FROM inserted;

  UPDATE public.subdomains s
  SET last_seen_at = _stamp, is_active = true
  FROM jsonb_array_elements(_hosts) AS item
  WHERE s.domain_id = _domain_id
    AND s.host = item->>'host'
    AND s.last_seen_at < _stamp;

  RETURN coalesce(inserted_count, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_subdomain_chunk(uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_subdomain_chunk(uuid, jsonb, timestamptz) TO service_role;
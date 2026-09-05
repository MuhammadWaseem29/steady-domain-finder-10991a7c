CREATE TABLE public.probe_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE,
  platform_slug TEXT,
  program TEXT,
  scope TEXT NOT NULL DEFAULT 'all',
  search TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  total_hosts INTEGER NOT NULL DEFAULT 0,
  probed_hosts INTEGER NOT NULL DEFAULT 0,
  live_hosts INTEGER NOT NULL DEFAULT 0,
  cursor_host TEXT NOT NULL DEFAULT '',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.probe_jobs TO anon;
GRANT SELECT ON public.probe_jobs TO authenticated;
GRANT ALL ON public.probe_jobs TO service_role;
ALTER TABLE public.probe_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read probe jobs" ON public.probe_jobs FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER probe_jobs_set_updated_at BEFORE UPDATE ON public.probe_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.probe_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.probe_jobs(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  url TEXT NOT NULL,
  final_url TEXT,
  status_code INTEGER,
  title TEXT,
  content_length INTEGER,
  content_type TEXT,
  response_time_ms INTEGER,
  webserver TEXT,
  technologies TEXT[] NOT NULL DEFAULT '{}',
  cdn TEXT,
  ip TEXT,
  asn TEXT,
  cname TEXT,
  redirect_chain TEXT[] NOT NULL DEFAULT '{}',
  tls_issuer TEXT,
  tls_expires_at TIMESTAMP WITH TIME ZONE,
  body_hash TEXT,
  failed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  probed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (host, url)
);
GRANT SELECT ON public.probe_results TO anon;
GRANT SELECT ON public.probe_results TO authenticated;
GRANT ALL ON public.probe_results TO service_role;
ALTER TABLE public.probe_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read probe results" ON public.probe_results FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX probe_results_domain_idx ON public.probe_results (domain_id);
CREATE INDEX probe_results_status_idx ON public.probe_results (status_code) WHERE NOT failed;
CREATE INDEX probe_results_job_idx ON public.probe_results (job_id);
CREATE INDEX probe_results_probed_idx ON public.probe_results (probed_at DESC);

-- Atomically claim the next queued job (or re-claim a stale one) for the probe worker.
CREATE OR REPLACE FUNCTION public.claim_probe_job()
RETURNS public.probe_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.probe_jobs;
BEGIN
  UPDATE public.probe_jobs
     SET status = 'running',
         claimed_at = now(),
         started_at = coalesce(started_at, now()),
         updated_at = now()
   WHERE id = (
     SELECT id FROM public.probe_jobs
      WHERE status = 'queued'
         OR (status = 'running' AND claimed_at < now() - interval '2 minutes' AND finished_at IS NULL)
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING * INTO j;
  RETURN j;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_probe_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_probe_job() TO service_role;

-- Record one batch of probe results and advance the job counters.
CREATE OR REPLACE FUNCTION public.record_probe_batch(_job_id uuid, _results jsonb, _cursor_host text, _done boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  live_count integer;
  batch_count integer;
BEGIN
  WITH rows AS (
    SELECT * FROM jsonb_to_recordset(_results) AS x(
      domain_id uuid, host text, url text, final_url text, status_code integer,
      title text, content_length integer, content_type text, response_time_ms integer,
      webserver text, technologies text[], cdn text, ip text, asn text, cname text,
      redirect_chain text[], tls_issuer text, tls_expires_at timestamptz,
      body_hash text, failed boolean, error text
    )
  ), upserted AS (
    INSERT INTO public.probe_results (
      job_id, domain_id, host, url, final_url, status_code, title, content_length,
      content_type, response_time_ms, webserver, technologies, cdn, ip, asn, cname,
      redirect_chain, tls_issuer, tls_expires_at, body_hash, failed, error, probed_at
    )
    SELECT _job_id, domain_id, host, url, final_url, status_code, title, content_length,
           content_type, response_time_ms, webserver, coalesce(technologies,'{}'), cdn, ip, asn, cname,
           coalesce(redirect_chain,'{}'), tls_issuer, tls_expires_at, body_hash,
           coalesce(failed,false), error, now()
    FROM rows
    ON CONFLICT (host, url) DO UPDATE SET
      job_id = _job_id, final_url = EXCLUDED.final_url, status_code = EXCLUDED.status_code,
      title = EXCLUDED.title, content_length = EXCLUDED.content_length,
      content_type = EXCLUDED.content_type, response_time_ms = EXCLUDED.response_time_ms,
      webserver = EXCLUDED.webserver, technologies = EXCLUDED.technologies, cdn = EXCLUDED.cdn,
      ip = EXCLUDED.ip, asn = EXCLUDED.asn, cname = EXCLUDED.cname,
      redirect_chain = EXCLUDED.redirect_chain, tls_issuer = EXCLUDED.tls_issuer,
      tls_expires_at = EXCLUDED.tls_expires_at, body_hash = EXCLUDED.body_hash,
      failed = EXCLUDED.failed, error = EXCLUDED.error, probed_at = now()
    RETURNING failed
  )
  SELECT count(*)::integer, count(*) FILTER (WHERE NOT failed)::integer
    INTO batch_count, live_count
    FROM upserted;

  UPDATE public.probe_jobs
     SET probed_hosts = probed_hosts + coalesce(batch_count, 0),
         live_hosts = live_hosts + coalesce(live_count, 0),
         cursor_host = coalesce(_cursor_host, cursor_host),
         claimed_at = now(),
         status = CASE WHEN _done THEN 'finished' ELSE 'running' END,
         finished_at = CASE WHEN _done THEN now() ELSE finished_at END,
         updated_at = now()
   WHERE id = _job_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_probe_batch(uuid, jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_probe_batch(uuid, jsonb, text, boolean) TO service_role;
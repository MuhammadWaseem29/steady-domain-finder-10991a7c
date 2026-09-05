ALTER TABLE public.probe_results
  ADD COLUMN IF NOT EXISTS takeover_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeover_service text,
  ADD COLUMN IF NOT EXISTS takeover_evidence text;

CREATE INDEX IF NOT EXISTS probe_results_takeover_idx
  ON public.probe_results (probed_at DESC) WHERE takeover_risk;

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
      body_hash text, failed boolean, error text,
      takeover_risk boolean, takeover_service text, takeover_evidence text
    )
  ), upserted AS (
    INSERT INTO public.probe_results (
      job_id, domain_id, host, url, final_url, status_code, title, content_length,
      content_type, response_time_ms, webserver, technologies, cdn, ip, asn, cname,
      redirect_chain, tls_issuer, tls_expires_at, body_hash, failed, error, probed_at,
      takeover_risk, takeover_service, takeover_evidence
    )
    SELECT _job_id, domain_id, host, url, final_url, status_code, title, content_length,
           content_type, response_time_ms, webserver, coalesce(technologies,'{}'), cdn, ip, asn, cname,
           coalesce(redirect_chain,'{}'), tls_issuer, tls_expires_at, body_hash,
           coalesce(failed,false), error, now(),
           coalesce(takeover_risk,false), takeover_service, takeover_evidence
    FROM rows
    ON CONFLICT (host, url) DO UPDATE SET
      job_id = _job_id, final_url = EXCLUDED.final_url, status_code = EXCLUDED.status_code,
      title = EXCLUDED.title, content_length = EXCLUDED.content_length,
      content_type = EXCLUDED.content_type, response_time_ms = EXCLUDED.response_time_ms,
      webserver = EXCLUDED.webserver, technologies = EXCLUDED.technologies, cdn = EXCLUDED.cdn,
      ip = EXCLUDED.ip, asn = EXCLUDED.asn, cname = EXCLUDED.cname,
      redirect_chain = EXCLUDED.redirect_chain, tls_issuer = EXCLUDED.tls_issuer,
      tls_expires_at = EXCLUDED.tls_expires_at, body_hash = EXCLUDED.body_hash,
      failed = EXCLUDED.failed, error = EXCLUDED.error, probed_at = now(),
      takeover_risk = EXCLUDED.takeover_risk, takeover_service = EXCLUDED.takeover_service,
      takeover_evidence = EXCLUDED.takeover_evidence
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
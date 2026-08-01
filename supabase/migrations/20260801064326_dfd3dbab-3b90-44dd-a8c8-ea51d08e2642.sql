-- Ingest a chunk AND atomically record progress on the owning scan row.
CREATE OR REPLACE FUNCTION public.ingest_chunk_with_scan(
  _scan_id uuid,
  _domain_id uuid,
  _hosts jsonb,
  _stamp timestamptz,
  _total_returned integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fresh integer;
BEGIN
  fresh := public.ingest_subdomain_chunk(_domain_id, _hosts, _stamp);

  IF _scan_id IS NOT NULL THEN
    UPDATE public.scans
       SET new_count = new_count + coalesce(fresh, 0),
           total_returned = coalesce(_total_returned, total_returned)
     WHERE id = _scan_id;
  END IF;

  UPDATE public.domains
     SET new_subdomains_last_scan = coalesce(new_subdomains_last_scan, 0) + coalesce(fresh, 0),
         last_scanned_at = _stamp,
         claimed_at = _stamp,
         updated_at = _stamp
   WHERE id = _domain_id;

  RETURN coalesce(fresh, 0);
END;
$$;

-- Self-healing: recompute new_count from real first_seen_at data and close stuck scans.
CREATE OR REPLACE FUNCTION public.reconcile_scan_counts(_since timestamptz DEFAULT now() - interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed integer;
BEGIN
  -- Close scans that never got a terminal write.
  UPDATE public.scans
     SET status = 'success',
         finished_at = coalesce(finished_at, started_at + interval '1 minute')
   WHERE status = 'running'
     AND started_at < now() - interval '5 minutes';

  WITH candidates AS (
    SELECT s.id, s.domain_id, s.started_at,
           coalesce(s.finished_at, s.started_at + interval '5 minutes') AS ends_at
    FROM public.scans s
    WHERE s.started_at >= _since
      AND s.status <> 'error'
      AND s.new_count = 0
  ), counted AS (
    SELECT c.id, count(sub.id)::integer AS real_new
    FROM candidates c
    LEFT JOIN public.subdomains sub
      ON sub.domain_id = c.domain_id
     AND sub.first_seen_at >= c.started_at - interval '30 seconds'
     AND sub.first_seen_at <= c.ends_at + interval '5 minutes'
    GROUP BY c.id
  ), upd AS (
    UPDATE public.scans s
       SET new_count = counted.real_new
      FROM counted
     WHERE s.id = counted.id AND counted.real_new > 0
    RETURNING 1
  )
  SELECT count(*)::integer INTO fixed FROM upd;

  -- Keep domain rollups honest too.
  UPDATE public.domains d
     SET total_subdomains = agg.cnt
    FROM (
      SELECT domain_id, count(*)::integer AS cnt
      FROM public.subdomains
      GROUP BY domain_id
    ) agg
   WHERE d.id = agg.domain_id
     AND d.total_subdomains <> agg.cnt;

  RETURN coalesce(fixed, 0);
END;
$$;

-- Aggregated stats for the recent-subdomains page.
CREATE OR REPLACE FUNCTION public.recent_subs_overview(since timestamptz)
RETURNS TABLE(
  total_new bigint,
  programs_active bigint,
  domains_active bigint,
  latest_at timestamptz,
  per_hour numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(s.id)::bigint,
         count(DISTINCT d.platform_id)::bigint,
         count(DISTINCT d.id)::bigint,
         max(s.first_seen_at),
         round(count(s.id)::numeric / greatest(extract(epoch from (now() - since)) / 3600.0, 0.0166), 2)
  FROM public.subdomains s
  JOIN public.domains d ON d.id = s.domain_id
  WHERE s.first_seen_at >= since
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_scan_counts(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_chunk_with_scan(uuid, uuid, jsonb, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recent_subs_overview(timestamptz) TO anon, authenticated, service_role;
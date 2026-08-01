CREATE OR REPLACE FUNCTION public.reconcile_scan_counts(_since timestamptz DEFAULT now() - interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed integer;
  added integer;
BEGIN
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

  -- Discovery bursts with no scan row at all: synthesize one so history shows them.
  WITH bursts AS (
    SELECT sub.domain_id, sub.first_seen_at AS ts, count(*)::integer AS c
    FROM public.subdomains sub
    WHERE sub.first_seen_at >= _since
    GROUP BY 1, 2
  ), orphans AS (
    SELECT b.*
    FROM bursts b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.domain_id = b.domain_id
        AND b.ts BETWEEN s.started_at - interval '30 seconds'
                     AND coalesce(s.finished_at, s.started_at + interval '5 minutes') + interval '5 minutes'
    )
  ), ins AS (
    INSERT INTO public.scans (domain_id, trigger, status, started_at, finished_at, total_returned, new_count, removed_count)
    SELECT o.domain_id, 'cron', 'success', o.ts, o.ts,
           coalesce((SELECT d.total_subdomains FROM public.domains d WHERE d.id = o.domain_id), o.c),
           o.c, 0
    FROM orphans o
    RETURNING 1
  )
  SELECT count(*)::integer INTO added FROM ins;

  UPDATE public.domains d
     SET total_subdomains = agg.cnt
    FROM (
      SELECT domain_id, count(*)::integer AS cnt
      FROM public.subdomains
      GROUP BY domain_id
    ) agg
   WHERE d.id = agg.domain_id
     AND d.total_subdomains <> agg.cnt;

  RETURN coalesce(fixed, 0) + coalesce(added, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_scan_counts(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_scan_counts(timestamptz) TO service_role;
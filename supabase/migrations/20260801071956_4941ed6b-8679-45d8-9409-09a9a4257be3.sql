CREATE OR REPLACE FUNCTION public.domain_cycle_counts(cycle_minutes integer DEFAULT 120)
RETURNS TABLE(total_domains bigint, due_domains bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE enabled)::bigint,
    count(*) FILTER (
      WHERE enabled
        AND (claimed_at IS NULL
             OR claimed_at < now() - make_interval(mins => greatest(coalesce(cycle_minutes, 120), 1)))
    )::bigint
  FROM public.domains
$$;

CREATE OR REPLACE FUNCTION public.mark_all_domains_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.domains
     SET claimed_at = NULL, updated_at = now()
   WHERE enabled;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_domains_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_domains_due() TO service_role;
GRANT EXECUTE ON FUNCTION public.domain_cycle_counts(integer) TO anon, authenticated, service_role;
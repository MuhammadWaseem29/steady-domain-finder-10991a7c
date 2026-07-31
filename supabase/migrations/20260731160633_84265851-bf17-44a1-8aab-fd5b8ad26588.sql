CREATE OR REPLACE FUNCTION public.new_subdomain_counts()
RETURNS TABLE(last_hour bigint, last_day bigint, last_week bigint, last_month bigint, last_half_year bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE first_seen_at > now() - interval '1 hour')::bigint,
    count(*) FILTER (WHERE first_seen_at > now() - interval '1 day')::bigint,
    count(*) FILTER (WHERE first_seen_at > now() - interval '7 days')::bigint,
    count(*) FILTER (WHERE first_seen_at > now() - interval '30 days')::bigint,
    count(*) FILTER (WHERE first_seen_at > now() - interval '182 days')::bigint
  FROM public.subdomains
  WHERE first_seen_at > now() - interval '182 days'
$$;
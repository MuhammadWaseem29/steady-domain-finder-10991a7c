CREATE OR REPLACE FUNCTION public.bump_daily_stats(_new int, _errors int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.daily_stats (day, new_subdomains, scans_run, scan_errors)
  VALUES (current_date, greatest(_new,0), 1, greatest(_errors,0))
  ON CONFLICT (day) DO UPDATE SET
    new_subdomains = public.daily_stats.new_subdomains + greatest(_new,0),
    scans_run = public.daily_stats.scans_run + 1,
    scan_errors = public.daily_stats.scan_errors + greatest(_errors,0),
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.bump_daily_stats(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_daily_stats(int, int) TO service_role;
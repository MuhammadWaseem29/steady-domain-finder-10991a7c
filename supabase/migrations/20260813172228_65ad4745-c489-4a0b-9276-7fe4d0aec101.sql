REVOKE ALL ON FUNCTION public.api_rate_check(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_usage_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rate_check(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_usage_summary(uuid) TO service_role;
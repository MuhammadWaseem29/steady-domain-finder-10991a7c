ALTER FUNCTION public.discovery_timeseries(text, timestamptz) SECURITY INVOKER;
ALTER FUNCTION public.scan_timeseries(text, timestamptz) SECURITY INVOKER;
ALTER FUNCTION public.platform_stats() SECURITY INVOKER;
ALTER FUNCTION public.top_domains_by_new(timestamptz, integer) SECURITY INVOKER;
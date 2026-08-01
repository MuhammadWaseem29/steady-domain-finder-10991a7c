REVOKE EXECUTE ON FUNCTION public.ingest_chunk_with_scan(uuid, uuid, jsonb, timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_scan_counts(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_chunk_with_scan(uuid, uuid, jsonb, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_scan_counts(timestamptz) TO service_role;
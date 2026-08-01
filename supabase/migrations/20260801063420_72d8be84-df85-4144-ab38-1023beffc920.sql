CREATE POLICY "Service backend manages scan jobs"
ON public.scan_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
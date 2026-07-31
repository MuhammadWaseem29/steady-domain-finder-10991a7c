UPDATE public.scans SET status='error', finished_at=now(), error_message='scan run timed out' WHERE status='running' AND started_at < now() - interval '10 minutes';

SELECT cron.unschedule('chaos-rolling-scan');
SELECT cron.schedule(
  'chaos-rolling-scan',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://project--52925200-8fb8-442c-88e1-e747035fac35-dev.lovable.app/api/public/hooks/scan?limit=60&concurrency=6&budgetMs=40000',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=55000
  ) as request_id;
  $$
);
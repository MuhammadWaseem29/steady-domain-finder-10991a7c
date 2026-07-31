SELECT cron.unschedule('chaos-rolling-scan');
SELECT cron.schedule(
  'chaos-rolling-scan',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://project--52925200-8fb8-442c-88e1-e747035fac35-dev.lovable.app/api/public/hooks/scan?limit=200&concurrency=12&budgetMs=45000',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=55000
  ) as request_id;
  $$
);
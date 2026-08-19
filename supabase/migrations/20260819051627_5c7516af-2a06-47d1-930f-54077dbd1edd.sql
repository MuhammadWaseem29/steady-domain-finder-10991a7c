
select cron.alter_job(6, command := $j$
  select net.http_post(
    url:='https://project--52925200-8fb8-442c-88e1-e747035fac35-dev.lovable.app/api/public/hooks/scan?limit=400&concurrency=40&budgetMs=50000&cycleMinutes=120&jobBudgetMs=20000',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "3376618185f05018298ef9c7b8a0b9052de65772134dca07318747a6ce698456"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=55000
  ) as request_id;
$j$);

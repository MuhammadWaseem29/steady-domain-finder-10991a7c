select cron.unschedule('chaos-rolling-scan');

select cron.schedule(
  'chaos-rolling-scan',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://project--52925200-8fb8-442c-88e1-e747035fac35.lovable.app/api/public/hooks/scan?limit=300&concurrency=40&budgetMs=25000&cycleMinutes=120&jobBudgetMs=10000',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_2p-9tzQ_i-1myl2Wr1cC5Q_Y-BFvJDG", "x-cron-secret": "3376618185f05018298ef9c7b8a0b9052de65772134dca07318747a6ce698456"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=55000
  );
  $$
);
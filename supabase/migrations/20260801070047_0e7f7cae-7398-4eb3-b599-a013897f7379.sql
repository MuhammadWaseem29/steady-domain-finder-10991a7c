alter role service_role set statement_timeout = '55s';
alter role authenticated set statement_timeout = '20s';
alter role anon set statement_timeout = '20s';
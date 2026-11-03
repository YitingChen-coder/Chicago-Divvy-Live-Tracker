-- Run the divvy-sync worker every 30 seconds with Supabase Cron.
-- Divvy refreshes its feed about every 60 s (ttl: 60), so 30 s catches every
-- update within half a minute and uses ~86,400 of the 500,000 monthly
-- Edge Function calls on the free plan.
--
-- Needs two Vault secrets, created once outside of git:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random string>', 'worker_secret');
-- and the same worker_secret set as the function's WORKER_SECRET env var.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'divvy-sync-every-30s',
  '30 seconds',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/divvy-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Keep the runs table small: delete runs older than 3 days, once an hour.
select cron.schedule(
  'prune-worker-runs',
  '17 * * * *',
  $$ delete from public.worker_runs where finished_at < now() - interval '3 days' $$
);

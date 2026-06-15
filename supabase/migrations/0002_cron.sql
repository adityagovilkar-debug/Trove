-- Optional: schedule the daily expiry-digest email.
-- Run this AFTER deploying the `expiry-digest` Edge Function.
--
-- Replace <PROJECT_REF> with your Supabase project ref and <ANON_OR_CRON_KEY>
-- with a key allowed to invoke the function (the function uses --no-verify-jwt,
-- so any value works; using the anon key is fine).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 8:00 AM UTC daily. Adjust the cron expression to your timezone.
select cron.schedule(
  'larder-expiry-digest',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/expiry-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- To remove later:  select cron.unschedule('larder-expiry-digest');

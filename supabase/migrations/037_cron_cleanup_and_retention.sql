-- Fix Supabase Nano compute exhaustion
--
-- Root cause: cron.job_run_details has 73,000+ rows that were never purged.
-- Each UPDATE to that table takes ~8 seconds (full table scan, no retention).
-- auto_lock_matches was scheduled every 1 min instead of every 5 min,
-- tripling the write rate. Combined with 252k auth.getUser() calls (now fixed),
-- this exhausted the Nano compute tier.
--
-- NOTE: This migration must be applied via Supabase Dashboard > SQL Editor
-- because the cron schema requires superuser access.

-- Step 1: Purge the bloated history (keep last 200 rows for debugging)
DELETE FROM cron.job_run_details
WHERE runid NOT IN (
  SELECT runid FROM cron.job_run_details
  ORDER BY runid DESC
  LIMIT 200
);

-- Step 2: Fix auto-lock-matches schedule (*/1 → */5 min)
SELECT cron.unschedule('auto-lock-matches');
SELECT cron.schedule(
  'auto-lock-matches',
  '*/5 * * * *',
  'SELECT public.auto_lock_matches()'
);

-- Step 3: Schedule hourly cleanup so the table never bloats again
SELECT cron.unschedule('cleanup-cron-history');
SELECT cron.schedule(
  'cleanup-cron-history',
  '30 * * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '6 hours'$$
);

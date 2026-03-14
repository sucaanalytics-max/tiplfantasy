-- Enable pg_cron extension (must be done by superuser / dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to auto-lock upcoming matches when start_time has passed
CREATE OR REPLACE FUNCTION public.auto_lock_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE matches
  SET status = 'live', updated_at = NOW()
  WHERE status = 'upcoming'
    AND start_time <= NOW();
END;
$$;

-- Schedule: run every 5 minutes
-- NOTE: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- Then run this in the SQL editor:
-- SELECT cron.schedule(
--   'auto-lock-matches',
--   '*/5 * * * *',
--   'SELECT public.auto_lock_matches()'
-- );

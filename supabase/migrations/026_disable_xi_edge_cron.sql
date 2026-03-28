-- Disable the Supabase Edge Function cron for auto-fetch-playing-xi.
-- CricAPI blocks connections from Supabase Edge Function IPs (Connection reset by peer).
-- Playing XI is now fetched via Vercel cron route /api/cron/fetch-playing-xi instead.
SELECT cron.unschedule('auto-fetch-playing-xi');

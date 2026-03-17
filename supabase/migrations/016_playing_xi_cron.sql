-- Enable pg_net for HTTP calls from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Auto-fetch Playing XI for upcoming matches (runs every 3 minutes)
-- Calls the auto-fetch-playing-xi edge function which:
--   1. Finds matches starting within 60 minutes
--   2. Checks if toss has happened (via CricAPI match_info)
--   3. Only inserts if exactly 11 players per team (not full squad)
SELECT cron.schedule(
  'auto-fetch-playing-xi',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fnoipoyerylmotnttgso.supabase.co/functions/v1/auto-fetch-playing-xi',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZub2lwb3llcnlsbW90bnR0Z3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTYwNjQsImV4cCI6MjA4ODk5MjA2NH0.V2FWxufHwUQlpRJCUDX6fQolsWVZETlfDzji4D7r-Ow", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

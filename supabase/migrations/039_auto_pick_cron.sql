-- Auto-pick for newly-locked matches.
--
-- The Vercel cron at /api/cron/lock-and-autopick only runs at 10:00 and 14:00 UTC daily,
-- so any rescheduled match (e.g. rain delays) that locks outside those windows gets no
-- auto-pick. Move the trigger to pg_cron so it fires every minute — same cadence as
-- auto-lock-matches — and reliably picks up matches the moment they go live.
--
-- The auto-pick edge function:
--   - Finds matches locked in the last 10 minutes (or accepts a body.match_id)
--   - Auto-picks ALL users with no selection (not gated on auto_pick_enabled)
--   - Picks a randomized valid 11 from the Playing XI per user
--   - Inserts is_auto_pick=true, captain_id=null, vice_captain_id=null
--
-- Idempotent: skips users who already have a selection, so repeated runs are safe.

SELECT cron.schedule(
  'auto-pick-recently-locked',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fnoipoyerylmotnttgso.supabase.co/functions/v1/auto-pick',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZub2lwb3llcnlsbW90bnR0Z3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTYwNjQsImV4cCI6MjA4ODk5MjA2NH0.V2FWxufHwUQlpRJCUDX6fQolsWVZETlfDzji4D7r-Ow", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

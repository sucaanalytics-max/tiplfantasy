ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_relay_paused BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_matches_live_active
  ON matches (status)
  WHERE status = 'live' AND is_relay_paused = FALSE;

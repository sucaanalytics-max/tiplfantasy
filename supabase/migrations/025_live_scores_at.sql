-- Add live_scores_at to track when provisional points were last calculated
ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_scores_at TIMESTAMPTZ;

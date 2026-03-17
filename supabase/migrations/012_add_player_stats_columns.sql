-- ============================================================
-- Add IPL career stats columns to players table
-- These columns are referenced by TypeScript types and the
-- sync-player-stats edge function but were never created.
-- ============================================================

-- Howstat integration
ALTER TABLE players ADD COLUMN IF NOT EXISTS howstat_id INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_updated_at TIMESTAMPTZ;

-- Batting stats
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_matches INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_innings INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_runs INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_batting_avg NUMERIC;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_strike_rate NUMERIC;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_highest_score TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_fifties INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_hundreds INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_fours INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_sixes INTEGER;

-- Bowling stats
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_wickets INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_bowling_avg NUMERIC;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_economy NUMERIC;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_best_bowling TEXT;

-- Fielding
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_catches INTEGER;

-- Recent form (last 5 IPL innings scores)
ALTER TABLE players ADD COLUMN IF NOT EXISTS ipl_recent_scores INTEGER[];

-- Form indicator for quick display
ALTER TABLE players ADD COLUMN IF NOT EXISTS form_indicator TEXT DEFAULT 'neutral';

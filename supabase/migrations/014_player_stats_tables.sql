-- ============================================================
-- Rich player stats tables for season/venue/vs-team breakdowns
-- Populated via Cricsheet seed script + incremental edge function
-- ============================================================

-- Per-player, per-IPL-season aggregates
CREATE TABLE player_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  matches INTEGER DEFAULT 0,
  innings INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  fifties INTEGER DEFAULT 0,
  hundreds INTEGER DEFAULT 0,
  not_outs INTEGER DEFAULT 0,
  overs_bowled NUMERIC DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  catches INTEGER DEFAULT 0,
  stumpings INTEGER DEFAULT 0,
  run_outs INTEGER DEFAULT 0,
  UNIQUE(player_id, season)
);
CREATE INDEX idx_pss_player_season ON player_season_stats(player_id, season DESC);

-- Per-player, per-venue aggregates
CREATE TABLE player_venue_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  venue TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  overs_bowled NUMERIC DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  UNIQUE(player_id, venue)
);
CREATE INDEX idx_pvs_player ON player_venue_stats(player_id);

-- Per-player, per-opponent aggregates
CREATE TABLE player_vs_team_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  opponent_team TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  overs_bowled NUMERIC DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  UNIQUE(player_id, opponent_team)
);
CREATE INDEX idx_pvt_player ON player_vs_team_stats(player_id);

-- RLS: read-only for authenticated users
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_venue_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_vs_team_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read season stats" ON player_season_stats
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read venue stats" ON player_venue_stats
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read vs-team stats" ON player_vs_team_stats
  FOR SELECT USING (true);

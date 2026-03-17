-- Season Predictions: Purple Cap, Orange Cap, MVP
-- Users predict winners before Match 11 deadline

CREATE TABLE season_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('purple_cap', 'orange_cap', 'mvp')),
  player_id UUID NOT NULL REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX idx_season_predictions_user ON season_predictions(user_id);

-- RLS
ALTER TABLE season_predictions ENABLE ROW LEVEL SECURITY;

-- Everyone can read all predictions
CREATE POLICY "Anyone can view predictions"
  ON season_predictions FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own predictions
CREATE POLICY "Users can insert own predictions"
  ON season_predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own predictions
CREATE POLICY "Users can update own predictions"
  ON season_predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SQL function to get award standings from match_player_scores
CREATE OR REPLACE FUNCTION get_award_standings(p_category TEXT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  team_short_name TEXT,
  team_color TEXT,
  stat_value NUMERIC,
  matches_played BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_category = 'purple_cap' THEN
    RETURN QUERY
      SELECT
        mps.player_id,
        p.name AS player_name,
        t.short_name AS team_short_name,
        t.color AS team_color,
        SUM(mps.wickets)::NUMERIC AS stat_value,
        COUNT(DISTINCT mps.match_id) AS matches_played
      FROM match_player_scores mps
      JOIN players p ON p.id = mps.player_id
      JOIN teams t ON t.id = p.team_id
      GROUP BY mps.player_id, p.name, t.short_name, t.color
      HAVING SUM(mps.wickets) > 0
      ORDER BY stat_value DESC
      LIMIT p_limit;

  ELSIF p_category = 'orange_cap' THEN
    RETURN QUERY
      SELECT
        mps.player_id,
        p.name AS player_name,
        t.short_name AS team_short_name,
        t.color AS team_color,
        SUM(mps.runs)::NUMERIC AS stat_value,
        COUNT(DISTINCT mps.match_id) AS matches_played
      FROM match_player_scores mps
      JOIN players p ON p.id = mps.player_id
      JOIN teams t ON t.id = p.team_id
      GROUP BY mps.player_id, p.name, t.short_name, t.color
      HAVING SUM(mps.runs) > 0
      ORDER BY stat_value DESC
      LIMIT p_limit;

  ELSIF p_category = 'mvp' THEN
    RETURN QUERY
      SELECT
        mps.player_id,
        p.name AS player_name,
        t.short_name AS team_short_name,
        t.color AS team_color,
        SUM(mps.fantasy_points)::NUMERIC AS stat_value,
        COUNT(DISTINCT mps.match_id) AS matches_played
      FROM match_player_scores mps
      JOIN players p ON p.id = mps.player_id
      JOIN teams t ON t.id = p.team_id
      GROUP BY mps.player_id, p.name, t.short_name, t.color
      HAVING SUM(mps.fantasy_points) > 0
      ORDER BY stat_value DESC
      LIMIT p_limit;
  END IF;
END;
$$;

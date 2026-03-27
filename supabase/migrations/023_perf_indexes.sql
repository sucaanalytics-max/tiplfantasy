-- Performance: index selection_players(selection_id) for batch scoring fetches
CREATE INDEX IF NOT EXISTS idx_selection_players_selection ON selection_players(selection_id);

-- Performance: composite index on h2h_challenges(match_id, status) for dual-filter queries
CREATE INDEX IF NOT EXISTS idx_h2h_match_status ON h2h_challenges(match_id, status);

-- Performance: composite index on user_match_scores(match_id, user_id) for scoring + leaderboard
CREATE INDEX IF NOT EXISTS idx_ums_match_user ON user_match_scores(match_id, user_id);

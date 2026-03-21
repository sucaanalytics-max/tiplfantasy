-- Performance index for get_league_leaderboard and get_league_awards
-- Both RPCs join user_match_scores on user_id; without this index Postgres
-- falls back to a sequential scan over the entire table per league member.
CREATE INDEX IF NOT EXISTS idx_ums_user ON user_match_scores(user_id);

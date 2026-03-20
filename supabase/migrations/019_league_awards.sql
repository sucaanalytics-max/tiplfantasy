-- League awards: per-member season stats scoped to league members
-- Computes within-league rankings per match using window functions

CREATE OR REPLACE FUNCTION get_league_awards(p_league_id UUID)
RETURNS TABLE (
  user_id              UUID,
  display_name         TEXT,
  highest_score        NUMERIC,
  matchday_wins        BIGINT,
  total_captain_points NUMERIC,
  outside_top4         BIGINT,
  matches_played       BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH league_match_scores AS (
    SELECT
      ums.user_id,
      p.display_name,
      ums.match_id,
      ums.total_points,
      ums.captain_points,
      RANK() OVER (PARTITION BY ums.match_id ORDER BY ums.total_points DESC) AS league_rank
    FROM user_match_scores ums
    JOIN league_members lm ON lm.user_id = ums.user_id AND lm.league_id = p_league_id
    JOIN profiles p ON p.id = ums.user_id
  )
  SELECT
    user_id,
    display_name,
    MAX(total_points)                               AS highest_score,
    COUNT(*) FILTER (WHERE league_rank = 1)         AS matchday_wins,
    COALESCE(SUM(captain_points), 0)                AS total_captain_points,
    COUNT(*) FILTER (WHERE league_rank > 4)         AS outside_top4,
    COUNT(*)                                        AS matches_played
  FROM league_match_scores
  GROUP BY user_id, display_name;
$$;

-- Fix get_league_awards: DENSE_RANK → RANK for top2_finishes
-- DENSE_RANK gives rank 2 to the player after a tie-for-1st, incorrectly counting them as top-2.
-- RANK gives rank 3 in that case, which is correct.
-- matchday_wins (league_rank = 1) is unaffected — tied players still both get rank 1.

CREATE OR REPLACE FUNCTION get_league_awards(p_league_id UUID)
RETURNS TABLE (
  user_id              UUID,
  display_name         TEXT,
  highest_score        NUMERIC,
  matchday_wins        BIGINT,
  top2_finishes        BIGINT,
  total_captain_points NUMERIC,
  matches_played       BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH league_scores AS (
    SELECT
      ums.user_id,
      p.display_name,
      ums.match_id,
      ums.total_points,
      ums.captain_points,
      ums.vc_points,
      RANK() OVER (PARTITION BY ums.match_id ORDER BY ums.total_points DESC) AS league_rank
    FROM user_match_scores ums
    JOIN league_members lm ON lm.user_id = ums.user_id AND lm.league_id = p_league_id
    JOIN profiles p ON p.id = ums.user_id
    JOIN matches m ON m.id = ums.match_id
    WHERE m.status IN ('completed', 'no_result')
  )
  SELECT
    user_id,
    display_name,
    MAX(total_points)                                   AS highest_score,
    COUNT(*) FILTER (WHERE league_rank = 1)             AS matchday_wins,
    COUNT(*) FILTER (WHERE league_rank <= 2)            AS top2_finishes,
    COALESCE(SUM(captain_points + vc_points), 0)        AS total_captain_points,
    COUNT(*)                                            AS matches_played
  FROM league_scores
  GROUP BY user_id, display_name;
$$;

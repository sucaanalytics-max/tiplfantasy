-- Fix top-2 consistency count: DENSE_RANK gave Anup league_rank=2 when two
-- players tied for 1st, making him appear in top-2 when he was 3rd.
-- RANK() skips rank 2 on a tie (1,1,3,...) which matches the intended logic.
DROP FUNCTION IF EXISTS get_league_match_scores(uuid);
CREATE OR REPLACE FUNCTION get_league_match_scores(p_league_id UUID)
RETURNS TABLE (
  match_id             UUID,
  match_number         INT,
  start_time           TIMESTAMPTZ,
  user_id              UUID,
  display_name         TEXT,
  total_points         NUMERIC,
  league_rank          BIGINT,
  match_winners_count  BIGINT,
  captain_points       NUMERIC,
  vc_points            NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH league_scores AS (
    SELECT
      m.id            AS match_id,
      m.match_number,
      m.start_time,
      ums.user_id,
      p.display_name,
      ums.total_points,
      ums.captain_points,
      ums.vc_points,
      RANK() OVER (PARTITION BY ums.match_id ORDER BY ums.total_points DESC) AS league_rank
    FROM user_match_scores ums
    JOIN league_members lm ON lm.user_id = ums.user_id AND lm.league_id = p_league_id
    JOIN profiles p ON p.id = ums.user_id
    JOIN matches m ON m.id = ums.match_id
    WHERE m.status IN ('completed', 'no_result')
  ),
  winner_counts AS (
    SELECT match_id, COUNT(*) AS winners_count
    FROM league_scores
    WHERE league_rank = 1
    GROUP BY match_id
  )
  SELECT
    ls.match_id,
    ls.match_number,
    ls.start_time,
    ls.user_id,
    ls.display_name,
    ls.total_points,
    ls.league_rank,
    wc.winners_count AS match_winners_count,
    ls.captain_points,
    ls.vc_points
  FROM league_scores ls
  JOIN winner_counts wc ON wc.match_id = ls.match_id
  ORDER BY ls.match_number DESC, ls.league_rank ASC;
$$;

-- Fix get_league_awards:
--   1. Filter to completed/no_result matches (was missing, counted all statuses)
--   2. Use DENSE_RANK() instead of RANK() (ties share the same rank)
--   3. Replace outside_top4 with top2_finishes
--   4. Sum captain_points + vc_points (was only captain_points)
-- Add get_league_match_scores: per-match per-member rows with league-scoped rank

-- Drop first since return type changed (outside_top4 → top2_finishes)
DROP FUNCTION IF EXISTS get_league_awards(UUID);

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
      DENSE_RANK() OVER (PARTITION BY ums.match_id ORDER BY ums.total_points DESC) AS league_rank
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

CREATE OR REPLACE FUNCTION get_league_match_scores(p_league_id UUID)
RETURNS TABLE (
  match_id             UUID,
  match_number         INT,
  start_time           TIMESTAMPTZ,
  user_id              UUID,
  display_name         TEXT,
  total_points         NUMERIC,
  league_rank          BIGINT,
  match_winners_count  BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH league_scores AS (
    SELECT
      m.id            AS match_id,
      m.match_number,
      m.start_time,
      ums.user_id,
      p.display_name,
      ums.total_points,
      DENSE_RANK() OVER (PARTITION BY ums.match_id ORDER BY ums.total_points DESC) AS league_rank
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
    wc.winners_count AS match_winners_count
  FROM league_scores ls
  JOIN winner_counts wc ON wc.match_id = ls.match_id
  ORDER BY ls.match_number DESC, ls.league_rank ASC;
$$;

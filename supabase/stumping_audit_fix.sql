-- ============================================================================
-- Stumping audit correction — bulk converts misclassified stumpings to catches
-- ============================================================================
-- Background: the WK auto-stumping heuristic in src/lib/api/sportmonks.ts
-- (now removed) misclassified every catch-behind by a wicketkeeper as a
-- stumping. Audit found 83 stumpings in the DB; only 3 are real:
--   * Match 28 — Dhruv Jurel stumped Cameron Green off Bishnoi
--   * Match 37 — Sanju Samson stumped Shubman Gill off Noor Ahmad
--   * Match 48 — KL Rahul stumped Urvil Patel off Axar Patel
--
-- This script:
--   1. Snapshots the current state for safety.
--   2. Bulk-converts misclassified stumpings → catches and recomputes
--      fantasy_points + breakdown JSON (handles three_catch_bonus).
--   3. Partial-fixes the match 28 Jurel row (2 stumpings → 1 stumping + 1 catch).
--   4. Recomputes user_match_scores and ranks for every affected match.
--   5. Refreshes the season leaderboard.
--
-- Run this in Supabase Studio's SQL editor as a single transaction.
-- It is reversible from the snapshot tables created in step 1.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Snapshot current state (drop existing snapshots if rerunning)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _stumping_audit_pre_match_player_scores;
DROP TABLE IF EXISTS _stumping_audit_pre_user_match_scores;

CREATE TABLE _stumping_audit_pre_match_player_scores AS
SELECT * FROM match_player_scores
WHERE match_id IN (
  SELECT DISTINCT match_id FROM match_player_scores WHERE stumpings > 0
);

CREATE TABLE _stumping_audit_pre_user_match_scores AS
SELECT * FROM user_match_scores
WHERE match_id IN (
  SELECT DISTINCT match_id FROM match_player_scores WHERE stumpings > 0
);

-- ---------------------------------------------------------------------------
-- Step 2: Bulk-convert misclassified stumpings → catches.
--
-- Excludes the 3 real-stumping rows. For each affected row:
--   * catches := catches + stumpings
--   * stumpings := 0
--   * breakdown: drop "stumping" key, set "catch" to (catches+stumpings)*10,
--                add "three_catch_bonus":10 if total catches >= 3 and not present
--   * fantasy_points := sum of all values in the new breakdown
-- ---------------------------------------------------------------------------
WITH affected AS (
  SELECT
    mps.id,
    mps.catches + mps.stumpings AS new_catches,
    -- Build the new breakdown: remove stumping, set catch, add three_catch_bonus if eligible
    (
      (mps.breakdown - 'stumping')
      || jsonb_build_object('catch', (mps.catches + mps.stumpings) * 10)
      || CASE
           WHEN (mps.catches + mps.stumpings) >= 3
                AND NOT (mps.breakdown ? 'three_catch_bonus')
           THEN jsonb_build_object('three_catch_bonus', 10)
           ELSE '{}'::jsonb
         END
    ) AS new_breakdown
  FROM match_player_scores mps
  WHERE mps.stumpings > 0
    -- Exclude confirmed real stumpings
    AND mps.id NOT IN (
      '5e8ab75c-a3cf-49b4-81e5-b9547e23bca8', -- Match 48 KL Rahul
      '6dab2347-386a-41f2-b419-6cb0c9a29380', -- Match 28 Jurel (handled separately below)
      'e50fdc0e-e94b-404b-85ff-940d62d047a3'  -- Match 37 Samson
    )
),
recomputed AS (
  SELECT
    a.id,
    a.new_catches,
    a.new_breakdown,
    (SELECT SUM((value)::numeric)
     FROM jsonb_each_text(a.new_breakdown)) AS new_fp
  FROM affected a
)
UPDATE match_player_scores m
SET catches = r.new_catches,
    stumpings = 0,
    breakdown = r.new_breakdown,
    fantasy_points = r.new_fp
FROM recomputed r
WHERE m.id = r.id;

-- ---------------------------------------------------------------------------
-- Step 3: Partial fix for Match 28 Dhruv Jurel.
-- DB had stumpings=2; reality is 1 stumping (Cameron Green off Bishnoi)
-- + 1 catch (Ajinkya Rahane c Jurel b Burger).
-- Net: stumpings 2→1, catches 0→1, fp -5.
-- ---------------------------------------------------------------------------
UPDATE match_player_scores
SET catches = 1,
    stumpings = 1,
    breakdown = jsonb_set(
                  jsonb_set(breakdown, '{stumping}', '15'::jsonb, true),
                  '{catch}', '10'::jsonb, true
                ),
    fantasy_points = fantasy_points - 5
WHERE id = '6dab2347-386a-41f2-b419-6cb0c9a29380';

-- ---------------------------------------------------------------------------
-- Step 4: Recompute user_match_scores for every affected match.
--
-- For each match where any match_player_scores row was modified,
-- re-derive every user's total_points, captain_points, vc_points, rank
-- from the updated player scores. Mirrors recalculateUserMatchScores
-- in src/actions/scoring.ts:326.
-- ---------------------------------------------------------------------------
WITH affected_matches AS (
  -- All matches that had stumping conversions (excluding match 48 which had no changes).
  SELECT DISTINCT mps.match_id
  FROM match_player_scores mps
  WHERE mps.match_id IN (
    SELECT DISTINCT match_id
    FROM _stumping_audit_pre_match_player_scores
    WHERE stumpings > 0
  )
  -- Match 48 had only the KL Rahul row (real stumping, untouched). Skip it.
  AND mps.match_id NOT IN (
    SELECT match_id FROM matches WHERE match_number = 48
  )
),
ps AS (
  SELECT mps.match_id, mps.player_id, mps.fantasy_points::numeric AS fp
  FROM match_player_scores mps
  WHERE mps.match_id IN (SELECT match_id FROM affected_matches)
),
sel AS (
  SELECT s.match_id, s.id AS sel_id, s.user_id, s.captain_id, s.vice_captain_id, s.is_auto_pick
  FROM selections s
  WHERE s.match_id IN (SELECT match_id FROM affected_matches)
),
tots AS (
  SELECT
    s.match_id,
    s.user_id,
    SUM(CASE
          WHEN NOT s.is_auto_pick AND sp.player_id = s.captain_id THEN ps.fp * 2
          WHEN NOT s.is_auto_pick AND sp.player_id = s.vice_captain_id THEN ps.fp * 1.5
          ELSE ps.fp
        END) AS total,
    SUM(CASE
          WHEN NOT s.is_auto_pick AND sp.player_id = s.captain_id THEN ps.fp
          ELSE 0
        END) AS cpts,
    SUM(CASE
          WHEN NOT s.is_auto_pick AND sp.player_id = s.vice_captain_id THEN ps.fp * 0.5
          ELSE 0
        END) AS vcpts
  FROM sel s
  JOIN selection_players sp ON sp.selection_id = s.sel_id
  JOIN ps ON ps.player_id = sp.player_id AND ps.match_id = s.match_id
  GROUP BY s.match_id, s.user_id
),
ranked AS (
  SELECT
    t.*,
    RANK() OVER (PARTITION BY t.match_id ORDER BY t.total DESC) AS rk
  FROM tots t
)
UPDATE user_match_scores ums
SET total_points = ROUND(r.total),
    captain_points = ROUND(r.cpts),
    vc_points = ROUND(r.vcpts),
    rank = r.rk
FROM ranked r
WHERE ums.match_id = r.match_id
  AND ums.user_id = r.user_id;

-- ---------------------------------------------------------------------------
-- Step 5: Refresh season leaderboard
-- ---------------------------------------------------------------------------
SELECT refresh_leaderboard();

-- ---------------------------------------------------------------------------
-- Verification queries (run these after committing to sanity-check)
-- ---------------------------------------------------------------------------
-- Total stumpings should drop from 83 to 4 (3 real + 1 partial=Jurel).
-- (Match 28 Jurel keeps 1, match 37 Samson keeps 1, match 48 Rahul keeps 1.)
SELECT 'TOTAL STUMPINGS AFTER FIX' AS check, SUM(stumpings) FROM match_player_scores;

-- The 3 real stumping rows should be intact:
SELECT m.match_number, p.name, mps.catches, mps.stumpings, mps.fantasy_points, mps.breakdown
FROM match_player_scores mps
JOIN matches m ON m.id = mps.match_id
JOIN players p ON p.id = mps.player_id
WHERE mps.id IN (
  '5e8ab75c-a3cf-49b4-81e5-b9547e23bca8', -- match 48 KL Rahul: 1 stumping, 0 catches (unchanged)
  '6dab2347-386a-41f2-b419-6cb0c9a29380', -- match 28 Jurel: 1 stumping, 1 catch (partial fix)
  'e50fdc0e-e94b-404b-85ff-940d62d047a3'  -- match 37 Samson: 1 stumping, 0 catches (unchanged)
)
ORDER BY m.match_number;

-- Spot-check the highest-stake matches to confirm conversion worked:
SELECT m.match_number, p.name, mps.catches, mps.stumpings, mps.fantasy_points, mps.breakdown
FROM match_player_scores mps
JOIN matches m ON m.id = mps.match_id
JOIN players p ON p.id = mps.player_id
WHERE m.match_number IN (10, 25, 32, 38, 39, 46)
  AND p.role = 'WK'
ORDER BY m.match_number, p.name;

-- Inspect any user_match_scores changes (compare to snapshot):
-- SELECT u.display_name, m.match_number,
--        old.total_points AS old_total, new.total_points AS new_total,
--        new.total_points - old.total_points AS delta,
--        old.rank AS old_rank, new.rank AS new_rank
-- FROM _stumping_audit_pre_user_match_scores old
-- JOIN user_match_scores new
--   ON new.match_id = old.match_id AND new.user_id = old.user_id
-- JOIN profiles u ON u.id = new.user_id
-- JOIN matches m ON m.id = new.match_id
-- WHERE old.total_points <> new.total_points
-- ORDER BY m.match_number, ABS(new.total_points - old.total_points) DESC;

-- ============================================================================
-- COMMIT to apply, ROLLBACK to discard if anything looks off.
-- ============================================================================
COMMIT;

-- ============================================================================
-- Rollback recipe (run this manually if needed):
-- ============================================================================
-- BEGIN;
--   UPDATE match_player_scores m
--   SET catches = old.catches,
--       stumpings = old.stumpings,
--       breakdown = old.breakdown,
--       fantasy_points = old.fantasy_points
--   FROM _stumping_audit_pre_match_player_scores old
--   WHERE m.id = old.id;
--
--   UPDATE user_match_scores u
--   SET total_points = old.total_points,
--       captain_points = old.captain_points,
--       vc_points = old.vc_points,
--       rank = old.rank
--   FROM _stumping_audit_pre_user_match_scores old
--   WHERE u.id = old.id;
--
--   SELECT refresh_leaderboard();
-- COMMIT;

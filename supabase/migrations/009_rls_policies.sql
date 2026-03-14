-- ============================================================
-- Row Level Security Policies
-- Run against your Supabase project via Dashboard SQL Editor
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE playing_xi ENABLE ROW LEVEL SECURITY;
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================

-- Everyone can read profiles (for leaderboard, display names)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profile insert handled by trigger on auth.users (not by app)

-- ============================================================
-- TEAMS (read-only for all authenticated users)
-- ============================================================

CREATE POLICY "teams_select_all" ON teams
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PLAYERS (read-only for all authenticated users)
-- ============================================================

CREATE POLICY "players_select_all" ON players
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- MATCHES (read-only for all authenticated users)
-- ============================================================

CREATE POLICY "matches_select_all" ON matches
  FOR SELECT TO authenticated USING (true);

-- Only admins can update matches (lock, set status, etc.)
CREATE POLICY "matches_update_admin" ON matches
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================================
-- PLAYING_XI (read-only for all authenticated users)
-- ============================================================

CREATE POLICY "playing_xi_select_all" ON playing_xi
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- SELECTIONS
-- Users can only see their own selections for upcoming matches.
-- Once a match is live/completed, all selections are visible
-- (so users can compare picks after lock).
-- ============================================================

CREATE POLICY "selections_select" ON selections
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = selections.match_id
      AND matches.status IN ('live', 'completed', 'no_result')
    )
  );

-- Users can insert their own selection
CREATE POLICY "selections_insert_own" ON selections
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
      AND matches.status = 'upcoming'
      AND matches.start_time > NOW()
    )
  );

-- Users can update their own selection (only for upcoming matches)
CREATE POLICY "selections_update_own" ON selections
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = selections.match_id
      AND matches.status = 'upcoming'
      AND matches.start_time > NOW()
    )
  )
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own selection (only for upcoming matches)
CREATE POLICY "selections_delete_own" ON selections
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = selections.match_id
      AND matches.status = 'upcoming'
    )
  );

-- ============================================================
-- SELECTION_PLAYERS
-- Same visibility rules as selections
-- ============================================================

CREATE POLICY "selection_players_select" ON selection_players
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM selections s
      WHERE s.id = selection_players.selection_id
      AND (
        s.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM matches m
          WHERE m.id = s.match_id
          AND m.status IN ('live', 'completed', 'no_result')
        )
      )
    )
  );

-- Users can insert their own selection_players
CREATE POLICY "selection_players_insert_own" ON selection_players
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM selections s
      WHERE s.id = selection_players.selection_id
      AND s.user_id = auth.uid()
    )
  );

-- Users can delete their own selection_players (for re-pick)
CREATE POLICY "selection_players_delete_own" ON selection_players
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM selections s
      WHERE s.id = selection_players.selection_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================
-- SCORING_RULES (read-only for all authenticated users)
-- ============================================================

CREATE POLICY "scoring_rules_select_all" ON scoring_rules
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- MATCH_PLAYER_SCORES
-- Visible only after match is completed/no_result
-- ============================================================

CREATE POLICY "match_player_scores_select" ON match_player_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_player_scores.match_id
      AND matches.status IN ('completed', 'no_result')
    )
  );

-- ============================================================
-- USER_MATCH_SCORES
-- Visible only after match is completed/no_result
-- ============================================================

CREATE POLICY "user_match_scores_select" ON user_match_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = user_match_scores.match_id
      AND matches.status IN ('completed', 'no_result')
    )
  );

-- ============================================================
-- ADMIN_LOGS (only admins can read)
-- ============================================================

CREATE POLICY "admin_logs_select_admin" ON admin_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_logs_insert_admin" ON admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================================
-- NOTIFICATIONS (users can only see their own)
-- ============================================================

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SEASON_LEADERBOARD (materialized view — no RLS needed,
-- but if it's a regular view, make it readable)
-- ============================================================
-- Note: Materialized views don't support RLS. Access is
-- controlled by the underlying table policies and the
-- refresh_leaderboard() RPC which uses SECURITY DEFINER.

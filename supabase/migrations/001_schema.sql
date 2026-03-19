-- ============================================================
-- TIPL Fantasy Cricket — Complete Database Schema
-- ============================================================

-- Custom types
CREATE TYPE player_role AS ENUM ('WK', 'BAT', 'AR', 'BOWL');
CREATE TYPE match_status AS ENUM ('upcoming', 'live', 'completed', 'no_result', 'abandoned');
CREATE TYPE scoring_category AS ENUM ('batting', 'bowling', 'fielding', 'bonus', 'penalty');
CREATE TYPE notification_type AS ENUM ('match_reminder', 'scores_published', 'admin', 'system');

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_admin, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role player_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  cricapi_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_role ON players(role);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number INTEGER NOT NULL UNIQUE,
  team_home_id UUID NOT NULL REFERENCES teams(id),
  team_away_id UUID NOT NULL REFERENCES teams(id),
  venue TEXT NOT NULL DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  status match_status NOT NULL DEFAULT 'upcoming',
  cricapi_match_id TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_start ON matches(start_time);

-- ============================================================
-- PLAYING_XI
-- ============================================================
CREATE TABLE playing_xi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  announced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- ============================================================
-- SELECTIONS
-- ============================================================
CREATE TABLE selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  captain_id UUID REFERENCES players(id),
  vice_captain_id UUID REFERENCES players(id),
  is_auto_pick BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

CREATE INDEX idx_selections_match ON selections(match_id);
CREATE INDEX idx_selections_user ON selections(user_id);

-- ============================================================
-- SELECTION_PLAYERS (join table)
-- ============================================================
CREATE TABLE selection_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES selections(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(selection_id, player_id)
);

-- ============================================================
-- SCORING_RULES
-- ============================================================
CREATE TABLE scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category scoring_category NOT NULL,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MATCH_PLAYER_SCORES
-- ============================================================
CREATE TABLE match_player_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  runs INTEGER NOT NULL DEFAULT 0,
  balls_faced INTEGER NOT NULL DEFAULT 0,
  fours INTEGER NOT NULL DEFAULT 0,
  sixes INTEGER NOT NULL DEFAULT 0,
  wickets INTEGER NOT NULL DEFAULT 0,
  overs_bowled NUMERIC NOT NULL DEFAULT 0,
  runs_conceded INTEGER NOT NULL DEFAULT 0,
  maidens INTEGER NOT NULL DEFAULT 0,
  catches INTEGER NOT NULL DEFAULT 0,
  stumpings INTEGER NOT NULL DEFAULT 0,
  run_outs INTEGER NOT NULL DEFAULT 0,
  fantasy_points NUMERIC NOT NULL DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- ============================================================
-- USER_MATCH_SCORES
-- ============================================================
CREATE TABLE user_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  total_points NUMERIC NOT NULL DEFAULT 0,
  rank INTEGER,
  captain_points NUMERIC NOT NULL DEFAULT 0,
  vc_points NUMERIC NOT NULL DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- ============================================================
-- ADMIN_LOGS
-- ============================================================
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  type notification_type NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================================
-- SEASON_LEADERBOARD (materialized view)
-- ============================================================
CREATE MATERIALIZED VIEW season_leaderboard AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(ums.total_points), 0) AS total_points,
  COUNT(ums.id) AS matches_played,
  CASE WHEN COUNT(ums.id) > 0
    THEN ROUND(SUM(ums.total_points) / COUNT(ums.id), 1)
    ELSE 0
  END AS avg_points,
  COUNT(CASE WHEN ums.rank = 1 THEN 1 END) AS first_place_count,
  COUNT(CASE WHEN ums.rank <= 3 THEN 1 END) AS podium_count,
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ums.total_points), 0) DESC) AS season_rank
FROM profiles p
LEFT JOIN user_match_scores ums ON ums.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url;

CREATE UNIQUE INDEX idx_leaderboard_user ON season_leaderboard(user_id);

-- RPC to refresh the leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY season_leaderboard;
END;
$$;

-- Initial refresh
REFRESH MATERIALIZED VIEW season_leaderboard;

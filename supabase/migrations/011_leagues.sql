-- Leagues: social groupings for comparing fantasy scores among friends
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  creator_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE INDEX idx_league_members_user ON league_members(user_id);
CREATE INDEX idx_league_members_league ON league_members(league_id);

-- RLS
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- Leagues: members can read, anyone can create, creator can delete
CREATE POLICY "leagues_select" ON leagues FOR SELECT TO authenticated
  USING (id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()));
CREATE POLICY "leagues_insert" ON leagues FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "leagues_delete" ON leagues FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- Members: see co-members, join/leave self
CREATE POLICY "members_select" ON league_members FOR SELECT TO authenticated
  USING (league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()));
CREATE POLICY "members_insert" ON league_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_delete" ON league_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- League leaderboard function
CREATE OR REPLACE FUNCTION get_league_leaderboard(p_league_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  total_points NUMERIC,
  matches_played BIGINT,
  avg_points NUMERIC,
  season_rank BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    COALESCE(SUM(ums.total_points), 0),
    COUNT(ums.id),
    CASE WHEN COUNT(ums.id) > 0
      THEN ROUND(SUM(ums.total_points) / COUNT(ums.id), 1)
      ELSE 0
    END,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ums.total_points), 0) DESC)
  FROM league_members lm
  JOIN profiles p ON p.id = lm.user_id
  LEFT JOIN user_match_scores ums ON ums.user_id = p.id
  WHERE lm.league_id = p_league_id
  GROUP BY p.id, p.display_name, p.avatar_url;
$$;

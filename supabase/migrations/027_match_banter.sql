CREATE TABLE match_banter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_match_banter_match ON match_banter(match_id, created_at DESC);

-- Prevent duplicate banter for the same event in a single match
CREATE UNIQUE INDEX idx_match_banter_dedup ON match_banter(match_id, user_id, player_id, event_type);

-- RLS: anyone authenticated can read banter
ALTER TABLE match_banter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read banter" ON match_banter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert banter" ON match_banter FOR INSERT TO service_role WITH CHECK (true);

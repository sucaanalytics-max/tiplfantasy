ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_pick_enabled BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN profiles.auto_pick_enabled IS 'If true, system auto-picks team within 2 min of match deadline if user has no selection.';

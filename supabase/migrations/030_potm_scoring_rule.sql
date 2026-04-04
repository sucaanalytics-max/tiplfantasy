-- Add Player of the Match bonus scoring rule (configurable, default 25 pts)
INSERT INTO scoring_rules (category, name, label, points)
VALUES ('bonus', 'potm', 'Player of the Match', 25);

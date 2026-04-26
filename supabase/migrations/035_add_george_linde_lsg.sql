-- Add George Linde to the LSG squad. He was missing from the IPL 2026
-- seed. Left-arm spinning all-rounder, profile aligns with LSG's other
-- AR slots.
--
-- Resolves the team via short_name rather than a hardcoded UUID so the
-- migration is portable across environments. Idempotent: re-running is
-- a no-op if the player already exists for LSG.
INSERT INTO players (name, team_id, role, is_active, credit_cost)
SELECT 'George Linde', t.id, 'AR', true, 7.5
FROM teams t
WHERE t.short_name = 'LSG'
  AND NOT EXISTS (
    SELECT 1 FROM players p
    WHERE p.name = 'George Linde' AND p.team_id = t.id
  );

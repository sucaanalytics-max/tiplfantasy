-- Add Dasun Shanaka to the RR squad. He was in the SportMonks RR squad
-- (season 1795, player id 178, Allrounder) but missing from the IPL 2026 seed.
--
-- cricapi_id holds the SportMonks player id so live-score matching keys off
-- the id directly instead of falling back to fuzzy name matching.
--
-- Resolves the team via short_name rather than a hardcoded UUID so the
-- migration is portable across environments. Idempotent: re-running is
-- a no-op if the player already exists for RR.
INSERT INTO players (name, team_id, role, is_active, cricapi_id, credit_cost)
SELECT 'Dasun Shanaka', t.id, 'AR', true, '178', 9
FROM teams t
WHERE t.short_name = 'RR'
  AND NOT EXISTS (
    SELECT 1 FROM players p
    WHERE p.name = 'Dasun Shanaka' AND p.team_id = t.id
  );

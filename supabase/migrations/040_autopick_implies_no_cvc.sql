-- Enforce: rows flagged is_auto_pick=true must have NULL captain/vice-captain.
-- An admin manually setting captain/VC should flip is_auto_pick to false
-- (see adminUpdateCaptainVc). Without this constraint, the scoring engine
-- silently drops C/VC bonuses for the affected user.

ALTER TABLE selections
  ADD CONSTRAINT autopick_implies_no_cvc
  CHECK (NOT (is_auto_pick = true AND (captain_id IS NOT NULL OR vice_captain_id IS NOT NULL)));

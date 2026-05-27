-- Add bio columns sourced from the SportMonks squad endpoint
-- (teams/{id}/squad/{season_id}). The SportMonks player id continues to live
-- in players.cricapi_id (see migration 041 and the live-score route, which keys
-- man_of_match_id off cricapi_id), so no separate sportmonks_id column is added.
--
-- date_of_birth: SportMonks `dateofbirth` (YYYY-MM-DD)
-- batting_style: SportMonks `battingstyle` (raw, e.g. 'right-hand-bat')

ALTER TABLE players ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS batting_style TEXT;

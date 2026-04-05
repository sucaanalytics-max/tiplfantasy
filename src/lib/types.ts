// Database types matching Supabase schema

export type PlayerRole = "WK" | "BAT" | "AR" | "BOWL"

export type MatchStatus = "upcoming" | "live" | "completed" | "no_result" | "abandoned"

export type ScoringCategory = "batting" | "bowling" | "fielding" | "bonus" | "penalty"

export type NotificationType = "match_reminder" | "scores_published" | "admin" | "system"

// ============================================================
// Table row types
// ============================================================

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export type Team = {
  id: string
  name: string
  short_name: string
  color: string
  logo_url: string | null
  created_at: string
}

export type Player = {
  id: string
  name: string
  team_id: string
  role: PlayerRole
  is_active: boolean
  cricapi_id: string | null
  credit_cost: number
  created_at: string
  // IPL Career Stats
  ipl_matches: number | null
  ipl_innings: number | null
  ipl_runs: number | null
  ipl_batting_avg: number | null
  ipl_strike_rate: number | null
  ipl_highest_score: string | null
  ipl_fifties: number | null
  ipl_hundreds: number | null
  ipl_fours: number | null
  ipl_sixes: number | null
  ipl_wickets: number | null
  ipl_bowling_avg: number | null
  ipl_economy: number | null
  ipl_best_bowling: string | null
  ipl_catches: number | null
  ipl_recent_scores: number[] | null
  howstat_id: number | null
  stats_updated_at: string | null
  form_indicator: string | null
  image_url: string | null
}

export type Match = {
  id: string
  match_number: number
  team_home_id: string
  team_away_id: string
  venue: string
  start_time: string
  status: MatchStatus
  cricapi_match_id: string | null
  result_summary: string | null
  created_at: string
  updated_at: string
}

export type PlayingXI = {
  id: string
  match_id: string
  player_id: string
  team_id: string
  announced_at: string
}

export type Selection = {
  id: string
  user_id: string
  match_id: string
  captain_id: string | null
  vice_captain_id: string | null
  is_auto_pick: boolean
  locked_at: string | null
  created_at: string
  updated_at: string
}

export type SelectionPlayer = {
  id: string
  selection_id: string
  player_id: string
}

export type ScoringRule = {
  id: string
  category: ScoringCategory
  name: string
  label: string
  points: number
  is_active: boolean
  created_at: string
}

export type MatchPlayerScore = {
  id: string
  match_id: string
  player_id: string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
  fantasy_points: number
  breakdown: Record<string, number> | null
  created_at: string
}

export type UserMatchScore = {
  id: string
  user_id: string
  match_id: string
  total_points: number
  rank: number | null
  captain_points: number
  vc_points: number
  breakdown: Record<string, number> | null
  created_at: string
}

export type AdminLog = {
  id: string
  admin_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  is_read: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

// ============================================================
// Rich stats table types (season/venue/vs-team breakdowns)
// ============================================================

export type PlayerSeasonStats = {
  id: string
  player_id: string
  season: number
  matches: number
  innings: number
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  highest_score: number
  fifties: number
  hundreds: number
  not_outs: number
  overs_bowled: number
  runs_conceded: number
  wickets: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
}

export type PlayerVenueStats = {
  id: string
  player_id: string
  venue: string
  matches: number
  runs: number
  balls_faced: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
}

export type PlayerVsTeamStats = {
  id: string
  player_id: string
  opponent_team: string
  matches: number
  runs: number
  balls_faced: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
}

// ============================================================
// View types
// ============================================================

export type LeaderboardEntry = {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_points: number
  matches_played: number
  avg_points: number
  first_place_count: number
  podium_count: number
  season_rank: number
}

// ============================================================
// Joined / enriched types (for UI)
// ============================================================

export type PlayerWithTeam = Player & {
  team: Team
}

export type MatchWithTeams = Match & {
  team_home: Team
  team_away: Team
}

export type SelectionWithPlayers = Selection & {
  players: PlayerWithTeam[]
  captain: Player | null
  vice_captain: Player | null
}

export type MatchPlayerScoreWithPlayer = MatchPlayerScore & {
  player: PlayerWithTeam
}

// ============================================================
// League types
// ============================================================

export type League = {
  id: string
  name: string
  invite_code: string
  creator_id: string
  created_at: string
}

export type LeagueMember = {
  id: string
  league_id: string
  user_id: string
  joined_at: string
}

export type LeagueWithMemberCount = League & {
  member_count: number
}

export type LeagueLeaderboardEntry = {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_points: number
  matches_played: number
  avg_points: number
  season_rank: number
}

export type LeagueMemberStats = {
  user_id: string
  display_name: string
  highest_score: number
  matchday_wins: number
  top2_finishes: number
  total_captain_points: number
  matches_played: number
}

export type LeagueMatchScore = {
  match_id: string
  match_number: number
  start_time: string
  user_id: string
  display_name: string
  total_points: number
  league_rank: number
  match_winners_count: number
  captain_points: number
  vc_points: number
}

// Season Predictions

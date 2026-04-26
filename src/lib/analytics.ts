// Pure statistical computation functions for the admin analytics dashboard.
// No database access — all functions take pre-fetched data as input.

import type { PlayerRole } from "./types"

// ============================================================
// Input types (raw data from DB queries)
// ============================================================

export type RawPlayerScore = {
  player_id: string
  match_id: string
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
}

export type RawSelection = {
  user_id: string
  match_id: string
  captain_id: string | null
  vice_captain_id: string | null
  is_auto_pick: boolean
  players: string[] // player_ids
}

export type RawUserMatchScore = {
  user_id: string
  match_id: string
  total_points: number
  rank: number | null
  captain_points: number
  vc_points: number
}

export type PlayerInfo = {
  id: string
  name: string
  role: PlayerRole
  team: string
  teamId: string
  color: string
  bowlingStyle?: "pace" | "spin" | "unknown" | null
}

export type RawVenueStat = {
  player_id: string
  venue: string
  matches: number
  runs: number
  balls_faced: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
}

export type RawVsTeamStat = {
  player_id: string
  opponent_team: string
  matches: number
  runs: number
  balls_faced: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
}

export type MatchInfo = {
  id: string
  matchNumber: number
  venue: string
  teamHomeId: string
  teamAwayId: string
  status: string
}

// ============================================================
// Output types
// ============================================================

export type PlayerMatchDetail = {
  matchNumber: number
  opponent: string
  venue: string
  fp: number
  batting: number
  bowling: number
  fielding: number
  penalty: number
}

export type PlayerAnalytics = {
  id: string
  name: string
  role: PlayerRole
  team: string
  color: string
  matches: number
  totalFP: number
  avgFP: number
  medianFP: number
  floor: number
  ceiling: number
  stddev: number
  cv: number // coefficient of variation
  formLast3: number
  formDelta: number // last3 - seasonAvg
  battingFP: number
  bowlingFP: number
  fieldingFP: number
  penaltyFP: number
  scores: number[] // chronological
  rollingAvg: number[] // rolling 3-match
  matchHistory: PlayerMatchDetail[] // per-match detail with opponent/venue/breakdown
}

export type PowerRating = {
  id: string
  name: string
  role: PlayerRole
  team: string
  color: string
  powerRating: number // 0-100
  formScore: number
  consistencyScore: number
  ceilingScore: number
  roleDeltaScore: number
  xfp: number | null
  ownershipPct: number
  valueRating: number
  volatility: "low" | "medium" | "high"
  avgFP: number
  matches: number
}

export type MatchPreviewPlayer = {
  id: string
  name: string
  role: PlayerRole
  team: string
  color: string
  seasonAvg: number
  formLast3: number
  venueAvg: number | null
  vsOpponentAvg: number | null
  xfp: number
  ownershipPct: number
  isDifferential: boolean
}

export type SuggestedTeam = {
  players: { id: string; name: string; role: PlayerRole; team: string; xfp: number }[]
  captainId: string
  vcId: string
  totalProjected: number
}

export type OptimalTeam = {
  matchId: string
  matchNumber: number
  players: { id: string; name: string; role: PlayerRole; fp: number }[]
  captainId: string
  vcId: string
  totalScore: number
}

export type OwnershipEntry = {
  id: string
  name: string
  role: PlayerRole
  team: string
  color: string
  timesPicked: number
  ownershipPct: number
  timesCaptained: number
  captainPct: number
  timesVC: number
  avgFPWhenPicked: number
}

export type CaptainROI = {
  id: string
  name: string
  role: PlayerRole
  team: string
  timesCaptained: number
  avgCaptainBonus: number
  bestCaptainGame: number
  worstCaptainGame: number
}

export type UserDQS = {
  userId: string
  displayName: string
  avgDQS: number
  bestDQS: number
  worstDQS: number
  matches: number
}

export type VenueAnalytics = {
  venue: string
  matches: number
  avgTotalFP: number
  avgBattingFP: number
  avgBowlingFP: number
  avgFieldingFP: number
  battingPct: number
  classification: "bat-friendly" | "bowl-friendly" | "balanced"
  bestRole: string
  topPerformer: string
  roleAvg: Record<string, number>
}

export type MatchScoringRow = {
  matchId: string
  matchNumber: number
  venue: string
  homeTeam: string
  awayTeam: string
  totalFP: number
  avgUserScore: number
  topUserScore: number
  topUserName: string
  highestPlayerFP: number
  highestPlayerName: string
}

export type PaceSpinVenueRow = {
  venue: string
  matches: number
  paceWickets: number
  spinWickets: number
  paceOvers: number
  spinOvers: number
  paceEconomy: number
  spinEconomy: number
  paceAvgFP: number
  spinAvgFP: number
  dominance: "pace" | "spin" | "balanced"
}

export type PaceSpinTeamRow = {
  team: string
  paceWicketsAgainst: number
  spinWicketsAgainst: number
  totalMatchesBatted: number
  vulnerability: "pace" | "spin" | "balanced"
}

// ============================================================
// Breakdown key categorization
// ============================================================

const BATTING_KEYS = new Set([
  "playing_xi_bonus", "run", "four_bonus", "six_bonus",
  "thirty", "half_century", "century",
  "sr_above_170", "sr_150_170",
])

const BOWLING_KEYS = new Set([
  "wicket", "maiden",
  "three_wicket_haul", "four_wicket_haul", "five_wicket_haul",
  "econ_below_5", "econ_5_6",
])

const FIELDING_KEYS = new Set([
  "catch", "stumping", "run_out", "three_catch_bonus",
])

const PENALTY_KEYS = new Set([
  "duck", "sr_below_70", "sr_70_80",
  "econ_10_11", "econ_above_11",
])

const categorizeBreakdown = (breakdown: Record<string, number> | null) => {
  let batting = 0, bowling = 0, fielding = 0, penalty = 0
  if (!breakdown) return { batting, bowling, fielding, penalty }
  for (const [key, val] of Object.entries(breakdown)) {
    if (BATTING_KEYS.has(key)) batting += val
    else if (BOWLING_KEYS.has(key)) bowling += val
    else if (FIELDING_KEYS.has(key)) fielding += val
    else if (PENALTY_KEYS.has(key)) penalty += val
    // potm bonus goes to batting bucket
    else if (key === "potm") batting += val
  }
  return { batting, bowling, fielding, penalty }
}

// ============================================================
// Math helpers
// ============================================================

const mean = (arr: number[]): number =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length

const median = (arr: number[]): number => {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const stddev = (arr: number[]): number => {
  if (arr.length <= 1) return 0
  const avg = mean(arr)
  const variance = arr.reduce((sum, x) => sum + (x - avg) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

const minMaxNormalize = (value: number, min: number, max: number): number => {
  if (max === min) return 50
  return ((value - min) / (max - min)) * 100
}

const rollingAverage = (arr: number[], window: number = 3): number[] =>
  arr.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = arr.slice(start, i + 1)
    return Math.round(mean(slice) * 10) / 10
  })

const round1 = (n: number): number => Math.round(n * 10) / 10
const round2 = (n: number): number => Math.round(n * 100) / 100

// ============================================================
// 1. Player Performance Stats
// ============================================================

export const computePlayerStats = (
  scores: RawPlayerScore[],
  playerMap: Map<string, PlayerInfo>,
  matchOrder: string[], // match IDs in chronological order
  matchInfos?: MatchInfo[],
  teamMap?: Map<string, string>,
): PlayerAnalytics[] => {
  // Group scores by player
  const byPlayer = new Map<string, RawPlayerScore[]>()
  for (const s of scores) {
    const arr = byPlayer.get(s.player_id) ?? []
    arr.push(s)
    byPlayer.set(s.player_id, arr)
  }

  // Build match index for chronological ordering
  const matchIndex = new Map(matchOrder.map((id, i) => [id, i]))

  // Build match detail lookup (opponent, venue, matchNumber)
  const matchDetailMap = new Map<string, { matchNumber: number; venue: string; homeId: string; awayId: string }>()
  if (matchInfos) {
    for (const m of matchInfos) {
      matchDetailMap.set(m.id, { matchNumber: m.matchNumber, venue: m.venue, homeId: m.teamHomeId, awayId: m.teamAwayId })
    }
  }

  const results: PlayerAnalytics[] = []

  for (const [playerId, playerScores] of byPlayer) {
    const info = playerMap.get(playerId)
    if (!info) continue

    // Sort chronologically by match order
    const sorted = [...playerScores].sort(
      (a, b) => (matchIndex.get(a.match_id) ?? 0) - (matchIndex.get(b.match_id) ?? 0)
    )

    const fps = sorted.map((s) => Number(s.fantasy_points))
    const n = fps.length
    if (n === 0) continue

    const avg = mean(fps)
    const sd = stddev(fps)
    const cv = avg > 0 ? round1((sd / avg) * 100) : 999

    // Category breakdowns (cumulative) + per-match history
    let battingFP = 0, bowlingFP = 0, fieldingFP = 0, penaltyFP = 0
    const matchHistory: PlayerMatchDetail[] = []
    for (const s of sorted) {
      const cat = categorizeBreakdown(s.breakdown)
      battingFP += cat.batting
      bowlingFP += cat.bowling
      fieldingFP += cat.fielding
      penaltyFP += cat.penalty

      const mDetail = matchDetailMap.get(s.match_id)
      if (mDetail && teamMap) {
        const opponentId = info.teamId === mDetail.homeId ? mDetail.awayId : mDetail.homeId
        matchHistory.push({
          matchNumber: mDetail.matchNumber,
          opponent: teamMap.get(opponentId) ?? "?",
          venue: mDetail.venue,
          fp: Number(s.fantasy_points),
          batting: cat.batting,
          bowling: cat.bowling,
          fielding: cat.fielding,
          penalty: cat.penalty,
        })
      }
    }

    const last3 = fps.slice(-3)
    const formLast3 = round1(mean(last3))

    results.push({
      id: playerId,
      name: info.name,
      role: info.role,
      team: info.team,
      color: info.color,
      matches: n,
      totalFP: round1(fps.reduce((a, b) => a + b, 0)),
      avgFP: round1(avg),
      medianFP: round1(median(fps)),
      floor: round1(Math.min(...fps)),
      ceiling: round1(Math.max(...fps)),
      stddev: round1(sd),
      cv,
      formLast3,
      formDelta: round1(formLast3 - avg),
      battingFP: round1(battingFP),
      bowlingFP: round1(bowlingFP),
      fieldingFP: round1(fieldingFP),
      penaltyFP: round1(penaltyFP),
      scores: fps,
      rollingAvg: rollingAverage(fps),
      matchHistory,
    })
  }

  return results
}

// ============================================================
// 2. Role Benchmarks
// ============================================================

export type RoleBenchmark = {
  role: PlayerRole
  playerCount: number
  avgFP: number
  medianFP: number
  bestPlayer: string
  bestAvg: number
  worstPlayer: string
  worstAvg: number
}

export const computeRoleBenchmarks = (stats: PlayerAnalytics[]): RoleBenchmark[] => {
  const roles: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]
  return roles.map((role) => {
    const rolePlayers = stats.filter((p) => p.role === role && p.matches >= 2)
    if (rolePlayers.length === 0) {
      return { role, playerCount: 0, avgFP: 0, medianFP: 0, bestPlayer: "—", bestAvg: 0, worstPlayer: "—", worstAvg: 0 }
    }
    const avgs = rolePlayers.map((p) => p.avgFP)
    const sorted = [...rolePlayers].sort((a, b) => b.avgFP - a.avgFP)
    return {
      role,
      playerCount: rolePlayers.length,
      avgFP: round1(mean(avgs)),
      medianFP: round1(median(avgs)),
      bestPlayer: sorted[0].name,
      bestAvg: sorted[0].avgFP,
      worstPlayer: sorted[sorted.length - 1].name,
      worstAvg: sorted[sorted.length - 1].avgFP,
    }
  })
}

// ============================================================
// 3. Power Ratings
// ============================================================

export const computePowerRatings = (
  stats: PlayerAnalytics[],
  roleBenchmarks: RoleBenchmark[],
  ownership: Map<string, { pct: number }>,
  minMatches: number = 3,
): PowerRating[] => {
  const qualifying = stats.filter((p) => p.matches >= minMatches)
  if (qualifying.length === 0) return []

  const roleAvgMap = new Map(roleBenchmarks.map((r) => [r.role, r.avgFP]))

  // Gather raw values for normalization
  const formValues = qualifying.map((p) => p.formLast3)
  const cvValues = qualifying.map((p) => 100 - p.cv) // invert CV
  const ceilingValues = qualifying.map((p) => p.ceiling)
  const roleDeltaValues = qualifying.map((p) => p.avgFP - (roleAvgMap.get(p.role) ?? 0))

  const formMin = Math.min(...formValues), formMax = Math.max(...formValues)
  const cvMin = Math.min(...cvValues), cvMax = Math.max(...cvValues)
  const ceilMin = Math.min(...ceilingValues), ceilMax = Math.max(...ceilingValues)
  const rdMin = Math.min(...roleDeltaValues), rdMax = Math.max(...roleDeltaValues)

  return qualifying.map((p) => {
    const formScore = round1(minMaxNormalize(p.formLast3, formMin, formMax))
    const consistencyScore = round1(minMaxNormalize(100 - p.cv, cvMin, cvMax))
    const ceilingScore = round1(minMaxNormalize(p.ceiling, ceilMin, ceilMax))
    const roleDelta = p.avgFP - (roleAvgMap.get(p.role) ?? 0)
    const roleDeltaScore = round1(minMaxNormalize(roleDelta, rdMin, rdMax))

    const powerRating = round1(
      0.40 * formScore +
      0.25 * consistencyScore +
      0.20 * ceilingScore +
      0.15 * roleDeltaScore
    )

    const own = ownership.get(p.id)
    const ownershipPct = round1(own?.pct ?? 0)
    const valueRating = round1(p.avgFP / Math.max(ownershipPct, 1))

    const volatility: "low" | "medium" | "high" =
      p.cv < 30 ? "low" : p.cv < 60 ? "medium" : "high"

    return {
      id: p.id,
      name: p.name,
      role: p.role,
      team: p.team,
      color: p.color,
      powerRating,
      formScore,
      consistencyScore,
      ceilingScore,
      roleDeltaScore,
      xfp: null, // computed separately in match preview
      ownershipPct,
      valueRating,
      volatility,
      avgFP: p.avgFP,
      matches: p.matches,
    }
  }).sort((a, b) => b.powerRating - a.powerRating)
}

// ============================================================
// 4. Expected Fantasy Points (xFP)
// ============================================================

export const computeXFP = (
  playerId: string,
  seasonAvg: number,
  formLast3: number,
  venueStats: RawVenueStat | null,
  vsTeamStats: RawVsTeamStat | null,
): number => {
  // Compute venue avg FP estimate: rough proxy from runs + wickets
  // Since venue/vs-team stats don't have fantasy_points, we estimate
  // using a simplified heuristic based on runs and wickets
  const venueAvg = venueStats && venueStats.matches > 0
    ? estimateFantasyFromRaw(venueStats)
    : null

  const vsAvg = vsTeamStats && vsTeamStats.matches > 0
    ? estimateFantasyFromRaw(vsTeamStats)
    : null

  // Weight redistribution
  if (venueAvg !== null && vsAvg !== null) {
    return round1(0.50 * formLast3 + 0.30 * venueAvg + 0.20 * vsAvg)
  }
  if (venueAvg !== null) {
    return round1(0.65 * formLast3 + 0.35 * venueAvg)
  }
  if (vsAvg !== null) {
    return round1(0.70 * formLast3 + 0.30 * vsAvg)
  }
  // No contextual data — use form with slight regression to season mean
  return round1(0.75 * formLast3 + 0.25 * seasonAvg)
}

// Rough fantasy point estimate from raw stats (no breakdown available in venue/vs-team tables)
const estimateFantasyFromRaw = (stats: { matches: number; runs: number; wickets: number }): number => {
  if (stats.matches === 0) return 0
  const runsPerMatch = stats.runs / stats.matches
  const wicketsPerMatch = stats.wickets / stats.matches
  // Approximate: ~1pt per run + ~25pts per wicket + ~5pts base (fielding + playing XI)
  return round1(runsPerMatch + 25 * wicketsPerMatch + 5)
}

// ============================================================
// 5. Match Preview
// ============================================================

export const computeMatchPreview = (
  nextMatch: MatchInfo,
  playerStats: PlayerAnalytics[],
  playingXIPlayerIds: string[] | null, // null if XI not announced yet
  allPlayers: Map<string, PlayerInfo>,
  venueStats: RawVenueStat[],
  vsTeamStats: RawVsTeamStat[],
  ownership: Map<string, { pct: number }>,
  teamMap: Map<string, string>, // teamId -> short_name
): { predictions: MatchPreviewPlayer[]; suggestedTeam: SuggestedTeam | null } => {
  const statsMap = new Map(playerStats.map((p) => [p.id, p]))
  const venueByPlayer = new Map<string, RawVenueStat>()
  const vsTeamByPlayer = new Map<string, RawVsTeamStat>()

  // Index venue stats for this match's venue
  for (const vs of venueStats) {
    if (vs.venue === nextMatch.venue) {
      venueByPlayer.set(vs.player_id, vs)
    }
  }

  // Index vs-team stats for both opponent teams
  const homeTeamName = teamMap.get(nextMatch.teamHomeId) ?? ""
  const awayTeamName = teamMap.get(nextMatch.teamAwayId) ?? ""

  for (const vt of vsTeamStats) {
    const playerInfo = allPlayers.get(vt.player_id)
    if (!playerInfo) continue
    // If player is on home team, their opponent is the away team, and vice versa
    if (playerInfo.teamId === nextMatch.teamHomeId && vt.opponent_team === awayTeamName) {
      vsTeamByPlayer.set(vt.player_id, vt)
    } else if (playerInfo.teamId === nextMatch.teamAwayId && vt.opponent_team === homeTeamName) {
      vsTeamByPlayer.set(vt.player_id, vt)
    }
  }

  // Determine candidate players
  let candidateIds: string[]
  if (playingXIPlayerIds && playingXIPlayerIds.length > 0) {
    candidateIds = playingXIPlayerIds
  } else {
    // Fall back to all players on both teams
    candidateIds = [...allPlayers.values()]
      .filter((p) => p.teamId === nextMatch.teamHomeId || p.teamId === nextMatch.teamAwayId)
      .map((p) => p.id)
  }

  const predictions: MatchPreviewPlayer[] = []

  for (const pid of candidateIds) {
    const info = allPlayers.get(pid)
    if (!info) continue
    const ps = statsMap.get(pid)

    const seasonAvg = ps ? ps.avgFP : 0
    const formLast3 = ps ? ps.formLast3 : seasonAvg
    const vs = venueByPlayer.get(pid) ?? null
    const vt = vsTeamByPlayer.get(pid) ?? null
    const xfp = computeXFP(pid, seasonAvg, formLast3, vs, vt)
    const own = ownership.get(pid)?.pct ?? 0

    const venueAvg = vs && vs.matches > 0 ? round1(estimateFantasyFromRaw(vs)) : null
    const vsOpponentAvg = vt && vt.matches > 0 ? round1(estimateFantasyFromRaw(vt)) : null

    predictions.push({
      id: pid,
      name: info.name,
      role: info.role,
      team: info.team,
      color: info.color,
      seasonAvg: round1(seasonAvg),
      formLast3: round1(formLast3),
      venueAvg,
      vsOpponentAvg,
      xfp,
      ownershipPct: round1(own),
      isDifferential: false, // computed after sorting
    })
  }

  // Sort by xFP descending
  predictions.sort((a, b) => b.xfp - a.xfp)

  // Mark differentials: top 30% by xFP but bottom 30% by ownership
  if (predictions.length > 0) {
    const xfpThreshold = predictions[Math.floor(predictions.length * 0.3)]?.xfp ?? 0
    const ownerships = predictions.map((p) => p.ownershipPct).sort((a, b) => a - b)
    const ownershipThreshold = ownerships[Math.floor(ownerships.length * 0.3)] ?? 0

    for (const p of predictions) {
      p.isDifferential = p.xfp >= xfpThreshold && p.ownershipPct <= ownershipThreshold
    }
  }

  // Build suggested optimal 11
  const suggestedTeam = buildOptimalTeam(
    predictions.map((p) => ({
      id: p.id, name: p.name, role: p.role, team: p.team, fp: p.xfp,
      teamId: allPlayers.get(p.id)?.teamId ?? "",
    }))
  )

  return { predictions, suggestedTeam }
}

// ============================================================
// 6. Optimal Team Builder (greedy, role-constrained)
// ============================================================

type OptimalCandidate = {
  id: string
  name: string
  role: PlayerRole
  team: string
  teamId: string
  fp: number
}

const ROLE_LIMITS: Record<PlayerRole, [number, number]> = {
  WK: [1, 4],
  BAT: [2, 5],
  AR: [1, 3],
  BOWL: [2, 5],
}

const buildOptimalTeam = (
  candidates: OptimalCandidate[]
): SuggestedTeam | null => {
  if (candidates.length < 11) return null

  // Sort by FP descending
  const sorted = [...candidates].sort((a, b) => b.fp - a.fp)

  const picked: OptimalCandidate[] = []
  const roleCount: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  const teamCount = new Map<string, number>()

  // Phase 1: Fill minimums
  const used = new Set<string>()
  const roles: PlayerRole[] = ["WK", "AR", "BAT", "BOWL"] // fill rarest first

  for (const role of roles) {
    const [min] = ROLE_LIMITS[role]
    const roleCandidates = sorted.filter((c) => c.role === role && !used.has(c.id))
    for (const c of roleCandidates) {
      if (roleCount[role] >= min) break
      const tc = teamCount.get(c.teamId) ?? 0
      if (tc >= 7) continue
      picked.push(c)
      used.add(c.id)
      roleCount[role]++
      teamCount.set(c.teamId, tc + 1)
    }
  }

  // Phase 2: Fill remaining slots (up to 11) with best available
  for (const c of sorted) {
    if (picked.length >= 11) break
    if (used.has(c.id)) continue
    const [, max] = ROLE_LIMITS[c.role]
    if (roleCount[c.role] >= max) continue
    const tc = teamCount.get(c.teamId) ?? 0
    if (tc >= 7) continue
    picked.push(c)
    used.add(c.id)
    roleCount[c.role]++
    teamCount.set(c.teamId, tc + 1)
  }

  if (picked.length < 11) return null

  // Captain = highest FP, VC = second highest
  const byFP = [...picked].sort((a, b) => b.fp - a.fp)
  const captainId = byFP[0].id
  const vcId = byFP[1].id

  // Total with multipliers: captain 2x, VC 1.5x, rest 1x
  const totalProjected = round1(
    picked.reduce((sum, p) => {
      const mult = p.id === captainId ? 2 : p.id === vcId ? 1.5 : 1
      return sum + p.fp * mult
    }, 0)
  )

  return {
    players: picked.map((p) => ({ id: p.id, name: p.name, role: p.role, team: p.team, xfp: p.fp })),
    captainId,
    vcId,
    totalProjected,
  }
}

// ============================================================
// 7. Optimal Teams per Match (retrospective)
// ============================================================

export const computeOptimalTeams = (
  scores: RawPlayerScore[],
  playerMap: Map<string, PlayerInfo>,
  matches: MatchInfo[],
): OptimalTeam[] => {
  // Group scores by match
  const byMatch = new Map<string, RawPlayerScore[]>()
  for (const s of scores) {
    const arr = byMatch.get(s.match_id) ?? []
    arr.push(s)
    byMatch.set(s.match_id, arr)
  }

  const results: OptimalTeam[] = []

  for (const match of matches) {
    const matchScores = byMatch.get(match.id)
    if (!matchScores || matchScores.length < 11) continue

    const candidates: OptimalCandidate[] = matchScores
      .map((s) => {
        const info = playerMap.get(s.player_id)
        if (!info) return null
        return {
          id: s.player_id,
          name: info.name,
          role: info.role,
          team: info.team,
          teamId: info.teamId,
          fp: Number(s.fantasy_points),
        }
      })
      .filter((c): c is OptimalCandidate => c !== null)

    const optimal = buildOptimalTeam(candidates)
    if (!optimal) continue

    results.push({
      matchId: match.id,
      matchNumber: match.matchNumber,
      players: optimal.players.map((p) => ({ id: p.id, name: p.name, role: p.role, fp: p.xfp })),
      captainId: optimal.captainId,
      vcId: optimal.vcId,
      totalScore: optimal.totalProjected,
    })
  }

  return results.sort((a, b) => a.matchNumber - b.matchNumber)
}

// ============================================================
// 8. Ownership & Captain Analysis
// ============================================================

export const computeOwnership = (
  selections: RawSelection[],
  scores: RawPlayerScore[],
  playerMap: Map<string, PlayerInfo>,
  totalUsers: number,
  totalMatches: number,
): { ownership: OwnershipEntry[]; captainROI: CaptainROI[] } => {
  const pickCount = new Map<string, number>()
  const captainCount = new Map<string, number>()
  const vcCount = new Map<string, number>()
  const pickedMatchFP = new Map<string, number[]>() // player -> FPs in matches they were picked

  // Build FP lookup: matchId:playerId -> fp
  const fpLookup = new Map<string, number>()
  for (const s of scores) {
    fpLookup.set(`${s.match_id}:${s.player_id}`, Number(s.fantasy_points))
  }

  for (const sel of selections) {
    for (const pid of sel.players) {
      pickCount.set(pid, (pickCount.get(pid) ?? 0) + 1)
      const fp = fpLookup.get(`${sel.match_id}:${pid}`) ?? 0
      const arr = pickedMatchFP.get(pid) ?? []
      arr.push(fp)
      pickedMatchFP.set(pid, arr)
    }
    if (sel.captain_id) captainCount.set(sel.captain_id, (captainCount.get(sel.captain_id) ?? 0) + 1)
    if (sel.vice_captain_id) vcCount.set(sel.vice_captain_id, (vcCount.get(sel.vice_captain_id) ?? 0) + 1)
  }

  const denominator = Math.max(totalUsers * totalMatches, 1)

  const ownership: OwnershipEntry[] = [...pickCount.entries()]
    .map(([pid, count]) => {
      const info = playerMap.get(pid)
      if (!info) return null
      const fps = pickedMatchFP.get(pid) ?? []
      return {
        id: pid,
        name: info.name,
        role: info.role,
        team: info.team,
        color: info.color,
        timesPicked: count,
        ownershipPct: round1((count / denominator) * 100),
        timesCaptained: captainCount.get(pid) ?? 0,
        captainPct: round1(((captainCount.get(pid) ?? 0) / denominator) * 100),
        timesVC: vcCount.get(pid) ?? 0,
        avgFPWhenPicked: round1(mean(fps)),
      }
    })
    .filter((e): e is OwnershipEntry => e !== null)
    .sort((a, b) => b.timesPicked - a.timesPicked)

  // Captain ROI
  const captainROI: CaptainROI[] = []
  for (const [pid, count] of captainCount) {
    const info = playerMap.get(pid)
    if (!info || count === 0) continue

    // Find all captain bonus values
    const bonuses: number[] = []
    for (const sel of selections) {
      if (sel.captain_id === pid) {
        const fp = fpLookup.get(`${sel.match_id}:${pid}`) ?? 0
        bonuses.push(fp) // captain bonus = base FP (since multiplier is 2x, the bonus is 1x of base)
      }
    }

    captainROI.push({
      id: pid,
      name: info.name,
      role: info.role,
      team: info.team,
      timesCaptained: count,
      avgCaptainBonus: round1(mean(bonuses)),
      bestCaptainGame: round1(Math.max(...bonuses)),
      worstCaptainGame: round1(Math.min(...bonuses)),
    })
  }
  captainROI.sort((a, b) => b.avgCaptainBonus - a.avgCaptainBonus)

  return { ownership, captainROI }
}

// ============================================================
// 9. Decision Quality Score
// ============================================================

export const computeDecisionQuality = (
  userScores: RawUserMatchScore[],
  optimalTeams: OptimalTeam[],
  profiles: Map<string, string>, // userId -> displayName
): UserDQS[] => {
  const optimalMap = new Map(optimalTeams.map((o) => [o.matchId, o.totalScore]))

  // Group user scores by user
  const byUser = new Map<string, RawUserMatchScore[]>()
  for (const s of userScores) {
    const arr = byUser.get(s.user_id) ?? []
    arr.push(s)
    byUser.set(s.user_id, arr)
  }

  const results: UserDQS[] = []

  for (const [userId, scores] of byUser) {
    const dqsValues: number[] = []
    for (const s of scores) {
      const optimal = optimalMap.get(s.match_id)
      if (!optimal || optimal === 0) continue
      dqsValues.push((s.total_points / optimal) * 100)
    }
    if (dqsValues.length === 0) continue

    results.push({
      userId,
      displayName: profiles.get(userId) ?? "Unknown",
      avgDQS: round1(mean(dqsValues)),
      bestDQS: round1(Math.max(...dqsValues)),
      worstDQS: round1(Math.min(...dqsValues)),
      matches: dqsValues.length,
    })
  }

  return results.sort((a, b) => b.avgDQS - a.avgDQS)
}

// ============================================================
// 10. Venue & Match Analytics
// ============================================================

export const computeVenueAnalytics = (
  scores: RawPlayerScore[],
  matches: MatchInfo[],
  playerMap: Map<string, PlayerInfo>,
  teamMap: Map<string, string>,
): { venues: VenueAnalytics[]; matchRows: MatchScoringRow[] } => {
  const matchInfoMap = new Map(matches.map((m) => [m.id, m]))

  // Group scores by match for match-level stats
  const scoresByMatch = new Map<string, RawPlayerScore[]>()
  for (const s of scores) {
    const arr = scoresByMatch.get(s.match_id) ?? []
    arr.push(s)
    scoresByMatch.set(s.match_id, arr)
  }

  // Venue aggregation
  type VenueAcc = {
    matchCount: number
    totalFPs: number[]
    battingFPs: number[]
    bowlingFPs: number[]
    fieldingFPs: number[]
    rolePoints: Record<string, number[]>
    playerFPs: Map<string, number[]>
  }
  const venueAcc = new Map<string, VenueAcc>()

  for (const match of matches) {
    if (match.status !== "completed") continue
    const matchScores = scoresByMatch.get(match.id) ?? []
    if (matchScores.length === 0) continue

    let acc = venueAcc.get(match.venue)
    if (!acc) {
      acc = {
        matchCount: 0, totalFPs: [], battingFPs: [], bowlingFPs: [], fieldingFPs: [],
        rolePoints: { WK: [], BAT: [], AR: [], BOWL: [] },
        playerFPs: new Map(),
      }
      venueAcc.set(match.venue, acc)
    }
    acc.matchCount++

    let matchTotal = 0, matchBatting = 0, matchBowling = 0, matchFielding = 0
    for (const s of matchScores) {
      const fp = Number(s.fantasy_points)
      matchTotal += fp
      const cat = categorizeBreakdown(s.breakdown)
      matchBatting += cat.batting
      matchBowling += cat.bowling
      matchFielding += cat.fielding

      const info = playerMap.get(s.player_id)
      if (info) {
        const roleArr = acc.rolePoints[info.role] ?? []
        roleArr.push(fp)
        acc.rolePoints[info.role] = roleArr

        const playerArr = acc.playerFPs.get(s.player_id) ?? []
        playerArr.push(fp)
        acc.playerFPs.set(s.player_id, playerArr)
      }
    }
    acc.totalFPs.push(matchTotal)
    acc.battingFPs.push(matchBatting)
    acc.bowlingFPs.push(matchBowling)
    acc.fieldingFPs.push(matchFielding)
  }

  const venues: VenueAnalytics[] = [...venueAcc.entries()].map(([venue, acc]) => {
    const avgTotal = round1(mean(acc.totalFPs))
    const avgBatting = round1(mean(acc.battingFPs))
    const avgBowling = round1(mean(acc.bowlingFPs))
    const avgFielding = round1(mean(acc.fieldingFPs))
    const battingPct = avgTotal > 0 ? round1((avgBatting / avgTotal) * 100) : 0
    const classification: VenueAnalytics["classification"] =
      battingPct > 55 ? "bat-friendly" : battingPct < 45 ? "bowl-friendly" : "balanced"

    // Best role
    const roleAvg: Record<string, number> = {}
    let bestRole = "BAT"
    let bestRoleAvg = 0
    for (const [role, points] of Object.entries(acc.rolePoints)) {
      const avg = round1(mean(points))
      roleAvg[role] = avg
      if (avg > bestRoleAvg) { bestRoleAvg = avg; bestRole = role }
    }

    // Top performer
    let topPerformer = "—"
    let topPerformerAvg = 0
    for (const [pid, fps] of acc.playerFPs) {
      const avg = mean(fps)
      if (avg > topPerformerAvg) {
        topPerformerAvg = avg
        topPerformer = playerMap.get(pid)?.name ?? "—"
      }
    }

    return {
      venue, matches: acc.matchCount, avgTotalFP: avgTotal,
      avgBattingFP: avgBatting, avgBowlingFP: avgBowling, avgFieldingFP: avgFielding,
      battingPct, classification, bestRole, topPerformer, roleAvg,
    }
  }).sort((a, b) => b.avgTotalFP - a.avgTotalFP)

  // Match scoring rows
  const matchRows: MatchScoringRow[] = []
  // (userScores passed separately — we just compute per-match player totals here)

  return { venues, matchRows }
}

// Compute match scoring rows separately (needs user scores)
export const computeMatchScoringRows = (
  scores: RawPlayerScore[],
  userScores: RawUserMatchScore[],
  matches: MatchInfo[],
  playerMap: Map<string, PlayerInfo>,
  profileMap: Map<string, string>,
  teamMap: Map<string, string>,
): MatchScoringRow[] => {
  const matchMap = new Map(matches.map((m) => [m.id, m]))
  const scoresByMatch = new Map<string, RawPlayerScore[]>()
  for (const s of scores) {
    const arr = scoresByMatch.get(s.match_id) ?? []
    arr.push(s)
    scoresByMatch.set(s.match_id, arr)
  }

  const userScoresByMatch = new Map<string, RawUserMatchScore[]>()
  for (const s of userScores) {
    const arr = userScoresByMatch.get(s.match_id) ?? []
    arr.push(s)
    userScoresByMatch.set(s.match_id, arr)
  }

  const rows: MatchScoringRow[] = []

  for (const match of matches) {
    if (match.status !== "completed") continue
    const ms = scoresByMatch.get(match.id) ?? []
    const us = userScoresByMatch.get(match.id) ?? []
    if (ms.length === 0) continue

    const totalFP = round1(ms.reduce((sum, s) => sum + Number(s.fantasy_points), 0))
    const userPoints = us.map((u) => u.total_points)
    const avgUserScore = round1(mean(userPoints))
    const topUser = us.reduce((best, u) => u.total_points > best.total_points ? u : best, us[0])

    const highestPlayer = ms.reduce((best, s) =>
      Number(s.fantasy_points) > Number(best.fantasy_points) ? s : best, ms[0])

    rows.push({
      matchId: match.id,
      matchNumber: match.matchNumber,
      venue: match.venue,
      homeTeam: teamMap.get(match.teamHomeId) ?? "?",
      awayTeam: teamMap.get(match.teamAwayId) ?? "?",
      totalFP,
      avgUserScore,
      topUserScore: topUser ? round1(topUser.total_points) : 0,
      topUserName: topUser ? (profileMap.get(topUser.user_id) ?? "?") : "?",
      highestPlayerFP: round1(Number(highestPlayer?.fantasy_points ?? 0)),
      highestPlayerName: playerMap.get(highestPlayer?.player_id ?? "")?.name ?? "?",
    })
  }

  return rows.sort((a, b) => a.matchNumber - b.matchNumber)
}

// ============================================================
// Pace vs Spin Analysis
// ============================================================

export function computePaceSpinAnalysis(
  scores: RawPlayerScore[],
  playerMap: Map<string, PlayerInfo>,
  matchInfos: MatchInfo[],
  teamMap: Map<string, string>,
): { venues: PaceSpinVenueRow[]; teams: PaceSpinTeamRow[] } {
  // Build match → venue + teams lookup
  const matchVenue = new Map<string, string>()
  const matchTeams = new Map<string, { homeId: string; awayId: string }>()
  for (const m of matchInfos) {
    if (m.status !== "completed") continue
    matchVenue.set(m.id, m.venue)
    matchTeams.set(m.id, { homeId: m.teamHomeId, awayId: m.teamAwayId })
  }

  // Convert cricket notation overs (3.5 = 3 overs 5 balls) to actual overs (3.833)
  const toActualOvers = (o: number) => Math.floor(o) + (o % 1) * 10 / 6

  // Filter to bowlers only (overs > 0, known style)
  const bowlerScores = scores.filter((s) => {
    const p = playerMap.get(s.player_id)
    return p && (p.bowlingStyle === "pace" || p.bowlingStyle === "spin") && s.overs_bowled > 0
  })

  // --- Venue analysis ---
  type VenueAcc = { matches: Set<string>; pW: number; sW: number; pO: number; sO: number; pRC: number; sRC: number; pFP: number; sFP: number; pCount: number; sCount: number }
  const venueAcc = new Map<string, VenueAcc>()

  for (const s of bowlerScores) {
    const venue = matchVenue.get(s.match_id)
    if (!venue) continue
    const style = playerMap.get(s.player_id)!.bowlingStyle as "pace" | "spin"

    let v = venueAcc.get(venue)
    if (!v) { v = { matches: new Set(), pW: 0, sW: 0, pO: 0, sO: 0, pRC: 0, sRC: 0, pFP: 0, sFP: 0, pCount: 0, sCount: 0 }; venueAcc.set(venue, v) }
    v.matches.add(s.match_id)

    const actualOvers = toActualOvers(s.overs_bowled)
    if (style === "pace") {
      v.pW += s.wickets; v.pO += actualOvers; v.pRC += s.runs_conceded; v.pFP += s.fantasy_points; v.pCount++
    } else {
      v.sW += s.wickets; v.sO += actualOvers; v.sRC += s.runs_conceded; v.sFP += s.fantasy_points; v.sCount++
    }
  }

  const venues: PaceSpinVenueRow[] = Array.from(venueAcc.entries()).map(([venue, v]) => {
    const pEcon = v.pO > 0 ? round1(v.pRC / v.pO) : 0
    const sEcon = v.sO > 0 ? round1(v.sRC / v.sO) : 0
    const totalW = v.pW + v.sW
    const spinPct = totalW > 0 ? v.sW / totalW : 0.5
    const dominance: "pace" | "spin" | "balanced" = spinPct > 0.6 ? "spin" : spinPct < 0.4 ? "pace" : "balanced"
    return {
      venue,
      matches: v.matches.size,
      paceWickets: v.pW,
      spinWickets: v.sW,
      paceOvers: round1(v.pO),
      spinOvers: round1(v.sO),
      paceEconomy: pEcon,
      spinEconomy: sEcon,
      paceAvgFP: v.pCount > 0 ? round1(v.pFP / v.pCount) : 0,
      spinAvgFP: v.sCount > 0 ? round1(v.sFP / v.sCount) : 0,
      dominance,
    }
  }).sort((a, b) => b.matches - a.matches)

  // --- Team vulnerability analysis ---
  // For each match, find which team was batting against each bowler
  type TeamAcc = { pW: number; sW: number; matchesBatted: Set<string> }
  const teamAcc = new Map<string, TeamAcc>()

  for (const s of bowlerScores) {
    const teams = matchTeams.get(s.match_id)
    if (!teams) continue
    const bowlerInfo = playerMap.get(s.player_id)!
    const style = bowlerInfo.bowlingStyle as "pace" | "spin"

    // The batting team is the one that ISN'T the bowler's team
    const battingTeamId = bowlerInfo.teamId === teams.homeId ? teams.awayId : teams.homeId
    const battingTeam = teamMap.get(battingTeamId) ?? "?"

    let t = teamAcc.get(battingTeam)
    if (!t) { t = { pW: 0, sW: 0, matchesBatted: new Set() }; teamAcc.set(battingTeam, t) }
    t.matchesBatted.add(s.match_id)

    if (style === "pace") t.pW += s.wickets
    else t.sW += s.wickets
  }

  const teamRows: PaceSpinTeamRow[] = Array.from(teamAcc.entries()).map(([team, t]) => {
    const totalW = t.pW + t.sW
    const spinPct = totalW > 0 ? t.sW / totalW : 0.5
    const vulnerability: "pace" | "spin" | "balanced" = spinPct > 0.6 ? "spin" : spinPct < 0.4 ? "pace" : "balanced"
    return {
      team,
      paceWicketsAgainst: t.pW,
      spinWicketsAgainst: t.sW,
      totalMatchesBatted: t.matchesBatted.size,
      vulnerability,
    }
  }).sort((a, b) => (b.paceWicketsAgainst + b.spinWicketsAgainst) - (a.paceWicketsAgainst + a.spinWicketsAgainst))

  return { venues, teams: teamRows }
}

// ============================================================
// User Preferences — bias per team / role / captain / loyalty
// ============================================================

export type UserPreferenceTeamSlice = {
  teamId: string
  teamShort: string
  count: number
  pct: number
}

export type UserPreferenceTopPlayer = {
  id: string
  name: string
  team: string
  count: number
  pct: number
}

export type UserPreferencePlayerPickRow = {
  id: string
  name: string
  role: PlayerRole
  picks: number
  pickPct: number
  captainCount: number
  captainPct: number
}

export type UserPreference = {
  userId: string
  displayName: string
  matchesPlayed: number
  totalPicks: number
  byTeam: UserPreferenceTeamSlice[]
  byRole: { WK: number; BAT: number; AR: number; BOWL: number }
  topTeam: UserPreferenceTeamSlice | null
  topCaptain: UserPreferenceTopPlayer | null
  topPlayer: UserPreferenceTopPlayer | null
  picksByTeam: Record<string, UserPreferencePlayerPickRow[]>
  // Number of matches the user submitted picks for in which a given team played.
  // Used as the denominator for per-player pick rate inside picksByTeam.
  teamOpportunities: Record<string, number>
}

export const computeUserPreferences = (
  selections: RawSelection[],
  playerMap: Map<string, PlayerInfo>,
  profileMap: Map<string, string>,
  teamIdToShort: Map<string, string>,
  matchTeams: Map<string, [string, string]>,
): UserPreference[] => {
  const byUser = new Map<string, RawSelection[]>()
  for (const s of selections) {
    const arr = byUser.get(s.user_id) ?? []
    arr.push(s)
    byUser.set(s.user_id, arr)
  }

  const allTeamIds = [...teamIdToShort.keys()]
  const out: UserPreference[] = []

  for (const [userId, sels] of byUser) {
    const matchesPlayed = sels.length
    const totalPicks = sels.reduce((acc, s) => acc + s.players.length, 0)
    if (totalPicks === 0) continue

    const teamCount = new Map<string, number>()
    const roleCount = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
    const captainCount = new Map<string, number>()
    const playerCount = new Map<string, number>()
    // teamId -> playerId -> { picks, captain }
    const playerByTeam = new Map<string, Map<string, { picks: number; captain: number }>>()
    // teamId -> # of this user's matches in which the team played
    const opportunitiesByTeam = new Map<string, number>()

    for (const s of sels) {
      const matchPair = matchTeams.get(s.match_id)
      if (matchPair) {
        const [home, away] = matchPair
        opportunitiesByTeam.set(home, (opportunitiesByTeam.get(home) ?? 0) + 1)
        opportunitiesByTeam.set(away, (opportunitiesByTeam.get(away) ?? 0) + 1)
      }
      for (const pid of s.players) {
        const p = playerMap.get(pid)
        if (!p) continue
        teamCount.set(p.teamId, (teamCount.get(p.teamId) ?? 0) + 1)
        if (p.role in roleCount) roleCount[p.role as keyof typeof roleCount]++
        playerCount.set(pid, (playerCount.get(pid) ?? 0) + 1)
        let teamMap2 = playerByTeam.get(p.teamId)
        if (!teamMap2) {
          teamMap2 = new Map()
          playerByTeam.set(p.teamId, teamMap2)
        }
        const entry = teamMap2.get(pid) ?? { picks: 0, captain: 0 }
        entry.picks++
        teamMap2.set(pid, entry)
      }
      if (s.captain_id) {
        captainCount.set(s.captain_id, (captainCount.get(s.captain_id) ?? 0) + 1)
        const cp = playerMap.get(s.captain_id)
        if (cp) {
          const tm = playerByTeam.get(cp.teamId)
          const entry = tm?.get(s.captain_id)
          if (entry) entry.captain++
        }
      }
    }

    // Build full team allocation (one entry per known team, even if 0 picks)
    const byTeam: UserPreferenceTeamSlice[] = allTeamIds.map((teamId) => {
      const count = teamCount.get(teamId) ?? 0
      return {
        teamId,
        teamShort: teamIdToShort.get(teamId) ?? "?",
        count,
        pct: round1((count / totalPicks) * 100),
      }
    })

    const topTeam = byTeam.reduce<UserPreferenceTeamSlice | null>(
      (best, t) => (best === null || t.count > best.count ? t : best),
      null,
    )

    const byRole = {
      WK: round1((roleCount.WK / totalPicks) * 100),
      BAT: round1((roleCount.BAT / totalPicks) * 100),
      AR: round1((roleCount.AR / totalPicks) * 100),
      BOWL: round1((roleCount.BOWL / totalPicks) * 100),
    }

    function pickTopPlayer(counts: Map<string, number>, denom: number): UserPreferenceTopPlayer | null {
      let topId: string | null = null
      let topN = 0
      for (const [pid, c] of counts) {
        if (c > topN) {
          topN = c
          topId = pid
        }
      }
      if (!topId) return null
      const info = playerMap.get(topId)
      if (!info) return null
      return {
        id: topId,
        name: info.name,
        team: info.team,
        count: topN,
        pct: round1((topN / denom) * 100),
      }
    }

    const picksByTeam: Record<string, UserPreferencePlayerPickRow[]> = {}
    for (const [teamId, players] of playerByTeam) {
      // Denominator: matches in which this user could have picked from this team.
      // Falls back to picks count itself if matchTeams was missing the rows
      // (so the rate stays bounded ≤ 100%).
      const opps = opportunitiesByTeam.get(teamId) ?? 0
      const rows: UserPreferencePlayerPickRow[] = []
      for (const [pid, e] of players) {
        const info = playerMap.get(pid)
        if (!info) continue
        const denom = opps > 0 ? opps : Math.max(e.picks, 1)
        rows.push({
          id: pid,
          name: info.name,
          role: info.role,
          picks: e.picks,
          pickPct: round1((e.picks / denom) * 100),
          captainCount: e.captain,
          captainPct: round1((e.captain / denom) * 100),
        })
      }
      rows.sort((a, b) => b.picks - a.picks || b.captainCount - a.captainCount)
      picksByTeam[teamId] = rows
    }

    const teamOpportunities: Record<string, number> = {}
    for (const [teamId, count] of opportunitiesByTeam) {
      teamOpportunities[teamId] = count
    }

    out.push({
      userId,
      displayName: profileMap.get(userId) ?? "Unknown",
      matchesPlayed,
      totalPicks,
      byTeam,
      byRole,
      topTeam,
      topCaptain: pickTopPlayer(captainCount, matchesPlayed),
      topPlayer: pickTopPlayer(playerCount, matchesPlayed),
      picksByTeam,
      teamOpportunities,
    })
  }

  return out.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  CaptainAnalyticsRow,
  CaptainMatchHistoryRow,
  CvPickRow,
  DifferentialPickRow,
  DifferentialSummaryRow,
} from "@/lib/types"

// ── Shared base data loader ───────────────────────────────────────────────────
// Fetches all raw data needed for captain + differential analytics.
// Returns null if the league has no members or no completed matches.

async function fetchInsightsBase(leagueId: string) {
  const admin = createAdminClient()

  const { data: members } = await admin
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", leagueId)
    .limit(50)

  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return null

  type MatchRow = {
    id: string
    match_number: number
    start_time: string
    team_home: { id: string; short_name: string } | null
    team_away: { id: string; short_name: string } | null
  }

  const { data: completedMatchesRaw } = await admin
    .from("matches")
    .select(
      "id, match_number, start_time, " +
      "team_home:teams!matches_team_home_id_fkey(id, short_name), " +
      "team_away:teams!matches_team_away_id_fkey(id, short_name)"
    )
    .eq("status", "completed")
    .order("start_time", { ascending: true })
    .limit(100)

  const completedMatches = (completedMatchesRaw ?? []) as unknown as MatchRow[]

  const matchIds = completedMatches.map((m) => m.id)
  if (matchIds.length === 0) return null

  const { data: selections } = await admin
    .from("selections")
    .select("id, user_id, match_id, captain_id, vice_captain_id")
    .in("match_id", matchIds)
    .in("user_id", userIds)
    .not("locked_at", "is", null)
    .limit(5000)

  const selectionIds = (selections ?? []).map((s) => s.id)

  const [{ data: selectionPlayers }, { data: matchScores }, { data: players }] = await Promise.all([
    admin
      .from("selection_players")
      .select("selection_id, player_id")
      .in("selection_id", selectionIds)
      .limit(20000),
    admin
      .from("match_player_scores")
      .select("player_id, match_id, fantasy_points")
      .in("match_id", matchIds)
      .limit(5000),
    admin
      .from("players")
      .select("id, name, role, team_id, team:teams(id, short_name)")
      .limit(500),
  ])

  return {
    members: members ?? [],
    completedMatches: completedMatches ?? [],
    selections: selections ?? [],
    selectionPlayers: selectionPlayers ?? [],
    matchScores: matchScores ?? [],
    players: players ?? [],
    userIds,
    matchIds,
  }
}

// ── Captain analytics ─────────────────────────────────────────────────────────

export async function getCaptainAnalytics(leagueId: string): Promise<{
  leaderboard: CaptainAnalyticsRow[]
  matchHistory: Record<string, CaptainMatchHistoryRow[]>  // keyed by user_id
  cvPicks: CvPickRow[]
  userNames: Record<string, string>  // user_id -> display_name
}> {
  const base = await fetchInsightsBase(leagueId)
  if (!base) return { leaderboard: [], matchHistory: {}, cvPicks: [], userNames: {} }

  const { members, completedMatches, selections, selectionPlayers, matchScores, players, userIds } = base

  // ── Build lookup maps ──
  // "matchId:playerId" -> fantasy_points
  const scoreMap = new Map<string, number>()
  for (const s of matchScores) {
    scoreMap.set(`${s.match_id}:${s.player_id}`, Number(s.fantasy_points))
  }

  // selectionId -> playerIds[]
  const selectionPlayerMap = new Map<string, string[]>()
  for (const sp of selectionPlayers) {
    if (!selectionPlayerMap.has(sp.selection_id)) selectionPlayerMap.set(sp.selection_id, [])
    selectionPlayerMap.get(sp.selection_id)!.push(sp.player_id)
  }

  // playerId -> { name, team_short_name, team_id, role }
  type PlayerInfo = { name: string; team_short_name: string; team_id: string; role: string }
  const playerMap = new Map<string, PlayerInfo>()
  for (const p of players) {
    playerMap.set(p.id, {
      name: p.name,
      team_short_name: (p.team as unknown as { short_name: string })?.short_name ?? "",
      team_id: p.team_id,
      role: p.role as string,
    })
  }

  // matchId -> { match_number, matchup }
  const matchInfoMap = new Map<string, { match_number: number; matchup: string }>()
  for (const m of completedMatches) {
    const home = m.team_home?.short_name ?? ""
    const away = m.team_away?.short_name ?? ""
    matchInfoMap.set(m.id, { match_number: m.match_number, matchup: `${home} vs ${away}` })
  }

  // userId -> display_name
  const profileMap = new Map<string, string>()
  for (const m of members) {
    profileMap.set(m.user_id, (m.profiles as unknown as { display_name: string })?.display_name ?? "?")
  }

  // ── Per-user captain aggregation ──
  type UserAgg = { totalCaptainPts: number; totalOptimalPts: number; hitCount: number; matchCount: number }
  const userAgg = new Map<string, UserAgg>()
  const userMatchHistoryMap = new Map<string, CaptainMatchHistoryRow[]>()

  for (const sel of selections) {
    if (!sel.captain_id) continue
    const captainPts = scoreMap.get(`${sel.match_id}:${sel.captain_id}`) ?? 0
    const playerIds = selectionPlayerMap.get(sel.id) ?? []

    // Find optimal: highest scorer in user's 11
    let optimalPts = captainPts
    let optimalPlayerId = sel.captain_id ?? ""
    for (const pid of playerIds) {
      const pts = scoreMap.get(`${sel.match_id}:${pid}`) ?? 0
      if (pts > optimalPts) {
        optimalPts = pts
        optimalPlayerId = pid
      }
    }

    const agg = userAgg.get(sel.user_id) ?? { totalCaptainPts: 0, totalOptimalPts: 0, hitCount: 0, matchCount: 0 }
    agg.totalCaptainPts += captainPts
    agg.totalOptimalPts += optimalPts
    if (captainPts >= 50) agg.hitCount++
    agg.matchCount++
    userAgg.set(sel.user_id, agg)

    const matchInfo = matchInfoMap.get(sel.match_id)
    if (!matchInfo) continue

    const histRow: CaptainMatchHistoryRow = {
      match_id: sel.match_id,
      match_number: matchInfo.match_number,
      matchup: matchInfo.matchup,
      captain_id: sel.captain_id ?? "",
      captain_name: playerMap.get(sel.captain_id ?? "")?.name ?? "?",
      actual_pts: captainPts,
      optimal_pts: optimalPts,
      optimal_player_name: playerMap.get(optimalPlayerId)?.name ?? "?",
      gap: optimalPts - captainPts,
    }
    if (!userMatchHistoryMap.has(sel.user_id)) userMatchHistoryMap.set(sel.user_id, [])
    userMatchHistoryMap.get(sel.user_id)!.push(histRow)
  }

  // ── Captain leaderboard ──
  const leaderboard: CaptainAnalyticsRow[] = []
  for (const [userId, agg] of userAgg) {
    leaderboard.push({
      user_id: userId,
      display_name: profileMap.get(userId) ?? "?",
      total_captain_pts: Math.round(agg.totalCaptainPts),
      total_optimal_pts: Math.round(agg.totalOptimalPts),
      opportunity_cost: Math.round(agg.totalOptimalPts - agg.totalCaptainPts),
      hit_rate_pct: agg.matchCount > 0 ? Math.round((agg.hitCount / agg.matchCount) * 100) : 0,
      matches_played: agg.matchCount,
    })
  }
  leaderboard.sort((a, b) => b.total_captain_pts - a.total_captain_pts)

  // ── C/VC picks by team ──
  // Count captain + VC picks per player per user
  const cvAgg = new Map<string, { captain: Record<string, number>; vc: Record<string, number> }>()
  for (const sel of selections) {
    if (sel.captain_id) {
      if (!cvAgg.has(sel.captain_id)) cvAgg.set(sel.captain_id, { captain: {}, vc: {} })
      const entry = cvAgg.get(sel.captain_id)!
      entry.captain[sel.user_id] = (entry.captain[sel.user_id] ?? 0) + 1
    }
    if (sel.vice_captain_id) {
      if (!cvAgg.has(sel.vice_captain_id)) cvAgg.set(sel.vice_captain_id, { captain: {}, vc: {} })
      const entry = cvAgg.get(sel.vice_captain_id)!
      entry.vc[sel.user_id] = (entry.vc[sel.user_id] ?? 0) + 1
    }
  }

  // Count completed matches per team
  const teamMatchCount = new Map<string, number>()
  for (const m of completedMatches) {
    const homeId = m.team_home?.id
    const awayId = m.team_away?.id
    if (homeId) teamMatchCount.set(homeId, (teamMatchCount.get(homeId) ?? 0) + 1)
    if (awayId) teamMatchCount.set(awayId, (teamMatchCount.get(awayId) ?? 0) + 1)
  }

  const cvPicks: CvPickRow[] = []
  for (const [playerId, cv] of cvAgg) {
    const player = playerMap.get(playerId)
    if (!player) continue
    cvPicks.push({
      player_id: playerId,
      player_name: player.name,
      team_id: player.team_id,
      team_short_name: player.team_short_name,
      team_matches_played: teamMatchCount.get(player.team_id) ?? 0,
      picks: Object.fromEntries(
        userIds.map((uid) => [uid, { captain: cv.captain[uid] ?? 0, vc: cv.vc[uid] ?? 0 }])
      ),
    })
  }
  cvPicks.sort((a, b) => {
    if (a.team_short_name !== b.team_short_name) return a.team_short_name.localeCompare(b.team_short_name)
    const totA = Object.values(a.picks).reduce((s, p) => s + p.captain + p.vc, 0)
    const totB = Object.values(b.picks).reduce((s, p) => s + p.captain + p.vc, 0)
    return totB - totA
  })

  // Sort match history most-recent first per user
  const matchHistory: Record<string, CaptainMatchHistoryRow[]> = {}
  for (const [uid, rows] of userMatchHistoryMap) {
    matchHistory[uid] = rows.sort((a, b) => b.match_number - a.match_number)
  }

  const userNames = Object.fromEntries(profileMap.entries())

  return { leaderboard, matchHistory, cvPicks, userNames }
}

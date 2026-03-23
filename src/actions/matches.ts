"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSquad, fetchScorecard, fetchMatchPoints, fetchSeriesInfo, parseScorecardToStats, fuzzyMatchName } from "@/lib/api/cricapi"
import { savePlayerScores, calculateMatchPoints } from "@/actions/scoring"
import type { PlayerStats } from "@/lib/scoring"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) throw new Error("Not admin")
  return user.id
}

export async function lockMatch(matchId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from("matches")
    .update({ status: "live", updated_at: new Date().toISOString() })
    .eq("id", matchId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function markNoResult(matchId: string): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  // Give flat 15 points to everyone who made a selection
  const { data: selections } = await admin
    .from("selections")
    .select("user_id")
    .eq("match_id", matchId)

  if (selections && selections.length > 0) {
    await admin.from("user_match_scores").delete().eq("match_id", matchId)

    const rows = selections.map((s) => ({
      user_id: s.user_id,
      match_id: matchId,
      total_points: 15,
      rank: 1,
      captain_points: 0,
      vc_points: 0,
      breakdown: null,
    }))

    const { error: insertError } = await admin.from("user_match_scores").insert(rows)
    if (insertError) return { error: `Failed to insert scores: ${insertError.message}` }
  }

  await admin
    .from("matches")
    .update({ status: "no_result", updated_at: new Date().toISOString() })
    .eq("id", matchId)

  await admin.rpc("refresh_leaderboard")

  return { success: true }
}

export async function fetchPlayingXI(matchId: string, cricapiMatchId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const squad = await fetchSquad(cricapiMatchId)
  if (!squad) return { error: "Failed to fetch squad from CricAPI" }

  const { data: match } = await admin
    .from("matches")
    .select("team_home_id, team_away_id")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  const { data: dbPlayers } = await admin
    .from("players")
    .select("id, name, team_id")
    .in("team_id", [match.team_home_id, match.team_away_id])

  if (!dbPlayers) return { error: "Failed to load players" }

  const nameMap = new Map<string, string>()
  for (const p of dbPlayers) {
    nameMap.set(
      p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(),
      p.id
    )
  }

  const matched: string[] = []
  const unmatched: string[] = []

  for (const apiPlayer of squad) {
    const dbId = fuzzyMatchName(apiPlayer.name, nameMap)
    if (dbId) {
      matched.push(dbId)
    } else {
      unmatched.push(apiPlayer.name)
    }
  }

  // Deduplicate — fuzzyMatchName can map multiple API names to the same DB player
  const deduped = [...new Set(matched)]

  if (deduped.length === 0) {
    return { error: "No players matched from API response" }
  }

  // Validate: must be exactly 11 per team (22 total) — not full squad
  const playerTeamMap = new Map(dbPlayers.map((p) => [p.id, p.team_id]))
  const byTeam = new Map<string, string[]>()
  for (const pid of deduped) {
    const tid = playerTeamMap.get(pid)
    if (!tid) continue
    const list = byTeam.get(tid) ?? []
    list.push(pid)
    byTeam.set(tid, list)
  }

  const teamCounts = [...byTeam.values()].map((v) => v.length)
  if (teamCounts.length !== 2 || teamCounts.some((c) => c !== 11)) {
    return {
      error: `Squad data returned (${deduped.length} players: ${teamCounts.join(" + ")}), not confirmed Playing XI (11+11). Try again after toss.`,
    }
  }

  await admin.from("playing_xi").delete().eq("match_id", matchId)
  const { error: insertError } = await admin.from("playing_xi").insert(
    deduped.map((pid) => ({
      match_id: matchId,
      player_id: pid,
      team_id: playerTeamMap.get(pid)!,
    }))
  )
  if (insertError) return { error: `Failed to insert Playing XI: ${insertError.message}` }

  return { success: true, matched: deduped.length, unmatched }
}

export async function fetchMatchScorecard(
  matchId: string,
  cricapiMatchId: string
): Promise<{
  error?: string
  success?: boolean
  scores?: Array<{ playerId: string; playerName: string; stats: PlayerStats }>
  unmatched?: string[]
}> {
  await requireAdmin()
  const admin = createAdminClient()

  const innings = await fetchScorecard(cricapiMatchId)
  if (!innings) return { error: "Failed to fetch scorecard from CricAPI" }

  const parsed = parseScorecardToStats(innings)

  const { data: match } = await admin
    .from("matches")
    .select("team_home_id, team_away_id")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  const { data: dbPlayers } = await admin
    .from("players")
    .select("id, name")
    .in("team_id", [match.team_home_id, match.team_away_id])

  if (!dbPlayers) return { error: "Failed to load players" }

  const nameMap = new Map<string, string>()
  const idToName = new Map<string, string>()
  for (const p of dbPlayers) {
    const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
    nameMap.set(norm, p.id)
    idToName.set(p.id, p.name)
  }

  const scores: Array<{ playerId: string; playerName: string; stats: PlayerStats }> = []
  const unmatched: string[] = []

  for (const [apiName, stats] of parsed) {
    const dbId = fuzzyMatchName(apiName, nameMap)
    if (dbId) {
      scores.push({ playerId: dbId, playerName: idToName.get(dbId) ?? apiName, stats })
    } else {
      unmatched.push(apiName)
    }
  }

  return { success: true, scores, unmatched }
}

/**
 * Auto-score a match in one step using the Fantasy Points API.
 * Fetches innings stats, resolves player IDs (cricapi_id first, name fallback),
 * saves player scores, and calculates user rankings.
 */
export async function autoScoreMatch(
  matchId: string,
  cricapiMatchId: string
): Promise<{
  success?: boolean
  error?: string
  unmatched?: string[]
  userScores?: Array<{ userId: string; total: number; rank: number }>
}> {
  await requireAdmin()
  const admin = createAdminClient()

  const result = await fetchMatchPoints(cricapiMatchId)
  if (!result) return { error: "Fantasy Points API returned no data. Try the manual scorecard flow instead." }
  if (result.innings.length === 0) return { error: "No innings data in match_points response. Match may not be complete yet." }

  const parsed = parseScorecardToStats(result.innings)

  const { data: match } = await admin
    .from("matches")
    .select("team_home_id, team_away_id")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  const { data: dbPlayers } = await admin
    .from("players")
    .select("id, name, cricapi_id")
    .in("team_id", [match.team_home_id, match.team_away_id])
  if (!dbPlayers) return { error: "Failed to load players" }

  // Build lookup maps: cricapi_id → db id, and normalized name → db id
  const cricapiIdMap = new Map<string, string>()
  const nameMap = new Map<string, string>()
  const idToName = new Map<string, string>()
  for (const p of dbPlayers) {
    if (p.cricapi_id) cricapiIdMap.set(p.cricapi_id, p.id)
    const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
    nameMap.set(norm, p.id)
    idToName.set(p.id, p.name)
  }

  // Build a map: cricapi player id → db player id from totals
  const apiIdToDbId = new Map<string, string>()
  for (const t of result.totals) {
    const dbId = cricapiIdMap.get(t.id) ?? fuzzyMatchName(t.name, nameMap)
    if (dbId) apiIdToDbId.set(t.id, dbId)
  }

  const scores: Array<{ playerId: string; stats: PlayerStats }> = []
  const unmatched: string[] = []

  for (const [apiName, stats] of parsed) {
    // Try ID-based match first via fuzzyMatchName on name (consistent with parseScorecardToStats key)
    const dbId = fuzzyMatchName(apiName, nameMap)
    if (dbId) {
      scores.push({ playerId: dbId, stats })
    } else {
      unmatched.push(apiName)
    }
  }

  if (scores.length === 0) {
    return { error: "No players matched. Check that match teams are correct and cricapi_ids are mapped." }
  }

  const saveResult = await savePlayerScores(matchId, scores)
  if (saveResult.error) return { error: `Failed to save scores: ${saveResult.error}` }

  const calcResult = await calculateMatchPoints(matchId)
  if (calcResult.error) return { error: `Failed to calculate points: ${calcResult.error}` }

  return {
    success: true,
    unmatched,
    userScores: calcResult.results?.map((r) => ({
      userId: r.userId,
      total: r.total,
      rank: r.rank,
    })),
  }
}

export type SeriesImportProposal = {
  apiMatchId: string
  apiName: string
  dateTimeGMT: string
  teams: string[]
  dbMatchId: string | null
  matchNumber: number | null
  alreadySet: boolean
}

/**
 * Preview: fetch all matches from a CricAPI series and propose cricapi_match_id mappings.
 * Matches by team names + date proximity. Does NOT write to DB.
 */
export async function previewSeriesImport(seriesId: string): Promise<{
  proposals?: SeriesImportProposal[]
  error?: string
}> {
  await requireAdmin()
  const admin = createAdminClient()

  const seriesMatches = await fetchSeriesInfo(seriesId)
  if (!seriesMatches) return { error: "Failed to fetch series from CricAPI. Check the series ID." }

  const { data: dbMatches } = await admin
    .from("matches")
    .select("id, match_number, start_time, cricapi_match_id, team_home:teams!team_home_id(name, short_name), team_away:teams!team_away_id(name, short_name)")
    .order("match_number")
  if (!dbMatches) return { error: "Failed to load matches from DB" }

  const proposals: SeriesImportProposal[] = []

  for (const apiMatch of seriesMatches) {
    const apiDate = new Date(apiMatch.dateTimeGMT).getTime()
    const apiTeams = apiMatch.teams.map((t) => t.toLowerCase())

    // Find DB match by team names + date (within 24h)
    let bestDb: (typeof dbMatches)[0] | null = null
    for (const dbm of dbMatches) {
      const home = dbm.team_home as unknown as { name: string; short_name: string }
      const away = dbm.team_away as unknown as { name: string; short_name: string }
      const dbDate = new Date(dbm.start_time).getTime()
      const withinDay = Math.abs(apiDate - dbDate) < 24 * 60 * 60 * 1000

      const teamMatch = apiTeams.some(
        (t) =>
          t.includes(home.short_name.toLowerCase()) ||
          home.name.toLowerCase().includes(t) ||
          t.includes(away.short_name.toLowerCase()) ||
          away.name.toLowerCase().includes(t)
      )

      if (withinDay && teamMatch) {
        bestDb = dbm
        break
      }
    }

    proposals.push({
      apiMatchId: apiMatch.id,
      apiName: apiMatch.name,
      dateTimeGMT: apiMatch.dateTimeGMT,
      teams: apiMatch.teams,
      dbMatchId: bestDb?.id ?? null,
      matchNumber: bestDb?.match_number ?? null,
      alreadySet: bestDb?.cricapi_match_id === apiMatch.id,
    })
  }

  return { proposals }
}

/** Confirm: write cricapi_match_id for approved proposals */
export async function confirmSeriesImport(
  proposals: Array<{ dbMatchId: string; apiMatchId: string }>
): Promise<{ success?: boolean; updated?: number; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  let updated = 0
  for (const p of proposals) {
    const { error } = await admin
      .from("matches")
      .update({ cricapi_match_id: p.apiMatchId })
      .eq("id", p.dbMatchId)
    if (!error) updated++
  }

  return { success: true, updated }
}

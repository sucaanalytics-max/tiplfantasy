"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSquad, fetchScorecard, fetchMatchPoints, fetchSeriesInfo, parseScorecardToStats, fuzzyMatchName, testMatchPointsEndpoint, SPORTMONKS_TEAM_MAP } from "@/lib/api/sportmonks"
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

  const { data: match } = await admin
    .from("matches")
    .select("team_home_id, team_away_id")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  // Load DB players for both teams (include cricapi_id for ID-based matching)
  const { data: dbPlayers } = await admin
    .from("players")
    .select("id, name, team_id, cricapi_id")
    .in("team_id", [match.team_home_id, match.team_away_id])

  if (!dbPlayers) return { error: "Failed to load players" }

  // Try match_points first — returns only players who actually played (the real Playing XI)
  const pointsResult = await fetchMatchPoints(cricapiMatchId)

  if (!pointsResult || pointsResult.totals.length === 0) {
    return {
      error: "Match points data not available yet. Playing XI auto-populates from match scorecard ~15 min after the match starts. Try again shortly.",
    }
  }

  // Build lookup maps
  const cricapiIdMap = new Map<string, { id: string; team_id: string }>()
  const nameMap = new Map<string, string>()
  for (const p of dbPlayers) {
    if (p.cricapi_id) {
      cricapiIdMap.set(p.cricapi_id, { id: p.id, team_id: p.team_id })
    }
    const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
    nameMap.set(norm, p.id)
  }

  // Match API players to DB — prefer cricapi_id, fallback to fuzzy name
  const matched = new Map<string, string>() // player_id → team_id
  const unmatched: string[] = []

  for (const apiPlayer of pointsResult.totals) {
    const byId = cricapiIdMap.get(apiPlayer.id)
    if (byId) {
      matched.set(byId.id, byId.team_id)
      continue
    }
    const dbId = fuzzyMatchName(apiPlayer.name, nameMap)
    if (dbId) {
      const p = dbPlayers.find((pl) => pl.id === dbId)
      if (p) matched.set(dbId, p.team_id)
    } else {
      unmatched.push(apiPlayer.name)
    }
  }

  if (matched.size === 0) {
    return { error: "No players matched from match_points response" }
  }

  // Validate: must be exactly 11 per team (22 total)
  const byTeam = new Map<string, string[]>()
  for (const [pid, tid] of matched) {
    const list = byTeam.get(tid) ?? []
    list.push(pid)
    byTeam.set(tid, list)
  }

  const teamCounts = [...byTeam.values()].map((v) => v.length)
  if (teamCounts.length !== 2 || teamCounts.some((c) => c !== 11)) {
    return {
      error: `Partial data (${matched.size} players: ${teamCounts.join(" + ")}${unmatched.length > 0 ? `, ${unmatched.length} unmatched: ${unmatched.join(", ")}` : ""}). Match may still be in progress — try again in a few minutes.`,
    }
  }

  await admin.from("playing_xi").delete().eq("match_id", matchId)
  const rows = [...matched.entries()].map(([pid, tid]) => ({
    match_id: matchId,
    player_id: pid,
    team_id: tid,
  }))
  const { error: insertError } = await admin.from("playing_xi").insert(rows)
  if (insertError) return { error: `Failed to insert Playing XI: ${insertError.message}` }

  return { success: true, matched: matched.size, unmatched }
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
  if (!innings) return { error: "Failed to fetch scorecard from SportMonks" }

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
    return { error: "No players matched. Check that match teams are correct and player IDs are mapped." }
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
  venue: string
  dbMatchId: string | null
  matchNumber: number | null
  alreadySet: boolean
  isNew: boolean
  teamHomeId: string | null
  teamAwayId: string | null
  proposedMatchNumber: number | null
}

/**
 * Preview: fetch all IPL 2026 fixtures from SportMonks and propose cricapi_match_id mappings.
 * For API matches with no DB counterpart, attempts to resolve teams and proposes new row creation.
 * Does NOT write to DB.
 */
export async function previewSeriesImport(seriesId: string): Promise<{
  proposals?: SeriesImportProposal[]
  error?: string
}> {
  await requireAdmin()
  const admin = createAdminClient()

  // SportMonks: seriesId is ignored — we always fetch IPL 2026 season
  const seasonFixtures = await fetchSeriesInfo()
  if (!seasonFixtures) return { error: "Failed to fetch season fixtures from SportMonks." }

  const [{ data: dbMatches }, { data: teams }] = await Promise.all([
    admin
      .from("matches")
      .select("id, match_number, start_time, cricapi_match_id, team_home:teams!team_home_id(name, short_name), team_away:teams!team_away_id(name, short_name)")
      .order("match_number"),
    admin.from("teams").select("id, name, short_name"),
  ])
  if (!dbMatches) return { error: "Failed to load matches from DB" }

  const allTeams = teams ?? []
  const maxMatchNumber = dbMatches.reduce((m, d) => Math.max(m, d.match_number), 0)

  // Build SportMonks team_id → DB team_id lookup
  const smTeamToDbTeam = new Map<number, string>()
  for (const [smId, shortName] of Object.entries(SPORTMONKS_TEAM_MAP)) {
    const dbTeam = allTeams.find((t) => t.short_name === shortName)
    if (dbTeam) smTeamToDbTeam.set(Number(smId), dbTeam.id)
  }

  const proposals: SeriesImportProposal[] = []
  const newProposals: SeriesImportProposal[] = []

  for (const fixture of seasonFixtures) {
    const fixtureId = String(fixture.id)
    const apiDate = new Date(fixture.starting_at).getTime()
    const homeCode = SPORTMONKS_TEAM_MAP[fixture.localteam_id] ?? "?"
    const awayCode = SPORTMONKS_TEAM_MAP[fixture.visitorteam_id] ?? "?"
    const apiName = `${homeCode} vs ${awayCode}, ${fixture.round}`
    const apiTeams = [homeCode, awayCode]

    // Find DB match by date proximity (within 24h) + team ID match
    const dbHomeId = smTeamToDbTeam.get(fixture.localteam_id)
    const dbAwayId = smTeamToDbTeam.get(fixture.visitorteam_id)

    let bestDb: (typeof dbMatches)[0] | null = null
    for (const dbm of dbMatches) {
      const home = dbm.team_home as unknown as { name: string; short_name: string }
      const away = dbm.team_away as unknown as { name: string; short_name: string }
      const dbDate = new Date(dbm.start_time).getTime()
      const withinDay = Math.abs(apiDate - dbDate) < 24 * 60 * 60 * 1000
      const teamMatch = (home.short_name === homeCode && away.short_name === awayCode) ||
                         (home.short_name === awayCode && away.short_name === homeCode)

      if (withinDay && teamMatch) {
        bestDb = dbm
        break
      }
    }

    if (bestDb) {
      proposals.push({
        apiMatchId: fixtureId,
        apiName,
        dateTimeGMT: fixture.starting_at,
        venue: "",
        teams: apiTeams,
        dbMatchId: bestDb.id,
        matchNumber: bestDb.match_number,
        alreadySet: bestDb.cricapi_match_id === fixtureId,
        isNew: false,
        teamHomeId: null,
        teamAwayId: null,
        proposedMatchNumber: null,
      })
    } else if (dbHomeId && dbAwayId) {
      newProposals.push({
        apiMatchId: fixtureId,
        apiName,
        dateTimeGMT: fixture.starting_at,
        venue: "",
        teams: apiTeams,
        dbMatchId: null,
        matchNumber: null,
        alreadySet: false,
        isNew: true,
        teamHomeId: dbHomeId,
        teamAwayId: dbAwayId,
        proposedMatchNumber: null,
      })
    } else {
      proposals.push({
        apiMatchId: fixtureId,
        apiName,
        dateTimeGMT: fixture.starting_at,
        venue: "",
        teams: apiTeams,
        dbMatchId: null,
        matchNumber: null,
        alreadySet: false,
        isNew: false,
        teamHomeId: null,
        teamAwayId: null,
        proposedMatchNumber: null,
      })
    }
  }

  // Assign proposed match numbers to new matches in date order
  newProposals.sort((a, b) => new Date(a.dateTimeGMT).getTime() - new Date(b.dateTimeGMT).getTime())
  newProposals.forEach((p, i) => { p.proposedMatchNumber = maxMatchNumber + i + 1 })

  return { proposals: [...proposals, ...newProposals] }
}

/** Admin diagnostic: fetch raw /match_points response to verify Fantasy API access */
export async function testMatchPoints(matchId: string): Promise<{ data?: unknown; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: match } = await admin
    .from("matches")
    .select("cricapi_match_id")
    .eq("id", matchId)
    .single()

  if (!match?.cricapi_match_id) {
    return { error: "No fixture ID set for this match" }
  }

  const data = await testMatchPointsEndpoint(match.cricapi_match_id)
  return { data }
}

/** Confirm: write cricapi_match_id for approved proposals, and insert new match rows */
export async function confirmSeriesImport(
  toUpdate: Array<{ dbMatchId: string; apiMatchId: string }>,
  toCreate: Array<{
    apiMatchId: string
    teamHomeId: string
    teamAwayId: string
    venue: string
    startTime: string
    matchNumber: number
  }>
): Promise<{ success?: boolean; updated?: number; created?: number; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  let updated = 0
  for (const p of toUpdate) {
    const { error } = await admin
      .from("matches")
      .update({ cricapi_match_id: p.apiMatchId })
      .eq("id", p.dbMatchId)
    if (!error) updated++
  }

  let created = 0
  if (toCreate.length > 0) {
    const rows = toCreate.map((p) => ({
      match_number: p.matchNumber,
      team_home_id: p.teamHomeId,
      team_away_id: p.teamAwayId,
      venue: p.venue,
      start_time: p.startTime,
      status: "upcoming",
      cricapi_match_id: p.apiMatchId,
    }))
    const { error } = await admin.from("matches").insert(rows)
    if (error) return { error: `Failed to create matches: ${error.message}` }
    created = rows.length
  }

  return { success: true, updated, created }
}

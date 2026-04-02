"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSquad, fetchScorecard, fetchMatchPoints, fetchSeriesInfo, parseScorecardToStats, fuzzyMatchName, testMatchPointsEndpoint, SPORTMONKS_TEAM_MAP } from "@/lib/api/sportmonks"
import { savePlayerScores, calculateMatchPoints } from "@/actions/scoring"
import type { PlayerStats } from "@/lib/scoring"
import { formatMatchMemo, detectBanterEvents, detectRankBanter, generateBanter, type MemoHighlights, type BanterEvent } from "@/lib/banter"
import { buildAnalysis, formatPreMatchWhatsApp, type PreMatchAnalysis } from "@/lib/match-analysis"

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

  // Try two sources: 1) match_points (has scorecard data), 2) lineup-only (pre-match)
  let apiPlayers: Array<{ id: string; name: string }> = []

  const pointsResult = await fetchMatchPoints(cricapiMatchId)
  if (pointsResult && pointsResult.totals.length > 0) {
    apiPlayers = pointsResult.totals
  } else {
    // Fallback: fetch lineup (available before match starts, once announced)
    const squad = await fetchSquad(cricapiMatchId)
    if (squad && squad.length > 0) {
      apiPlayers = squad.map((p) => ({ id: p.id, name: p.name }))
    }
  }

  if (apiPlayers.length === 0) {
    return {
      error: "Lineup data not available yet from Sportmonks. Try again closer to match time or after toss.",
    }
  }

  // Match API players to DB — prefer cricapi_id, fallback to fuzzy name
  const matched = new Map<string, string>() // player_id → team_id
  const unmatched: string[] = []

  for (const apiPlayer of apiPlayers) {
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
    return { error: "No players matched from API response" }
  }

  // Validate: 11-12 per team (impact sub allowed), 2 teams
  const byTeam = new Map<string, string[]>()
  for (const [pid, tid] of matched) {
    const list = byTeam.get(tid) ?? []
    list.push(pid)
    byTeam.set(tid, list)
  }

  const teamCounts = [...byTeam.values()].map((v) => v.length)
  if (teamCounts.length !== 2 || teamCounts.some((c) => c < 11 || c > 12)) {
    return {
      error: `Unexpected team sizes (${matched.size} players: ${teamCounts.join(" + ")}${unmatched.length > 0 ? `, ${unmatched.length} unmatched: ${unmatched.join(", ")}` : ""}). Try again in a few minutes.`,
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

/** Generate a rich post-match memo with highlights + banter for WhatsApp sharing */
export async function getMatchMemo(matchId: string): Promise<{ memo?: string; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: match } = await admin
    .from("matches")
    .select("match_number, result_summary, team_home:teams!team_home_id(short_name), team_away:teams!team_away_id(short_name)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  // Get league member IDs (first league — Tusk)
  const { data: leagues } = await admin.from("leagues").select("id").limit(1)
  const leagueId = leagues?.[0]?.id
  let memberIds: string[] = []
  if (leagueId) {
    const { data: members } = await admin.from("league_members").select("user_id").eq("league_id", leagueId)
    memberIds = (members ?? []).map((m) => m.user_id)
  }

  const [{ data: userScores }, { data: banter }, { data: playerScores }, { data: selectionsRaw }] = await Promise.all([
    admin.from("user_match_scores")
      .select("user_id, total_points, rank, captain_points, profile:profiles(display_name)")
      .eq("match_id", matchId)
      .in("user_id", memberIds.length > 0 ? memberIds : ["__none__"])
      .order("total_points", { ascending: false }),
    admin.from("match_banter")
      .select("message")
      .eq("match_id", matchId)
      .in("user_id", memberIds.length > 0 ? memberIds : ["__none__"])
      .order("created_at", { ascending: true })
      .limit(10),
    admin.from("match_player_scores")
      .select("player_id, runs, balls_faced, wickets, overs_bowled, runs_conceded, catches, stumpings, fantasy_points, player:players(name)")
      .eq("match_id", matchId)
      .order("fantasy_points", { ascending: false }),
    admin.from("selections")
      .select("user_id, captain_id, selection_players(player_id), profile:profiles(display_name), captain:players!selections_captain_id_fkey(name)")
      .eq("match_id", matchId)
      .in("user_id", memberIds.length > 0 ? memberIds : ["__none__"]),
  ])

  const home = (match.team_home as unknown as { short_name: string }).short_name
  const away = (match.team_away as unknown as { short_name: string }).short_name

  // Captain name map
  const captainMap = new Map<string, string>()
  for (const s of selectionsRaw ?? []) {
    if (s.captain_id) {
      captainMap.set(s.user_id, (s.captain as unknown as { name: string })?.name ?? "—")
    }
  }

  const rankedUsers = (userScores ?? []).map((s) => ({
    name: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
    points: Number(s.total_points),
    captainName: captainMap.get(s.user_id) ?? null,
  }))

  // Build highlights
  const highlights: MemoHighlights = {}
  const ps = playerScores ?? []

  // Top scorer (by runs)
  const topBat = [...ps].sort((a, b) => b.runs - a.runs)[0]
  if (topBat && topBat.runs > 0) {
    highlights.topScorer = {
      name: (topBat.player as unknown as { name: string })?.name ?? "?",
      runs: topBat.runs,
      balls: topBat.balls_faced,
      pts: Number(topBat.fantasy_points),
    }
  }

  // Best bowler (by wickets, then economy)
  const topBowl = [...ps].filter((p) => Number(p.overs_bowled) > 0).sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded)[0]
  if (topBowl && topBowl.wickets > 0) {
    highlights.bestBowler = {
      name: (topBowl.player as unknown as { name: string })?.name ?? "?",
      wickets: topBowl.wickets,
      runs: topBowl.runs_conceded,
      overs: Number(topBowl.overs_bowled),
      pts: Number(topBowl.fantasy_points),
    }
  }

  // Best fielder
  const topFielder = [...ps].sort((a, b) => (b.catches + b.stumpings) - (a.catches + a.stumpings))[0]
  if (topFielder && (topFielder.catches + topFielder.stumpings) >= 2) {
    highlights.bestFielder = {
      name: (topFielder.player as unknown as { name: string })?.name ?? "?",
      catches: topFielder.catches + topFielder.stumpings,
    }
  }

  // Highest fantasy points player
  const topFantasy = ps[0]
  if (topFantasy) {
    highlights.highestFantasy = {
      name: (topFantasy.player as unknown as { name: string })?.name ?? "?",
      pts: Number(topFantasy.fantasy_points),
    }
  }

  // Best captain pick (highest captain_points)
  const bestCapUser = [...(userScores ?? [])].sort((a, b) => Number(b.captain_points) - Number(a.captain_points))[0]
  if (bestCapUser && Number(bestCapUser.captain_points) > 0) {
    const capName = captainMap.get(bestCapUser.user_id)
    const ownerName = (bestCapUser.profile as unknown as { display_name: string })?.display_name ?? "?"
    const capPts = Number(bestCapUser.captain_points)
    if (capName) {
      highlights.bestCaptainPick = {
        playerName: capName,
        ownerName,
        basePts: Math.round(capPts),
        effectivePts: Math.round(capPts * 2),
      }
    }
  }

  // Differential pick (high points, picked by few)
  const selectionCounts = new Map<string, number>()
  for (const s of selectionsRaw ?? []) {
    for (const sp of (s.selection_players as { player_id: string }[])) {
      selectionCounts.set(sp.player_id, (selectionCounts.get(sp.player_id) ?? 0) + 1)
    }
  }
  const totalUsers = (selectionsRaw ?? []).length
  const differentials = ps
    .filter((p) => {
      const count = selectionCounts.get(p.player_id) ?? 0
      return count > 0 && count <= Math.ceil(totalUsers * 0.4) && Number(p.fantasy_points) >= 40
    })
    .sort((a, b) => Number(b.fantasy_points) - Number(a.fantasy_points))
  if (differentials[0]) {
    highlights.differentialPick = {
      playerName: (differentials[0].player as unknown as { name: string })?.name ?? "?",
      pickedBy: selectionCounts.get(differentials[0].player_id) ?? 0,
      pts: Number(differentials[0].fantasy_points),
    }
  }

  const banterMessages = (banter ?? []).map((b) => b.message)

  const memo = formatMatchMemo(
    match.match_number,
    home,
    away,
    match.result_summary,
    rankedUsers,
    banterMessages,
    highlights,
  )

  return { memo }
}

/** Admin: generate banter for a match (retroactive or live) */
export async function generateMatchBanter(matchId: string): Promise<{ generated?: number; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  // Load player scores
  const { data: playerScores } = await admin
    .from("match_player_scores")
    .select("player_id, runs, balls_faced, wickets, overs_bowled, runs_conceded, fantasy_points, player:players(name)")
    .eq("match_id", matchId)

  if (!playerScores || playerScores.length === 0) return { error: "No player scores found" }

  // Load selections with profiles
  const { data: selections } = await admin
    .from("selections")
    .select("user_id, captain_id, vice_captain_id, selection_players(player_id), profile:profiles(display_name)")
    .eq("match_id", matchId)

  if (!selections) return { error: "No selections found" }

  // Load user match scores for rank banter
  const { data: userScores } = await admin
    .from("user_match_scores")
    .select("user_id, total_points, rank")
    .eq("match_id", matchId)
    .order("total_points", { ascending: false })

  const psMap = new Map(playerScores.map((ps) => [ps.player_id, ps]))
  const banterRows: Array<{ match_id: string; user_id: string | null; player_id: string | null; message: string; event_type: string }> = []

  // Build: who owns each player + who captained/VC'd them
  const playerOwners = new Map<string, string[]>()       // player_id → member names
  const playerCaptains = new Map<string, string[]>()     // player_id → captain owner names
  const playerVCs = new Map<string, string[]>()          // player_id → VC owner names
  const nameMap = new Map<string, string>()              // user_id → display name

  for (const sel of selections) {
    const memberName = (sel.profile as unknown as { display_name: string })?.display_name ?? "Unknown"
    nameMap.set(sel.user_id, memberName)
    const playerIds = (sel.selection_players as { player_id: string }[]).map((sp) => sp.player_id)
    for (const pid of playerIds) {
      const owners = playerOwners.get(pid) ?? []
      owners.push(memberName)
      playerOwners.set(pid, owners)
      if (sel.captain_id === pid) {
        const caps = playerCaptains.get(pid) ?? []
        caps.push(memberName)
        playerCaptains.set(pid, caps)
      }
      if (sel.vice_captain_id === pid) {
        const vcs = playerVCs.get(pid) ?? []
        vcs.push(memberName)
        playerVCs.set(pid, vcs)
      }
    }
  }

  // For each player, detect events ONCE, group all owners into one message
  for (const [pid, ps] of psMap) {
    const owners = playerOwners.get(pid)
    if (!owners || owners.length === 0) continue
    const playerName = (ps.player as unknown as { name: string })?.name ?? "Unknown"

    // Player-level events (duck, low SR, etc.) — shared by ALL owners
    const playerEvents = detectBanterEvents(
      {
        player_id: pid, playerName,
        runs: ps.runs, balls_faced: ps.balls_faced, wickets: ps.wickets,
        overs_bowled: Number(ps.overs_bowled), runs_conceded: ps.runs_conceded,
        fantasy_points: Number(ps.fantasy_points),
      },
      { memberName: owners[0], isCaptain: false, isViceCaptain: false }
    )

    // Filter to non-captain/VC events (shared across all owners)
    const sharedEvents = playerEvents.filter((e) => !["captain_fail", "captain_haul", "vc_fail"].includes(e.type))
    for (const evt of sharedEvents) {
      evt.memberNames = owners
      const msg = generateBanter(evt)
      if (msg) banterRows.push({ match_id: matchId, user_id: null, player_id: pid, message: msg, event_type: evt.type })
    }

    // Captain-specific events — one per captain owner
    const captainOwners = playerCaptains.get(pid) ?? []
    if (captainOwners.length > 0 && Number(ps.fantasy_points) < 15) {
      const evt: BanterEvent = { type: "captain_fail", memberNames: captainOwners, memberName: captainOwners[0], playerName, detail: `${Number(ps.fantasy_points)} pts` }
      const msg = generateBanter(evt)
      if (msg) banterRows.push({ match_id: matchId, user_id: null, player_id: pid, message: msg, event_type: "captain_fail" })
    } else if (captainOwners.length > 0 && Number(ps.fantasy_points) >= 60) {
      const evt: BanterEvent = { type: "captain_haul", memberNames: captainOwners, memberName: captainOwners[0], playerName, detail: `${Number(ps.fantasy_points)} pts at 2x` }
      const msg = generateBanter(evt)
      if (msg) banterRows.push({ match_id: matchId, user_id: null, player_id: pid, message: msg, event_type: "captain_haul" })
    }

    // VC-specific events
    const vcOwners = playerVCs.get(pid) ?? []
    if (vcOwners.length > 0 && Number(ps.fantasy_points) < 10) {
      const evt: BanterEvent = { type: "vc_fail", memberNames: vcOwners, memberName: vcOwners[0], playerName, detail: `${Number(ps.fantasy_points)} pts` }
      const msg = generateBanter(evt)
      if (msg) banterRows.push({ match_id: matchId, user_id: null, player_id: pid, message: msg, event_type: "vc_fail" })
    }
  }

  // Rank banter — user-specific
  if (userScores && userScores.length >= 3) {
    for (const us of userScores) {
      const memberName = nameMap.get(us.user_id) ?? "Unknown"
      const rank = us.rank ?? 0
      const evt = detectRankBanter(memberName, rank, userScores.length)
      if (evt) {
        const msg = generateBanter(evt)
        if (msg) banterRows.push({ match_id: matchId, user_id: us.user_id, player_id: null, message: msg, event_type: evt.type })
      }
    }
  }

  if (banterRows.length === 0) return { generated: 0 }

  // Upsert (dedup by unique index)
  // Delete existing banter for this match before regenerating
  await admin.from("match_banter").delete().eq("match_id", matchId)
  const { error } = await admin.from("match_banter").insert(banterRows)
  if (error) return { error: error.message }

  return { generated: banterRows.length }
}

export async function getPreMatchAnalysis(matchId: string, leagueId: string): Promise<{ analysis?: PreMatchAnalysis; whatsapp?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // Admin shortcut: __first__ picks the user's first league
  let resolvedLeagueId = leagueId
  if (leagueId === "__first__") {
    const { data: firstMembership } = await admin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()
    if (!firstMembership) return { error: "Not in any league" }
    resolvedLeagueId = firstMembership.league_id
  } else {
    // Verify user is a member of this league
    const { data: membership } = await admin
      .from("league_members")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single()
    if (!membership) return { error: "Not a league member" }
  }

  // Get match info
  const { data: match } = await admin
    .from("matches")
    .select("id, match_number, status, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  // Only allow analysis when teams are locked
  if (match.status === "upcoming") return { error: "Teams not locked yet" }

  // Get league members
  const { data: members } = await admin
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", resolvedLeagueId)
  if (!members || members.length === 0) return { error: "No league members" }

  const memberIds = members.map((m) => m.user_id)
  const nameMap = new Map(members.map((m) => [m.user_id, (m.profiles as unknown as { display_name: string })?.display_name ?? "Unknown"]))

  // Get selections for this match, filtered to league members
  const { data: selections } = await admin
    .from("selections")
    .select("user_id, captain_id, vice_captain_id, selection_players(player_id)")
    .eq("match_id", matchId)
    .in("user_id", memberIds)

  if (!selections || selections.length === 0) return { error: "No selections found" }

  // Get all player details
  const allPlayerIds = new Set<string>()
  for (const sel of selections) {
    if (sel.captain_id) allPlayerIds.add(sel.captain_id as string)
    if (sel.vice_captain_id) allPlayerIds.add(sel.vice_captain_id as string)
    for (const sp of sel.selection_players as { player_id: string }[]) {
      allPlayerIds.add(sp.player_id)
    }
  }

  const { data: players } = await admin
    .from("players")
    .select("id, name, role, team:teams(short_name)")
    .in("id", [...allPlayerIds])

  if (!players) return { error: "Failed to load players" }

  const playerLookup = new Map(players.map((p) => [p.id, { name: p.name, role: p.role, team: (p.team as unknown as { short_name: string })?.short_name ?? "?" }]))

  // Build selection data for analysis
  const selectionData = selections.map((sel) => {
    const captainInfo = sel.captain_id ? playerLookup.get(sel.captain_id as string) : null
    const vcInfo = sel.vice_captain_id ? playerLookup.get(sel.vice_captain_id as string) : null
    return {
      displayName: nameMap.get(sel.user_id) ?? "Unknown",
      captainId: sel.captain_id as string | null,
      viceCaptainId: sel.vice_captain_id as string | null,
      captainName: captainInfo?.name ?? null,
      vcName: vcInfo?.name ?? null,
      players: (sel.selection_players as { player_id: string }[]).map((sp) => {
        const info = playerLookup.get(sp.player_id)
        return { id: sp.player_id, name: info?.name ?? "Unknown", role: info?.role ?? "?", team: info?.team ?? "?" }
      }),
    }
  })

  const home = (match.team_home as unknown as { short_name: string })?.short_name ?? "?"
  const away = (match.team_away as unknown as { short_name: string })?.short_name ?? "?"
  const matchLabel = `Match ${match.match_number}: ${home} vs ${away}`

  const excludeNames = ["Mark Kleinhans"]
  const analysis = buildAnalysis(matchLabel, selectionData, excludeNames)
  const whatsapp = formatPreMatchWhatsApp(analysis)

  return { analysis, whatsapp }
}

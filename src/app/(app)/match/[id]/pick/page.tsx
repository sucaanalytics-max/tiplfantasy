export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PlayerWithTeam, MatchWithTeams, PlayerVenueStats, PlayerVsTeamStats, TiplMatchEntry, TiplSeasonAggregates } from "@/lib/types"
import { PickTeamClient } from "./pick-team-client"

export default async function PickTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ admin?: string }>
}) {
  const { id: matchId } = await params
  const { admin: adminUserId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Admin mode: verify the user is actually an admin
  const isAdminMode = !!adminUserId
  if (isAdminMode) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
    if (!profile?.is_admin) redirect("/")
  }

  const targetUserId = isAdminMode ? adminUserId : user.id
  const db = isAdminMode ? createAdminClient() : supabase

  // Fetch match with teams
  const { data: match } = await db
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(*), team_away:teams!matches_team_away_id_fkey(*)")
    .eq("id", matchId)
    .single()

  if (!match) redirect("/matches")

  const typedMatch = match as unknown as MatchWithTeams

  // Non-admin: redirect if match isn't upcoming
  if (!isAdminMode) {
    if (typedMatch.status !== "upcoming") {
      if (typedMatch.status === "completed" || typedMatch.status === "no_result") {
        redirect(`/match/${matchId}/scores`)
      }
      redirect("/matches")
    }
    if (new Date(typedMatch.start_time) <= new Date()) {
      redirect("/matches")
    }
  }

  // Phase 1: All independent queries in parallel — eliminates sequential waterfalls
  const [
    { data: players },
    { data: playingXI },
    { data: existingSelection },
    { count: totalSelections },
    { data: playerCounts },
    { data: recentMatches },
  ] = await Promise.all([
    // All players from both teams
    supabase
      .from("players")
      .select("*, team:teams(*)")
      .or(`team_id.eq.${typedMatch.team_home_id},team_id.eq.${typedMatch.team_away_id}`)
      .eq("is_active", true)
      .order("role")
      .order("name"),

    // Playing XI if announced
    supabase.from("playing_xi").select("player_id").eq("match_id", matchId),

    // Existing selection with players joined
    db
      .from("selections")
      .select("id, captain_id, vice_captain_id, selection_players(player_id)")
      .eq("user_id", targetUserId)
      .eq("match_id", matchId)
      .maybeSingle(),

    // Selection count for pct calculation — now runs in parallel (was sequential gating)
    supabase
      .from("selections")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId),

    // All selection_players for this match — now runs in parallel (was Waterfall B)
    supabase
      .from("selection_players")
      .select("player_id, selection:selections!inner(match_id)")
      .eq("selection.match_id", matchId)
      .limit(200),

    // All completed matches (for season stats + match log)
    supabase
      .from("matches")
      .select("id, match_number, team_home_id, team_away_id, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
      .eq("status", "completed")
      .order("match_number", { ascending: true }),
  ])

  const playingXIIds = new Set((playingXI ?? []).map((p) => p.player_id))

  // Resolve selection state from joined query (no second round-trip needed)
  const selectionWithPlayers = existingSelection as {
    id: string
    captain_id: string | null
    vice_captain_id: string | null
    selection_players: Array<{ player_id: string }>
  } | null
  const selectedPlayerIds = (selectionWithPlayers?.selection_players ?? []).map((sp) => sp.player_id)

  // Compute selection percentages in JS from already-fetched data
  const selectionPcts: Record<string, number> = {}
  if (totalSelections && totalSelections > 0) {
    const countMap = new Map<string, number>()
    for (const pc of playerCounts ?? []) {
      countMap.set(pc.player_id, (countMap.get(pc.player_id) ?? 0) + 1)
    }
    for (const [pid, count] of countMap) {
      selectionPcts[pid] = Math.round((count / totalSelections) * 100)
    }
  }

  const playerIds = (players ?? []).map((p: { id: string }) => p.id)
  const allCompletedMatches = recentMatches ?? []
  const allCompletedMatchIds = allCompletedMatches.map((m) => m.id)
  const homeShort = typedMatch.team_home.short_name
  const awayShort = typedMatch.team_away.short_name

  // Build match info map for match log opponent resolution
  type MatchInfo = { matchNumber: number; homeTeamId: string; homeShort: string; awayShort: string }
  const matchInfoMap = new Map<string, MatchInfo>()
  for (const m of allCompletedMatches) {
    matchInfoMap.set(m.id, {
      matchNumber: m.match_number,
      homeTeamId: m.team_home_id,
      homeShort: (m.team_home as unknown as { short_name: string })?.short_name ?? "?",
      awayShort: (m.team_away as unknown as { short_name: string })?.short_name ?? "?",
    })
  }

  // Player team lookup for opponent resolution in match log
  const playerTeamMap = new Map<string, string>()
  for (const p of (players ?? []) as unknown as PlayerWithTeam[]) {
    playerTeamMap.set(p.id, p.team_id)
  }

  // Phase 2: All stats queries in parallel (depend on playerIds from Phase 1)
  const [
    { data: tiplScoresRaw },
    { data: venueStatsRaw },
    { data: vsTeamStatsRaw },
  ] = await Promise.all([
    // Full TIPL season scores — ALL players for rank computation
    allCompletedMatchIds.length > 0
      ? supabase
          .from("match_player_scores")
          .select("player_id, match_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, maidens, catches, stumpings, run_outs, fantasy_points, breakdown, dismissal")
          .in("match_id", allCompletedMatchIds)
      : Promise.resolve({ data: [] as never[] }),

    // Venue stats for this match's venue
    supabase
      .from("player_venue_stats")
      .select("*")
      .eq("venue", typedMatch.venue)
      .in("player_id", playerIds),

    // vs-team stats for both opponents
    supabase
      .from("player_vs_team_stats")
      .select("*")
      .in("opponent_team", [homeShort, awayShort])
      .in("player_id", playerIds),
  ])

  const venueStatsMap: Record<string, PlayerVenueStats> = {}
  for (const vs of venueStatsRaw ?? []) {
    venueStatsMap[vs.player_id] = vs as PlayerVenueStats
  }

  const vsTeamStatsMap: Record<string, PlayerVsTeamStats> = {}
  for (const vt of vsTeamStatsRaw ?? []) {
    vsTeamStatsMap[vt.player_id] = vt as PlayerVsTeamStats
  }

  // --- Aggregate TIPL season stats + build match log ---
  type Accumulator = {
    matches: number; innings: number; runs: number; ballsFaced: number
    fours: number; sixes: number; highestScore: number; notOuts: number
    wickets: number; oversBowled: number; runsConceded: number; maidens: number
    bestWickets: number; bestRunsConceded: number
    catches: number; stumpings: number; runOuts: number
    totalFantasyPoints: number
  }

  const aggMap = new Map<string, Accumulator>()
  const matchLogMap = new Map<string, TiplMatchEntry[]>()
  const playerIdSet = new Set(playerIds)

  for (const s of tiplScoresRaw ?? []) {
    // Aggregate for ALL players (for ranks)
    let agg = aggMap.get(s.player_id)
    if (!agg) {
      agg = {
        matches: 0, innings: 0, runs: 0, ballsFaced: 0,
        fours: 0, sixes: 0, highestScore: 0, notOuts: 0,
        wickets: 0, oversBowled: 0, runsConceded: 0, maidens: 0,
        bestWickets: 0, bestRunsConceded: 0,
        catches: 0, stumpings: 0, runOuts: 0,
        totalFantasyPoints: 0,
      }
      aggMap.set(s.player_id, agg)
    }

    agg.matches++
    agg.runs += s.runs
    agg.ballsFaced += s.balls_faced
    agg.fours += s.fours
    agg.sixes += s.sixes
    agg.wickets += s.wickets
    agg.oversBowled += Number(s.overs_bowled)
    agg.runsConceded += s.runs_conceded
    agg.maidens += s.maidens
    agg.catches += s.catches
    agg.stumpings += s.stumpings
    agg.runOuts += s.run_outs
    agg.totalFantasyPoints += Number(s.fantasy_points)
    if (s.balls_faced > 0) agg.innings++
    if (s.dismissal === "not out") agg.notOuts++
    if (s.runs > agg.highestScore) agg.highestScore = s.runs
    if (s.wickets > agg.bestWickets || (s.wickets === agg.bestWickets && s.runs_conceded < agg.bestRunsConceded)) {
      agg.bestWickets = s.wickets
      agg.bestRunsConceded = s.runs_conceded
    }

    // Build match log only for current match squad players
    if (playerIdSet.has(s.player_id)) {
      const mInfo = matchInfoMap.get(s.match_id)
      if (mInfo) {
        const teamId = playerTeamMap.get(s.player_id)
        const opponent = teamId === mInfo.homeTeamId ? mInfo.awayShort : mInfo.homeShort

        if (!matchLogMap.has(s.player_id)) matchLogMap.set(s.player_id, [])
        matchLogMap.get(s.player_id)!.push({
          matchNumber: mInfo.matchNumber,
          opponent,
          runs: s.runs,
          ballsFaced: s.balls_faced,
          fours: s.fours,
          sixes: s.sixes,
          wickets: s.wickets,
          oversBowled: Number(s.overs_bowled),
          runsConceded: s.runs_conceded,
          maidens: s.maidens,
          catches: s.catches,
          stumpings: s.stumpings,
          runOuts: s.run_outs,
          fantasyPoints: Number(s.fantasy_points),
          breakdown: (s.breakdown as Record<string, number>) ?? {},
        })
      }
    }
  }

  // Sort match logs by match number ascending
  for (const entries of matchLogMap.values()) {
    entries.sort((a, b) => a.matchNumber - b.matchNumber)
  }

  // Compute ranks (dense ranking)
  const allAggs = [...aggMap.entries()]
  const totalPlayers = allAggs.length

  const runsRankMap = new Map<string, number>()
  const wicketsRankMap = new Map<string, number>()
  const fantasyRankMap = new Map<string, number>()

  // Runs rank
  const byRuns = allAggs.filter(([, a]) => a.runs > 0).sort(([, a], [, b]) => b.runs - a.runs)
  let rank = 0, prevVal = -1
  for (const [pid, a] of byRuns) {
    if (a.runs !== prevVal) { rank++; prevVal = a.runs }
    runsRankMap.set(pid, rank)
  }

  // Wickets rank
  const byWickets = allAggs.filter(([, a]) => a.wickets > 0).sort(([, a], [, b]) => b.wickets - a.wickets)
  rank = 0; prevVal = -1
  for (const [pid, a] of byWickets) {
    if (a.wickets !== prevVal) { rank++; prevVal = a.wickets }
    wicketsRankMap.set(pid, rank)
  }

  // Fantasy rank
  const byFantasy = [...allAggs].sort(([, a], [, b]) => b.totalFantasyPoints - a.totalFantasyPoints)
  rank = 0; prevVal = -1
  for (const [pid, a] of byFantasy) {
    if (a.totalFantasyPoints !== prevVal) { rank++; prevVal = a.totalFantasyPoints }
    fantasyRankMap.set(pid, rank)
  }

  // Build final maps for current match squad players only
  const tiplMatchLogMap: Record<string, TiplMatchEntry[]> = {}
  const tiplSeasonStatsMap: Record<string, TiplSeasonAggregates> = {}

  for (const pid of playerIds) {
    const entries = matchLogMap.get(pid)
    if (entries) tiplMatchLogMap[pid] = entries

    const agg = aggMap.get(pid)
    if (agg) {
      tiplSeasonStatsMap[pid] = {
        ...agg,
        avgFantasyPoints: agg.matches > 0 ? Math.round(agg.totalFantasyPoints / agg.matches) : 0,
        runsRank: runsRankMap.get(pid) ?? null,
        wicketsRank: wicketsRankMap.get(pid) ?? null,
        fantasyRank: fantasyRankMap.get(pid) ?? null,
        totalPlayers,
      }
    }
  }

  return (
    <PickTeamClient
      match={typedMatch}
      players={(players ?? []) as unknown as PlayerWithTeam[]}
      playingXIIds={Array.from(playingXIIds)}
      initialSelectedIds={selectedPlayerIds}
      initialCaptainId={selectionWithPlayers?.captain_id ?? null}
      initialViceCaptainId={selectionWithPlayers?.vice_captain_id ?? null}
      tiplMatchLog={tiplMatchLogMap}
      tiplSeasonStats={tiplSeasonStatsMap}
      venueStats={venueStatsMap}
      vsTeamStats={vsTeamStatsMap}
      selectionPcts={selectionPcts}
      adminUserId={isAdminMode ? targetUserId : undefined}
    />
  )
}

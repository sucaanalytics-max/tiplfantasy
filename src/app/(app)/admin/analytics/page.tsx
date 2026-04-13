export const dynamic = "force-dynamic"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageTransition } from "@/components/page-transition"
import { AnalyticsClient } from "./analytics-client"
import {
  computePlayerStats,
  computeRoleBenchmarks,
  computePowerRatings,
  computeMatchPreview,
  computeOptimalTeams,
  computeOwnership,
  computeDecisionQuality,
  computeVenueAnalytics,
  computeMatchScoringRows,
  computePaceSpinAnalysis,
  type RawPlayerScore,
  type RawSelection,
  type RawUserMatchScore,
  type PlayerInfo,
  type RawVenueStat,
  type RawVsTeamStat,
  type MatchInfo,
} from "@/lib/analytics"

export default async function AdminAnalyticsPage() {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  const admin = createAdminClient()

  // Phase 1: Get completed match IDs + next upcoming match
  const [completedRes, upcomingRes] = await Promise.all([
    admin
      .from("matches")
      .select("id, match_number, venue, team_home_id, team_away_id, start_time, status")
      .eq("status", "completed")
      .order("match_number", { ascending: true }),
    admin
      .from("matches")
      .select("id, match_number, venue, team_home_id, team_away_id, start_time, status")
      .eq("status", "upcoming")
      .order("start_time", { ascending: true })
      .limit(1),
  ])

  const completedMatches = completedRes.data ?? []
  const matchIds = completedMatches.map((m) => m.id)
  const nextMatch = upcomingRes.data?.[0] ?? null

  if (matchIds.length === 0) {
    return (
      <PageTransition>
        <div className="p-4 md:p-6 max-w-6xl text-center py-20">
          <p className="text-muted-foreground">
            No completed matches yet. Analytics will appear after scores are published.
          </p>
        </div>
      </PageTransition>
    )
  }

  // Phase 2: All parallel queries
  const [
    scoresRes,
    playersRes,
    selectionsRes,
    userScoresRes,
    profilesRes,
    venueStatsRes,
    vsTeamStatsRes,
    teamsRes,
    playingXIRes,
  ] = await Promise.all([
    admin
      .from("match_player_scores")
      .select("player_id, match_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, maidens, catches, stumpings, run_outs, fantasy_points, breakdown")
      .in("match_id", matchIds),
    admin
      .from("players")
      .select("id, name, role, team_id, team:teams(id, short_name, color)")
      .eq("is_active", true),
    admin
      .from("selections")
      .select("user_id, match_id, captain_id, vice_captain_id, is_auto_pick, selection_players(player_id)")
      .in("match_id", matchIds),
    admin
      .from("user_match_scores")
      .select("user_id, match_id, total_points, rank, captain_points, vc_points")
      .in("match_id", matchIds),
    admin.from("profiles").select("id, display_name"),
    admin.from("player_venue_stats").select("*"),
    admin.from("player_vs_team_stats").select("*"),
    admin.from("teams").select("id, short_name, color"),
    nextMatch
      ? admin.from("playing_xi").select("player_id").eq("match_id", nextMatch.id)
      : Promise.resolve({ data: null }),
  ])

  // Build lookup maps
  const teamMap = new Map<string, string>()
  const teamIdToName = new Map<string, string>()
  for (const t of teamsRes.data ?? []) {
    teamMap.set(t.id, t.short_name)
    teamIdToName.set(t.id, t.short_name)
  }

  // Fetch bowling_style separately — non-critical, won't break dashboard if column is missing
  const bowlingStyleMap = new Map<string, string>()
  try {
    const { data: bsData } = await admin.from("players").select("id, bowling_style").not("bowling_style", "eq", "unknown")
    for (const row of bsData ?? []) {
      if (row.bowling_style) bowlingStyleMap.set(row.id, row.bowling_style)
    }
  } catch { /* bowling_style column may not exist yet */ }

  const playerMap = new Map<string, PlayerInfo>()
  for (const p of playersRes.data ?? []) {
    const team = p.team as unknown as { id: string; short_name: string; color: string } | null
    playerMap.set(p.id, {
      id: p.id,
      name: p.name,
      role: p.role,
      team: team?.short_name ?? "?",
      teamId: p.team_id,
      color: team?.color ?? "#888",
      bowlingStyle: (bowlingStyleMap.get(p.id) as "pace" | "spin") ?? null,
    })
  }

  const profileMap = new Map<string, string>()
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, p.display_name)
  }

  // Transform raw data
  const rawScores: RawPlayerScore[] = (scoresRes.data ?? []).map((s) => ({
    player_id: s.player_id,
    match_id: s.match_id,
    runs: s.runs,
    balls_faced: s.balls_faced,
    fours: s.fours,
    sixes: s.sixes,
    wickets: s.wickets,
    overs_bowled: Number(s.overs_bowled),
    runs_conceded: s.runs_conceded,
    maidens: s.maidens,
    catches: s.catches,
    stumpings: s.stumpings,
    run_outs: s.run_outs,
    fantasy_points: Number(s.fantasy_points),
    breakdown: s.breakdown as Record<string, number> | null,
  }))

  const rawSelections: RawSelection[] = (selectionsRes.data ?? []).map((s) => ({
    user_id: s.user_id,
    match_id: s.match_id,
    captain_id: s.captain_id,
    vice_captain_id: s.vice_captain_id,
    is_auto_pick: s.is_auto_pick,
    players: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
  }))

  const rawUserScores: RawUserMatchScore[] = (userScoresRes.data ?? []).map((s) => ({
    user_id: s.user_id,
    match_id: s.match_id,
    total_points: Number(s.total_points),
    rank: s.rank,
    captain_points: Number(s.captain_points),
    vc_points: Number(s.vc_points),
  }))

  const rawVenueStats: RawVenueStat[] = (venueStatsRes.data ?? []).map((v) => ({
    player_id: v.player_id,
    venue: v.venue,
    matches: v.matches,
    runs: v.runs,
    balls_faced: v.balls_faced,
    wickets: v.wickets,
    overs_bowled: Number(v.overs_bowled),
    runs_conceded: v.runs_conceded,
  }))

  const rawVsTeamStats: RawVsTeamStat[] = (vsTeamStatsRes.data ?? []).map((v) => ({
    player_id: v.player_id,
    opponent_team: v.opponent_team,
    matches: v.matches,
    runs: v.runs,
    balls_faced: v.balls_faced,
    wickets: v.wickets,
    overs_bowled: Number(v.overs_bowled),
    runs_conceded: v.runs_conceded,
  }))

  const matchInfos: MatchInfo[] = completedMatches.map((m) => ({
    id: m.id,
    matchNumber: m.match_number,
    venue: m.venue,
    teamHomeId: m.team_home_id,
    teamAwayId: m.team_away_id,
    status: m.status,
  }))

  const matchOrder = matchIds

  // ============================================================
  // Compute all analytics
  // ============================================================

  // Tab 1: Player Performance
  const playerStats = computePlayerStats(rawScores, playerMap, matchOrder)
  const roleBenchmarks = computeRoleBenchmarks(playerStats)

  // Tab 4: Ownership (needed for Tab 2 power ratings)
  const totalUsers = new Set(rawSelections.map((s) => s.user_id)).size
  const { ownership: ownershipData, captainROI } = computeOwnership(
    rawSelections, rawScores, playerMap, totalUsers, matchIds.length
  )

  const ownershipMap = new Map(ownershipData.map((o) => [o.id, { pct: o.ownershipPct }]))

  // Tab 2: Power Ratings
  const powerRatings = computePowerRatings(playerStats, roleBenchmarks, ownershipMap)

  // Tab 7: Optimal Teams (needed for DQS)
  const optimalTeams = computeOptimalTeams(rawScores, playerMap, matchInfos)

  // Tab 4: Decision Quality
  const dqsData = computeDecisionQuality(rawUserScores, optimalTeams, profileMap)

  // Pace vs Spin Analysis
  const paceSpinData = computePaceSpinAnalysis(rawScores, playerMap, matchInfos, teamIdToName)

  // Tab 5: Venue Analytics
  const { venues: venueData } = computeVenueAnalytics(rawScores, matchInfos, playerMap, teamIdToName)
  const matchScoringRows = computeMatchScoringRows(
    rawScores, rawUserScores, matchInfos, playerMap, profileMap, teamIdToName
  )

  // Tab 3: Match Preview
  let matchPreview: {
    predictions: Awaited<ReturnType<typeof computeMatchPreview>>["predictions"]
    suggestedTeam: Awaited<ReturnType<typeof computeMatchPreview>>["suggestedTeam"]
    matchInfo: { matchNumber: number; venue: string; homeTeam: string; awayTeam: string; startTime: string }
  } | null = null

  if (nextMatch) {
    const playingXIIds = playingXIRes.data?.map((p) => p.player_id) ?? null
    const { predictions, suggestedTeam } = computeMatchPreview(
      {
        id: nextMatch.id,
        matchNumber: nextMatch.match_number,
        venue: nextMatch.venue,
        teamHomeId: nextMatch.team_home_id,
        teamAwayId: nextMatch.team_away_id,
        status: nextMatch.status,
      },
      playerStats,
      playingXIIds && playingXIIds.length > 0 ? playingXIIds : null,
      playerMap,
      rawVenueStats,
      rawVsTeamStats,
      ownershipMap,
      teamIdToName,
    )
    matchPreview = {
      predictions,
      suggestedTeam,
      matchInfo: {
        matchNumber: nextMatch.match_number,
        venue: nextMatch.venue,
        homeTeam: teamIdToName.get(nextMatch.team_home_id) ?? "?",
        awayTeam: teamIdToName.get(nextMatch.team_away_id) ?? "?",
        startTime: nextMatch.start_time,
      },
    }
  }

  // Build form curve data for top 10 by form
  const top10Form = [...playerStats]
    .filter((p) => p.matches >= 3)
    .sort((a, b) => b.formLast3 - a.formLast3)
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      rollingAvg: p.rollingAvg,
    }))

  return (
    <PageTransition>
      <AnalyticsClient
        playerStats={playerStats}
        roleBenchmarks={roleBenchmarks}
        powerRatings={powerRatings}
        matchPreview={matchPreview}
        ownershipData={ownershipData}
        captainROI={captainROI}
        optimalTeams={optimalTeams}
        dqsData={dqsData}
        venueData={venueData}
        matchScoringRows={matchScoringRows}
        matchCount={matchIds.length}
        userCount={totalUsers}
        formCurves={top10Form}
        paceSpinVenues={paceSpinData.venues}
        paceSpinTeams={paceSpinData.teams}
      />
    </PageTransition>
  )
}

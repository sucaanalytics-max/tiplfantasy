import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { PlayerWithTeam, MatchWithTeams, PlayerVenueStats, PlayerVsTeamStats, PlayerSeasonStats } from "@/lib/types"
import { PickTeamClient } from "./pick-team-client"

export default async function PickTeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: matchId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch match with teams
  const { data: match } = await supabase
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(*), team_away:teams!matches_team_away_id_fkey(*)")
    .eq("id", matchId)
    .single()

  if (!match) redirect("/matches")

  const typedMatch = match as unknown as MatchWithTeams

  // If match isn't upcoming, redirect to scores or matches
  if (typedMatch.status !== "upcoming") {
    if (typedMatch.status === "completed" || typedMatch.status === "no_result") {
      redirect(`/match/${matchId}/scores`)
    }
    redirect("/matches")
  }

  // Check if match has started
  if (new Date(typedMatch.start_time) <= new Date()) {
    redirect("/matches")
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

    // Existing selection with players joined — fixes Waterfall A (was 2 sequential queries)
    supabase
      .from("selections")
      .select("id, captain_id, vice_captain_id, selection_players(player_id)")
      .eq("user_id", user.id)
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
      .eq("selection.match_id", matchId),

    // Last 10 completed matches to scope form scores (replaces limit(2000) fetch)
    supabase
      .from("matches")
      .select("id")
      .eq("status", "completed")
      .order("start_time", { ascending: false })
      .limit(10),
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
  const recentMatchIds = (recentMatches ?? []).map((m) => m.id)
  const homeShort = typedMatch.team_home.short_name
  const awayShort = typedMatch.team_away.short_name

  // Phase 2: All stats queries in parallel (depend on playerIds from Phase 1)
  const [
    { data: tiplScoresRaw },
    { data: venueStatsRaw },
    { data: vsTeamStatsRaw },
    { data: seasonStatsRaw },
  ] = await Promise.all([
    // Last 5 TIPL fantasy scores per player, scoped to recent matches (was limit(2000))
    supabase
      .from("match_player_scores")
      .select("player_id, fantasy_points")
      .in("player_id", playerIds)
      .in("match_id", recentMatchIds)
      .order("created_at", { ascending: false }),

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

    // Last 3 seasons of stats
    supabase
      .from("player_season_stats")
      .select("*")
      .in("player_id", playerIds)
      .gte("season", new Date().getFullYear() - 2)
      .order("season", { ascending: false }),
  ])

  const tiplScoreMap: Record<string, number[]> = {}
  for (const s of tiplScoresRaw ?? []) {
    if (!tiplScoreMap[s.player_id]) tiplScoreMap[s.player_id] = []
    if (tiplScoreMap[s.player_id].length < 5) {
      tiplScoreMap[s.player_id].push(s.fantasy_points)
    }
  }

  const venueStatsMap: Record<string, PlayerVenueStats> = {}
  for (const vs of venueStatsRaw ?? []) {
    venueStatsMap[vs.player_id] = vs as PlayerVenueStats
  }

  const vsTeamStatsMap: Record<string, PlayerVsTeamStats> = {}
  for (const vt of vsTeamStatsRaw ?? []) {
    vsTeamStatsMap[vt.player_id] = vt as PlayerVsTeamStats
  }

  const seasonStatsMap: Record<string, PlayerSeasonStats[]> = {}
  for (const ss of seasonStatsRaw ?? []) {
    if (!seasonStatsMap[ss.player_id]) seasonStatsMap[ss.player_id] = []
    seasonStatsMap[ss.player_id].push(ss as PlayerSeasonStats)
  }

  return (
    <PickTeamClient
      match={typedMatch}
      players={(players ?? []) as unknown as PlayerWithTeam[]}
      playingXIIds={Array.from(playingXIIds)}
      initialSelectedIds={selectedPlayerIds}
      initialCaptainId={selectionWithPlayers?.captain_id ?? null}
      initialViceCaptainId={selectionWithPlayers?.vice_captain_id ?? null}
      tiplScores={tiplScoreMap}
      venueStats={venueStatsMap}
      vsTeamStats={vsTeamStatsMap}
      seasonStats={seasonStatsMap}
      selectionPcts={selectionPcts}
    />
  )
}

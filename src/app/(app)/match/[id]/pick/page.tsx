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

  // Fetch all players from both teams
  const { data: players } = await supabase
    .from("players")
    .select("*, team:teams(*)")
    .or(`team_id.eq.${typedMatch.team_home_id},team_id.eq.${typedMatch.team_away_id}`)
    .eq("is_active", true)
    .order("role")
    .order("name")

  // Fetch playing XI if announced
  const { data: playingXI } = await supabase
    .from("playing_xi")
    .select("player_id")
    .eq("match_id", matchId)

  const playingXIIds = new Set((playingXI ?? []).map((p) => p.player_id))

  // Fetch existing selection
  const { data: existingSelection } = await supabase
    .from("selections")
    .select("id, captain_id, vice_captain_id")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .single()

  let selectedPlayerIds: string[] = []
  if (existingSelection) {
    const { data: selPlayers } = await supabase
      .from("selection_players")
      .select("player_id")
      .eq("selection_id", existingSelection.id)

    selectedPlayerIds = (selPlayers ?? []).map((sp) => sp.player_id)
  }

  // Fetch last 5 TIPL fantasy scores for all players in this match
  const playerIds = (players ?? []).map((p: { id: string }) => p.id)
  const { data: tiplScoresRaw } = await supabase
    .from("match_player_scores")
    .select("player_id, fantasy_points")
    .in("player_id", playerIds)
    .order("created_at", { ascending: false })
    .limit(2000)

  const tiplScoreMap: Record<string, number[]> = {}
  for (const s of tiplScoresRaw ?? []) {
    if (!tiplScoreMap[s.player_id]) tiplScoreMap[s.player_id] = []
    if (tiplScoreMap[s.player_id].length < 5) {
      tiplScoreMap[s.player_id].push(s.fantasy_points)
    }
  }

  // Fetch venue stats for this match's venue
  const { data: venueStatsRaw } = await supabase
    .from("player_venue_stats")
    .select("*")
    .eq("venue", typedMatch.venue)
    .in("player_id", playerIds)

  const venueStatsMap: Record<string, PlayerVenueStats> = {}
  for (const vs of venueStatsRaw ?? []) {
    venueStatsMap[vs.player_id] = vs as PlayerVenueStats
  }

  // Fetch vs-team stats for both opponents
  const homeShort = typedMatch.team_home.short_name
  const awayShort = typedMatch.team_away.short_name
  const { data: vsTeamStatsRaw } = await supabase
    .from("player_vs_team_stats")
    .select("*")
    .in("opponent_team", [homeShort, awayShort])
    .in("player_id", playerIds)

  const vsTeamStatsMap: Record<string, PlayerVsTeamStats> = {}
  for (const vt of vsTeamStatsRaw ?? []) {
    vsTeamStatsMap[vt.player_id] = vt as PlayerVsTeamStats
  }

  // Fetch last 3 seasons of stats
  const currentYear = new Date().getFullYear()
  const { data: seasonStatsRaw } = await supabase
    .from("player_season_stats")
    .select("*")
    .in("player_id", playerIds)
    .gte("season", currentYear - 2)
    .order("season", { ascending: false })

  const seasonStatsMap: Record<string, PlayerSeasonStats[]> = {}
  for (const ss of seasonStatsRaw ?? []) {
    if (!seasonStatsMap[ss.player_id]) seasonStatsMap[ss.player_id] = []
    seasonStatsMap[ss.player_id].push(ss as PlayerSeasonStats)
  }

  // Fetch selection percentages — how many users picked each player
  const { count: totalSelections } = await supabase
    .from("selections")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId)

  const selectionPcts: Record<string, number> = {}
  if (totalSelections && totalSelections > 0) {
    const { data: playerCounts } = await supabase
      .from("selection_players")
      .select("player_id, selection:selections!inner(match_id)")
      .eq("selection.match_id", matchId)

    const countMap = new Map<string, number>()
    for (const pc of playerCounts ?? []) {
      countMap.set(pc.player_id, (countMap.get(pc.player_id) ?? 0) + 1)
    }
    for (const [pid, count] of countMap) {
      selectionPcts[pid] = Math.round((count / totalSelections) * 100)
    }
  }

  return (
    <PickTeamClient
      match={typedMatch}
      players={(players ?? []) as unknown as PlayerWithTeam[]}
      playingXIIds={Array.from(playingXIIds)}
      initialSelectedIds={selectedPlayerIds}
      initialCaptainId={existingSelection?.captain_id ?? null}
      initialViceCaptainId={existingSelection?.vice_captain_id ?? null}
      tiplScores={tiplScoreMap}
      venueStats={venueStatsMap}
      vsTeamStats={vsTeamStatsMap}
      seasonStats={seasonStatsMap}
      selectionPcts={selectionPcts}
    />
  )
}

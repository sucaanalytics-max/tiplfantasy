import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLeagueWithMembers } from "@/actions/leagues"
import { LeagueMatchClient } from "./league-match-client"
import type { PlayerWithTeam } from "@/lib/types"

export default async function LeagueMatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>
}) {
  const { id: leagueId, matchId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const leagueData = await getLeagueWithMembers(leagueId)
  if (!leagueData) redirect("/leagues")

  const isMember = leagueData.members.some((m) => m.user_id === user.id)
  if (!isMember) redirect(`/leagues/${leagueId}`)

  const admin = createAdminClient()

  const { data: match } = await admin
    .from("matches")
    .select("id, match_number, status, team_home:teams!team_home_id(short_name, color), team_away:teams!team_away_id(short_name, color)")
    .eq("id", matchId)
    .single()

  if (!match || match.status === "upcoming") redirect(`/leagues/${leagueId}`)

  const memberIds = leagueData.members.map((m) => m.user_id)

  const { data: rawSelections } = await admin
    .from("selections")
    .select("user_id, captain_id, vice_captain_id, selection_players(player_id)")
    .eq("match_id", matchId)
    .in("user_id", memberIds)

  // Collect unique player IDs across all selections
  const allPlayerIds = [
    ...new Set(
      (rawSelections ?? []).flatMap((s) =>
        (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id)
      )
    ),
  ]

  const [{ data: players }, { data: matchPlayerScores }, { data: memberScoresRaw }] = await Promise.all([
    allPlayerIds.length > 0
      ? admin.from("players").select("*, team:teams(*)").in("id", allPlayerIds)
      : Promise.resolve({ data: [] }),
    admin.from("match_player_scores").select("player_id, fantasy_points").eq("match_id", matchId),
    admin.from("user_match_scores")
      .select("user_id, total_points, rank, captain_points, vc_points, breakdown")
      .eq("match_id", matchId)
      .in("user_id", memberIds)
      .order("total_points", { ascending: false }),
  ])

  // Build player_id → fantasy_points lookup
  const playerPointsMap: Record<string, number> = {}
  for (const ps of matchPlayerScores ?? []) {
    playerPointsMap[ps.player_id] = Number(ps.fantasy_points)
  }

  // Build member display name lookup
  const memberNames: Record<string, string> = {}
  for (const m of leagueData.members) {
    const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile
    memberNames[m.user_id] = (prof as { display_name?: string } | null)?.display_name ?? "Unknown"
  }

  const memberSelections = (rawSelections ?? []).map((s) => ({
    user_id: s.user_id,
    display_name: memberNames[s.user_id] ?? "Unknown",
    captain_id: s.captain_id as string | null,
    vice_captain_id: s.vice_captain_id as string | null,
    player_ids: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
  }))

  // Build league member scores with display names
  const memberScores = (memberScoresRaw ?? []).map((s) => ({
    user_id: s.user_id,
    display_name: memberNames[s.user_id] ?? "Unknown",
    total_points: Number(s.total_points),
    rank: s.rank as number | null,
    captain_points: Number(s.captain_points),
    vc_points: Number(s.vc_points),
    breakdown: s.breakdown as Record<string, number> | null,
  }))

  return (
    <LeagueMatchClient
      leagueId={leagueId}
      leagueName={leagueData.league.name}
      match={match as unknown as { id: string; match_number: number; status: string; team_home: { short_name: string; color: string }; team_away: { short_name: string; color: string } }}
      currentUserId={user.id}
      memberSelections={memberSelections}
      players={(players ?? []) as unknown as PlayerWithTeam[]}
      playerPoints={playerPointsMap}
      memberScores={memberScores}
    />
  )
}

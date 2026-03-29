import { redirect } from "next/navigation"
import { getLeagueWithMembers, getLeagueLeaderboard, getLeagueAwards, getLeagueMatchScores } from "@/actions/leagues"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { LeagueDetailClient } from "./league-detail-client"

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const leagueData = await getLeagueWithMembers(id)
  if (!leagueData) redirect("/leagues")

  const isMember = leagueData.members.some((m) => m.user_id === user.id)
  if (!isMember) redirect("/leagues")

  const admin = createAdminClient()

  const memberIds = leagueData.members.map((m) => m.user_id)

  const [leaderboard, awards, matchScores, { data: lockedMatches }, { data: liveMatchRow }] = await Promise.all([
    getLeagueLeaderboard(id),
    getLeagueAwards(id),
    getLeagueMatchScores(id),
    admin
      .from("matches")
      .select("id, match_number, start_time, status, team_home:teams!team_home_id(short_name, color), team_away:teams!team_away_id(short_name, color)")
      .in("status", ["live", "completed", "no_result"])
      .order("start_time", { ascending: false }),
    admin
      .from("matches")
      .select("id, match_number, status, cricapi_match_id, start_time, team_home:teams!team_home_id(short_name, color, logo_url), team_away:teams!team_away_id(short_name, color, logo_url)")
      .eq("status", "live")
      .limit(1)
      .maybeSingle(),
  ])

  // Build member display name lookup
  const memberNames: Record<string, string> = {}
  for (const m of leagueData.members) {
    const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile
    memberNames[m.user_id] = (prof as { display_name?: string } | null)?.display_name ?? "Unknown"
  }

  // Fetch live match data if a match is live
  type LiveMatchData = {
    match: { id: string; match_number: number; status: string; cricapi_match_id: string | null; start_time: string; team_home: { short_name: string; color: string; logo_url: string | null }; team_away: { short_name: string; color: string; logo_url: string | null } }
    memberScores: Array<{ user_id: string; display_name: string; total_points: number; captain_points: number; vc_points: number }>
    memberSelections: Array<{ user_id: string; captain_id: string | null; vice_captain_id: string | null; player_ids: string[] }>
    playerPoints: Record<string, number>
    playerNames: Record<string, { name: string; role: string }>
  }
  let liveMatchData: LiveMatchData | null = null

  if (liveMatchRow) {
    const matchId = liveMatchRow.id
    const [{ data: memberScoresRaw }, { data: selectionsRaw }, { data: playerScoresRaw }] = await Promise.all([
      admin.from("user_match_scores")
        .select("user_id, total_points, captain_points, vc_points")
        .eq("match_id", matchId)
        .in("user_id", memberIds)
        .order("total_points", { ascending: false }),
      admin.from("selections")
        .select("user_id, captain_id, vice_captain_id, selection_players(player_id)")
        .eq("match_id", matchId)
        .in("user_id", memberIds),
      admin.from("match_player_scores")
        .select("player_id, fantasy_points, player:players(name, role)")
        .eq("match_id", matchId),
    ])

    const playerPoints: Record<string, number> = {}
    const playerNamesMap: Record<string, { name: string; role: string }> = {}
    for (const ps of playerScoresRaw ?? []) {
      playerPoints[ps.player_id] = Number(ps.fantasy_points)
      const p = ps.player as unknown as { name: string; role: string } | null
      if (p) playerNamesMap[ps.player_id] = { name: p.name, role: p.role }
    }

    liveMatchData = {
      match: liveMatchRow as unknown as LiveMatchData["match"],
      memberScores: (memberScoresRaw ?? []).map((s) => ({
        user_id: s.user_id,
        display_name: memberNames[s.user_id] ?? "Unknown",
        total_points: Number(s.total_points),
        captain_points: Number(s.captain_points),
        vc_points: Number(s.vc_points),
      })),
      memberSelections: (selectionsRaw ?? []).map((s) => ({
        user_id: s.user_id,
        captain_id: s.captain_id as string | null,
        vice_captain_id: s.vice_captain_id as string | null,
        player_ids: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
      })),
      playerPoints,
      playerNames: playerNamesMap,
    }
  }

  return (
    <LeagueDetailClient
      league={leagueData.league}
      members={leagueData.members}
      isCreator={leagueData.isCreator}
      leaderboard={leaderboard}
      awards={awards}
      matchScores={matchScores}
      lockedMatches={(lockedMatches ?? []) as unknown as { id: string; match_number: number; start_time: string; status: string; team_home: { short_name: string; color: string }; team_away: { short_name: string; color: string } }[]}
      liveMatchData={liveMatchData}
      currentUserId={user.id}
    />
  )
}

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

  const [leaderboard, awards, matchScores, { data: lockedMatches }] = await Promise.all([
    getLeagueLeaderboard(id),
    getLeagueAwards(id),
    getLeagueMatchScores(id),
    admin
      .from("matches")
      .select("id, match_number, start_time, status, team_home:teams!team_home_id(short_name, color), team_away:teams!team_away_id(short_name, color)")
      .in("status", ["live", "completed", "no_result"])
      .order("start_time", { ascending: false }),
  ])

  return (
    <LeagueDetailClient
      league={leagueData.league}
      members={leagueData.members}
      isCreator={leagueData.isCreator}
      leaderboard={leaderboard}
      awards={awards}
      matchScores={matchScores}
      lockedMatches={(lockedMatches ?? []) as unknown as { id: string; match_number: number; start_time: string; status: string; team_home: { short_name: string; color: string }; team_away: { short_name: string; color: string } }[]}
    />
  )
}

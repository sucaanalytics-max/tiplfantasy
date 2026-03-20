import { redirect } from "next/navigation"
import { getLeagueWithMembers, getLeagueLeaderboard, getLeagueAwards } from "@/actions/leagues"
import { LeagueDetailClient } from "./league-detail-client"

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [leagueData, leaderboard, awards] = await Promise.all([
    getLeagueWithMembers(id),
    getLeagueLeaderboard(id),
    getLeagueAwards(id),
  ])
  if (!leagueData) redirect("/leagues")

  return (
    <LeagueDetailClient
      league={leagueData.league}
      members={leagueData.members}
      isCreator={leagueData.isCreator}
      leaderboard={leaderboard}
      awards={awards}
    />
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MyTeamClient } from "./my-team-client"
import type { PlayerWithTeam, MatchWithTeams } from "@/lib/types"

export default async function MyTeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: matchId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: match }, { data: selection }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, match_number, start_time, venue, status, result_summary, team_home:teams!team_home_id(*), team_away:teams!team_away_id(*)")
      .eq("id", matchId)
      .single(),
    supabase
      .from("selections")
      .select("captain_id, vice_captain_id, selection_players(player_id, player:players(*, team:teams(*)))")
      .eq("match_id", matchId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  if (!match) redirect("/matches")
  if (!selection) redirect(`/match/${matchId}/pick`)

  // Build PlayerWithTeam[] preserving role order
  const players: PlayerWithTeam[] = (selection.selection_players ?? [])
    .map((sp: { player_id: string; player: unknown }) => sp.player as PlayerWithTeam)
    .filter(Boolean)

  return (
    <MyTeamClient
      players={players}
      captainId={selection.captain_id}
      viceCaptainId={selection.vice_captain_id}
      match={match as unknown as MatchWithTeams}
    />
  )
}

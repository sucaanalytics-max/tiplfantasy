import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { PlayerWithTeam, MatchWithTeams } from "@/lib/types"
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

  return (
    <PickTeamClient
      match={typedMatch}
      players={(players ?? []) as unknown as PlayerWithTeam[]}
      playingXIIds={Array.from(playingXIIds)}
      initialSelectedIds={selectedPlayerIds}
      initialCaptainId={existingSelection?.captain_id ?? null}
      initialViceCaptainId={existingSelection?.vice_captain_id ?? null}
    />
  )
}

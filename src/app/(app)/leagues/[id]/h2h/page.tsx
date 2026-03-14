import { redirect } from "next/navigation"
import { getLeagueWithMembers } from "@/actions/leagues"
import { createClient } from "@/lib/supabase/server"
import { H2HClient } from "./h2h-client"

export default async function H2HPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const leagueData = await getLeagueWithMembers(id)
  if (!leagueData) redirect("/leagues")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch all match scores for league members
  const memberIds = leagueData.members.map((m) => m.user_id)
  const { data: allScores } = await supabase
    .from("user_match_scores")
    .select("user_id, match_id, total_points, rank, match:matches(match_number)")
    .in("user_id", memberIds)
    .order("match_id", { ascending: true })

  const members = leagueData.members.map((m) => ({
    user_id: m.user_id,
    display_name: (m.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
  }))

  const scores = (allScores ?? []).map((s) => ({
    user_id: s.user_id,
    match_id: s.match_id,
    total_points: s.total_points,
    match_number: (s.match as unknown as { match_number: number })?.match_number ?? 0,
  }))

  return (
    <H2HClient
      leagueId={id}
      leagueName={leagueData.league.name}
      members={members}
      scores={scores}
      currentUserId={user.id}
    />
  )
}

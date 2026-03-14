import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { AdminMatchClient } from "./client"
import type { PlayerWithTeam, MatchWithTeams } from "@/lib/types"

export default async function AdminMatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  const admin = createAdminClient()

  // Fetch match with teams
  const { data: match } = await admin
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(*), team_away:teams!matches_team_away_id_fkey(*)")
    .eq("id", id)
    .single()

  if (!match) redirect("/admin")

  // Fetch players for both teams
  const { data: players } = await admin
    .from("players")
    .select("*, team:teams(*)")
    .in("team_id", [match.team_home_id, match.team_away_id])
    .eq("is_active", true)
    .order("name")

  // Fetch playing XI
  const { data: playingXI } = await admin
    .from("playing_xi")
    .select("player_id")
    .eq("match_id", id)

  const playingXIIds = playingXI?.map((p) => p.player_id) ?? []

  // Fetch existing player scores
  const { data: existingScores } = await admin
    .from("match_player_scores")
    .select("*")
    .eq("match_id", id)

  // Fetch user scores if already calculated
  const { data: userScores } = await admin
    .from("user_match_scores")
    .select("*, profile:profiles(display_name)")
    .eq("match_id", id)
    .order("rank", { ascending: true })

  // Selection count
  const { count: selectionCount } = await admin
    .from("selections")
    .select("id", { count: "exact", head: true })
    .eq("match_id", id)

  // Season top 5 for WhatsApp message
  const { data: seasonTop5 } = await admin
    .from("season_leaderboard")
    .select("*")
    .order("season_rank", { ascending: true })
    .limit(5)

  return (
    <AdminMatchClient
      match={match as unknown as MatchWithTeams}
      players={(players ?? []) as unknown as PlayerWithTeam[]}
      playingXIIds={playingXIIds}
      existingScores={existingScores ?? []}
      userScores={
        (userScores ?? []).map((s) => ({
          ...s,
          displayName: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
        }))
      }
      seasonTop5={
        (seasonTop5 ?? []).map((s) => ({
          displayName: (s as Record<string, unknown>).display_name as string,
          totalPoints: (s as Record<string, unknown>).total_points as number,
        }))
      }
      selectionCount={selectionCount ?? 0}
    />
  )
}

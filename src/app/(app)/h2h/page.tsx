import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getTokenBalance, getOpenChallenges, getMyChallenges } from "@/actions/h2h"
import { H2HClient } from "./h2h-client"

export default async function H2HPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const balance = await getTokenBalance()
  const openChallenges = await getOpenChallenges()
  const myChallenges = await getMyChallenges()

  // Fetch upcoming matches for creating challenges
  const { data: upcomingMatches } = await supabase
    .from("matches")
    .select("id, match_number, start_time, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
    .eq("status", "upcoming")
    .order("start_time", { ascending: true })
    .limit(10)

  // Fetch all users for opponent picker
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, display_name")
    .neq("id", user.id)
    .order("display_name")
    .limit(200)

  return (
    <H2HClient
      userId={user.id}
      balance={balance}
      openChallenges={openChallenges}
      myChallenges={myChallenges}
      upcomingMatches={(upcomingMatches ?? []).map((m) => ({
        id: m.id,
        match_number: m.match_number,
        start_time: m.start_time,
        home: (m.team_home as unknown as { short_name: string }).short_name,
        away: (m.team_away as unknown as { short_name: string }).short_name,
      }))}
      allUsers={allUsers ?? []}
    />
  )
}

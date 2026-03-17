import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getMyPredictions, getPredictionDeadline, getAwardStandings } from "@/actions/predictions"
import { PredictionsClient } from "./predictions-client"

export default async function PredictionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch all active players grouped by team for the picker
  const { data: rawPlayers } = await supabase
    .from("players")
    .select("id, name, role, team_id, team:teams!inner(short_name, color)")
    .eq("is_active", true)
    .order("name")

  // Normalize team from array to object (Supabase join quirk)
  const players = (rawPlayers ?? []).map((p) => ({
    ...p,
    team: Array.isArray(p.team) ? p.team[0] ?? null : p.team,
  }))

  const myPredictions = await getMyPredictions()
  const deadline = await getPredictionDeadline()

  // Fetch current standings for all 3 categories
  const [purpleStandings, orangeStandings, mvpStandings] = await Promise.all([
    getAwardStandings("purple_cap", 5),
    getAwardStandings("orange_cap", 5),
    getAwardStandings("mvp", 5),
  ])

  return (
    <PredictionsClient
      players={players ?? []}
      myPredictions={myPredictions}
      deadline={deadline}
      standings={{
        purple_cap: purpleStandings,
        orange_cap: orangeStandings,
        mvp: mvpStandings,
      }}
    />
  )
}

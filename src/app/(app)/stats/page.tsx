import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageTransition } from "@/components/page-transition"
import { StatsClient } from "./stats-client"

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()

  // Get all completed matches
  const { data: completedMatches } = await admin
    .from("matches")
    .select("id")
    .eq("status", "completed")
    .order("match_number", { ascending: true })

  const matchIds = (completedMatches ?? []).map((m) => m.id)
  if (matchIds.length === 0) {
    return (
      <PageTransition>
        <div className="p-4 max-w-2xl text-center py-20">
          <p className="text-muted-foreground">No completed matches yet. Stats will appear after the first match.</p>
        </div>
      </PageTransition>
    )
  }

  // Fetch all player scores across completed matches
  const { data: allScores } = await admin
    .from("match_player_scores")
    .select("player_id, match_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, maidens, catches, stumpings, run_outs, fantasy_points, breakdown")
    .in("match_id", matchIds)

  // Fetch player info
  const playerIds = [...new Set((allScores ?? []).map((s) => s.player_id))]
  const { data: players } = await admin
    .from("players")
    .select("id, name, role, team:teams(short_name, color, logo_url)")
    .in("id", playerIds)

  const playerMap = new Map((players ?? []).map((p) => [p.id, {
    name: p.name,
    role: p.role,
    team: (p.team as unknown as { short_name: string })?.short_name ?? "?",
    color: (p.team as unknown as { color: string })?.color ?? "#888",
    logoUrl: (p.team as unknown as { logo_url: string | null })?.logo_url ?? null,
  }]))

  // Aggregate stats per player
  type PlayerAgg = {
    id: string
    name: string
    role: string
    team: string
    color: string
    logoUrl: string | null
    matches: number
    runs: number
    ballsFaced: number
    fours: number
    sixes: number
    wickets: number
    oversBowled: number
    runsConceded: number
    maidens: number
    catches: number
    stumpings: number
    runOuts: number
    totalFantasy: number
    ducks: number
    scores: number[]    // per-match fantasy points (chronological)
  }

  const aggMap = new Map<string, PlayerAgg>()

  for (const s of allScores ?? []) {
    const info = playerMap.get(s.player_id)
    if (!info) continue

    let agg = aggMap.get(s.player_id)
    if (!agg) {
      agg = {
        id: s.player_id, name: info.name, role: info.role, team: info.team, color: info.color, logoUrl: info.logoUrl,
        matches: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
        wickets: 0, oversBowled: 0, runsConceded: 0, maidens: 0,
        catches: 0, stumpings: 0, runOuts: 0, totalFantasy: 0, ducks: 0, scores: [],
      }
      aggMap.set(s.player_id, agg)
    }

    agg.matches++
    agg.runs += s.runs
    agg.ballsFaced += s.balls_faced
    agg.fours += s.fours
    agg.sixes += s.sixes
    agg.wickets += s.wickets
    agg.oversBowled += Number(s.overs_bowled)
    agg.runsConceded += s.runs_conceded
    agg.maidens += s.maidens
    agg.catches += s.catches
    agg.stumpings += s.stumpings
    agg.runOuts += s.run_outs
    agg.totalFantasy += Number(s.fantasy_points)
    agg.scores.push(Number(s.fantasy_points))

    // Count ducks from breakdown
    const bd = s.breakdown as Record<string, number> | null
    if (bd && bd.duck && bd.duck < 0) agg.ducks++
  }

  const allPlayers = [...aggMap.values()]

  return (
    <PageTransition>
      <StatsClient players={allPlayers} matchCount={matchIds.length} />
    </PageTransition>
  )
}

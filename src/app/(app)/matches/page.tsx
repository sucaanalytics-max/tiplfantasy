export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MatchList } from "./match-list"
import { PageTransition } from "@/components/page-transition"

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: matches } = await supabase
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
    .order("start_time", { ascending: true })
    .limit(200)

  // Get user's selections
  const { data: selections } = await supabase
    .from("selections")
    .select("match_id")
    .eq("user_id", user.id)
    .limit(200)

  const submittedMatchIds = selections?.map((s) => s.match_id) ?? []

  // Normalize matches for the client component
  const normalizedMatches = (matches ?? []).map((match) => ({
    id: match.id,
    match_number: match.match_number,
    start_time: match.start_time,
    venue: match.venue,
    status: match.status,
    result_summary: match.result_summary,
    cricapi_match_id: match.cricapi_match_id ?? null,
    team_home: match.team_home as unknown as { short_name: string; color: string; logo_url: string | null },
    team_away: match.team_away as unknown as { short_name: string; color: string; logo_url: string | null },
  }))

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <p className="text-muted-foreground mt-0.5">IPL 2026 Schedule</p>
      </div>

      <MatchList matches={normalizedMatches} submittedMatchIds={submittedMatchIds} />
    </div>
    </PageTransition>
  )
}

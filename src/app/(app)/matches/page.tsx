import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MatchList } from "./match-list"
import { PageTransition } from "@/components/page-transition"

type MatchRow = {
  id: string
  match_number: number
  start_time: string
  venue: string
  status: string
  result_summary: string | null
  cricapi_match_id: string | null
  team_home: { short_name: string; color: string; logo_url: string | null }
  team_away: { short_name: string; color: string; logo_url: string | null }
}

const getCachedMatches = unstable_cache(
  async (): Promise<MatchRow[]> => {
    const admin = createAdminClient()
    const { data: matches } = await admin
      .from("matches")
      .select("id, match_number, start_time, venue, status, result_summary, cricapi_match_id, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
      .order("start_time", { ascending: true })
      .limit(200)

    return (matches ?? []).map((match) => ({
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
  },
  ["matches"],
  { tags: ["matches"], revalidate: 60 }
)

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [normalizedMatches, selectionsRes] = await Promise.all([
    getCachedMatches(),
    supabase
      .from("selections")
      .select("match_id")
      .eq("user_id", user.id)
      .limit(200),
  ])

  const submittedMatchIds = selectionsRes.data?.map((s) => s.match_id) ?? []

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

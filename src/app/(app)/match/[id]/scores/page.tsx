import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { PageTransition } from "@/components/page-transition"
import { ScoresClient } from "./scores-client"
import type { TeamInfo, PlayerScoreRow, UserScoreRow, SelectionRow } from "./scores-client"

export default async function ScoresPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()

  // All queries in parallel
  const [matchRes, playerScoresRes, userScoresRes, mySelectionRes, allSelectionsRes, captainPicksRes, banterRes] = await Promise.all([
    admin
      .from("matches")
      .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
      .eq("id", id)
      .single(),
    admin
      .from("match_player_scores")
      .select("*, player:players(name, role, team_id, team:teams(short_name, color))")
      .eq("match_id", id)
      .order("fantasy_points", { ascending: false })
      .limit(50),
    admin
      .from("user_match_scores")
      .select("*, profile:profiles(display_name)")
      .eq("match_id", id)
      .order("rank", { ascending: true })
      .limit(200),
    supabase
      .from("selections")
      .select("captain_id, vice_captain_id, selection_players(player_id)")
      .eq("user_id", user.id)
      .eq("match_id", id)
      .single(),
    admin
      .from("selections")
      .select("user_id, captain_id, vice_captain_id, selection_players(player_id)")
      .eq("match_id", id)
      .limit(200),
    admin
      .from("selections")
      .select("user_id, captain_id, captain:players!selections_captain_id_fkey(name)")
      .eq("match_id", id)
      .not("captain_id", "is", null),
    admin
      .from("match_banter")
      .select("message, event_type")
      .eq("match_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ])

  const match = matchRes.data
  if (!match) redirect("/matches")

  const home = match.team_home as unknown as TeamInfo
  const away = match.team_away as unknown as TeamInfo
  const playerScores = (playerScoresRes.data ?? []) as unknown as PlayerScoreRow[]
  const userScores = (userScoresRes.data ?? []) as unknown as UserScoreRow[]
  const myScore = userScores.find((s) => s.user_id === user.id) ?? null

  const mySelection = mySelectionRes.data
  const myPlayerIds = (mySelection?.selection_players as { player_id: string }[] | undefined)?.map((sp) => sp.player_id) ?? []

  // Only expose other users' selections when match is live or completed (not upcoming)
  const isMatchLocked = match.status === "live" || match.status === "completed" || match.status === "no_result"
  const allSelections: SelectionRow[] = isMatchLocked
    ? (allSelectionsRes.data ?? []).map((s) => ({
        user_id: s.user_id,
        captain_id: s.captain_id as string | null,
        vice_captain_id: s.vice_captain_id as string | null,
        player_ids: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
      }))
    : []

  const captainPicks: Record<string, { name: string }> = {}
  for (const s of captainPicksRes.data ?? []) {
    captainPicks[s.user_id] = { name: (s.captain as unknown as { name: string })?.name ?? "—" }
  }

  return (
    <PageTransition>
      <ScoresClient
        match={{
          id: match.id,
          match_number: match.match_number,
          status: match.status,
          result_summary: match.result_summary,
          cricapi_match_id: match.cricapi_match_id,
          start_time: match.start_time,
        }}
        home={home}
        away={away}
        playerScores={playerScores}
        userScores={userScores}
        myScore={myScore}
        myPlayerIds={myPlayerIds}
        myCaptainId={mySelection?.captain_id as string | null ?? null}
        myVcId={mySelection?.vice_captain_id as string | null ?? null}
        allSelections={allSelections}
        captainPicks={captainPicks}
        currentUserId={user.id}
        banter={(banterRes.data ?? []).map((b) => ({ message: b.message, event_type: b.event_type }))}
      />
    </PageTransition>
  )
}

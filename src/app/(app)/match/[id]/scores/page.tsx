export const dynamic = "force-dynamic"

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
  const [matchRes, playerScoresRes, userScoresRes, mySelectionRes, allSelectionsRes, captainPicksRes, vcPicksRes, banterRes, myLeaguesRes, snapshotsRes] = await Promise.all([
    admin
      .from("matches")
      .select("*, team_home:teams!matches_team_home_id_fkey(name, short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(name, short_name, color, logo_url)")
      .eq("id", id)
      .single(),
    admin
      .from("match_player_scores")
      .select("*, player:players(name, role, team_id, image_url, team:teams(short_name, color))")
      .eq("match_id", id)
      .order("fantasy_points", { ascending: false })
      .limit(50),
    admin
      .from("user_match_scores")
      .select("*, profile:profiles(display_name)")
      .eq("match_id", id)
      .order("rank", { ascending: true })
      .order("total_points", { ascending: false })
      .order("user_id", { ascending: true })
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
      .not("captain_id", "is", null)
      .limit(200),
    admin
      .from("selections")
      .select("user_id, vice_captain_id, vc:players!selections_vice_captain_id_fkey(name)")
      .eq("match_id", id)
      .not("vice_captain_id", "is", null)
      .limit(200),
    admin
      .from("match_banter")
      .select("message, event_type")
      .eq("match_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
    admin
      .from("league_members")
      .select("league_id, leagues(id, name)")
      .eq("user_id", user.id),
    admin
      .from("match_score_snapshots")
      .select("over_number, scores")
      .eq("match_id", id)
      .order("over_number", { ascending: true }),
  ])

  const match = matchRes.data
  if (!match) redirect("/matches")

  // Phase 2: fetch all players for both teams (needed for compare when players haven't scored yet)
  const { data: allPlayersRaw } = await admin
    .from("players")
    .select("id, name, role, team_id, team:teams(short_name, color)")
    .in("team_id", [match.team_home_id, match.team_away_id])
    .limit(60)

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

  const vcPicks: Record<string, { name: string }> = {}
  for (const s of vcPicksRes.data ?? []) {
    vcPicks[s.user_id] = { name: (s.vc as unknown as { name: string })?.name ?? "—" }
  }

  // Build league filter data
  const leagueIds = (myLeaguesRes.data ?? []).map((lm) => lm.league_id)
  let userLeagues: { id: string; name: string; memberIds: string[] }[] = []
  if (leagueIds.length > 0) {
    const membersRes = await admin
      .from("league_members")
      .select("league_id, user_id")
      .in("league_id", leagueIds)
      .limit(100)
    const membersData = membersRes.data ?? []
    const leagueMap = new Map<string, { id: string; name: string; memberIds: string[] }>()
    for (const lm of myLeaguesRes.data ?? []) {
      const league = lm.leagues as unknown as { id: string; name: string }
      if (league && !leagueMap.has(league.id)) {
        leagueMap.set(league.id, { id: league.id, name: league.name, memberIds: [] })
      }
    }
    for (const m of membersData) {
      leagueMap.get(m.league_id)?.memberIds.push(m.user_id)
    }
    userLeagues = Array.from(leagueMap.values())
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
          venue: match.venue ?? "",
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
        vcPicks={vcPicks}
        currentUserId={user.id}
        banter={(banterRes.data ?? []).map((b) => ({ message: b.message, event_type: b.event_type }))}
        userLeagues={userLeagues}
        lastBalls={(match.last_balls as Array<{ ball: number; runs: number; four: boolean; six: boolean; wicket: boolean }>) ?? []}
        snapshots={(snapshotsRes.data ?? []) as Array<{ over_number: number; scores: Record<string, number> }>}
        userNames={Object.fromEntries(userScores.map((s) => [s.user_id, (s.profile as unknown as { display_name: string })?.display_name ?? "?"]))}
        allPlayers={(allPlayersRaw ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role as string,
          team: p.team as unknown as { short_name: string; color: string },
        }))}
      />
    </PageTransition>
  )
}

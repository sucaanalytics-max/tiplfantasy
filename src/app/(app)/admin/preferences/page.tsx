import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fetchAllIn, PAGE_SIZE } from "@/lib/supabase/paginated"
import { redirect } from "next/navigation"
import { PageTransition } from "@/components/page-transition"
import {
  computeUserPreferences,
  type RawSelection,
  type PlayerInfo,
} from "@/lib/analytics"
import { UserPreferencesTable } from "./preferences-table"

export default async function AdminPreferencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  const admin = createAdminClient()

  // Paginate `selections` directly — Supabase caps single-response at 1000 rows,
  // and a 100-user × ~70-match season produces ~7000 rows. Embedded relations
  // can't be paginated, so we fetch selection_players separately via fetchAllIn.
  type SelectionRow = {
    id: string
    user_id: string
    match_id: string
    captain_id: string | null
    vice_captain_id: string | null
    is_auto_pick: boolean
  }
  const fetchAllSelections = async (): Promise<SelectionRow[]> => {
    const all: SelectionRow[] = []
    let from = 0
    while (true) {
      const { data, error } = await admin
        .from("selections")
        .select("id, user_id, match_id, captain_id, vice_captain_id, is_auto_pick")
        .order("id")
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      all.push(...(data as SelectionRow[]))
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
    return all
  }

  const [selections, playersRes, profilesRes, teamsRes, matchesRes] = await Promise.all([
    fetchAllSelections(),
    admin
      .from("players")
      .select("id, name, role, team_id, team:teams(id, short_name, color)")
      .eq("is_active", true),
    admin.from("profiles").select("id, display_name"),
    admin.from("teams").select("id, short_name, color").order("short_name", { ascending: true }),
    admin.from("matches").select("id, team_home_id, team_away_id").limit(200),
  ])

  // Phase 2: selection_players for the fetched selections (paginated by selection_id).
  const spRows = await fetchAllIn<{ selection_id: string; player_id: string }>(
    admin,
    "selection_players",
    "selection_id, player_id",
    "selection_id",
    selections.map((s) => s.id)
  )
  const spBySel = new Map<string, string[]>()
  for (const sp of spRows) {
    const arr = spBySel.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    spBySel.set(sp.selection_id, arr)
  }

  const matchTeams = new Map<string, [string, string]>()
  for (const m of matchesRes.data ?? []) {
    matchTeams.set(m.id, [m.team_home_id, m.team_away_id])
  }

  const teams = teamsRes.data ?? []
  const teamIdToShort = new Map<string, string>(teams.map((t) => [t.id, t.short_name]))
  const teamIdToColor = new Map<string, string>(teams.map((t) => [t.id, t.color]))

  const playerMap = new Map<string, PlayerInfo>()
  for (const p of playersRes.data ?? []) {
    const team = p.team as unknown as { id: string; short_name: string; color: string } | null
    playerMap.set(p.id, {
      id: p.id,
      name: p.name,
      role: p.role,
      team: team?.short_name ?? "?",
      teamId: p.team_id,
      color: team?.color ?? "#888",
      bowlingStyle: null,
    })
  }

  const profileMap = new Map<string, string>()
  for (const p of profilesRes.data ?? []) profileMap.set(p.id, p.display_name)

  const rawSelections: RawSelection[] = selections.map((s) => ({
    user_id: s.user_id,
    match_id: s.match_id,
    captain_id: s.captain_id,
    vice_captain_id: s.vice_captain_id,
    is_auto_pick: s.is_auto_pick,
    players: spBySel.get(s.id) ?? [],
  }))

  const preferences = computeUserPreferences(rawSelections, playerMap, profileMap, teamIdToShort, matchTeams)

  const teamColumns = teams.map((t) => ({
    id: t.id,
    short: t.short_name,
    color: t.color,
  }))

  return (
    <PageTransition>
      <div className="p-4 md:p-6 max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Preferences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each user&apos;s pick distribution by team, role, captaincy, and most-picked player.
            Cells show share of that user&apos;s {totalPicksCaption(preferences)} total picks.
          </p>
        </div>

        {preferences.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No selections recorded yet.
          </p>
        ) : (
          <UserPreferencesTable
            preferences={preferences}
            teamColumns={teamColumns}
            teamIdToColor={Object.fromEntries(teamIdToColor)}
          />
        )}
      </div>
    </PageTransition>
  )
}

function totalPicksCaption(prefs: ReturnType<typeof computeUserPreferences>): string {
  if (!prefs.length) return "0"
  const min = Math.min(...prefs.map((p) => p.totalPicks))
  const max = Math.max(...prefs.map((p) => p.totalPicks))
  return min === max ? `${min}` : `${min}–${max}`
}

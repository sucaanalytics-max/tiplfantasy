export const dynamic = "force-dynamic"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
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

  const [selectionsRes, playersRes, profilesRes, teamsRes] = await Promise.all([
    admin
      .from("selections")
      .select("user_id, match_id, captain_id, vice_captain_id, is_auto_pick, selection_players(player_id)")
      .limit(20000),
    admin
      .from("players")
      .select("id, name, role, team_id, team:teams(id, short_name, color)")
      .eq("is_active", true),
    admin.from("profiles").select("id, display_name"),
    admin.from("teams").select("id, short_name, color").order("short_name", { ascending: true }),
  ])

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

  const rawSelections: RawSelection[] = (selectionsRes.data ?? []).map((s) => ({
    user_id: s.user_id,
    match_id: s.match_id,
    captain_id: s.captain_id,
    vice_captain_id: s.vice_captain_id,
    is_auto_pick: s.is_auto_pick,
    players: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
  }))

  const preferences = computeUserPreferences(rawSelections, playerMap, profileMap, teamIdToShort)

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

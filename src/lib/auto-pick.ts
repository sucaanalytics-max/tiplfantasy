import { createAdminClient } from "@/lib/supabase/admin"
import type { PlayerWithTeam } from "./types"

export type AutoPickResult = {
  success: boolean
  selectionId?: string
  playerIds?: string[]
  source?: "previous_match" | "popular" | "random"
  error?: string
}

/**
 * Creates an auto-pick selection for a user who hasn't submitted a team.
 * Strategy: copy previous match team > most-popular picks > random valid 11.
 * Auto-picks get is_auto_pick=true, captain_id=null, vice_captain_id=null,
 * which means no C/VC multiplier bonus in scoring.
 */
export async function createAutoPick(
  matchId: string,
  userId: string
): Promise<AutoPickResult> {
  const admin = createAdminClient()

  // 1. Verify match exists and is live (auto-pick runs at match lock)
  const { data: match } = await admin
    .from("matches")
    .select("id, status, team_home_id, team_away_id, match_number")
    .eq("id", matchId)
    .single()

  if (!match) return { success: false, error: "Match not found" }
  if (match.status !== "live" && match.status !== "upcoming") {
    return { success: false, error: `Match status is ${match.status}, not live/upcoming` }
  }

  // 2. Check user doesn't already have a selection
  const { count } = await admin
    .from("selections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("match_id", matchId)

  if ((count ?? 0) > 0) {
    return { success: false, error: "User already has a selection for this match" }
  }

  // 3. Get available players (playing XI for this match)
  const { data: playingXI } = await admin
    .from("playing_xi")
    .select("player_id")
    .eq("match_id", matchId)

  const availablePlayerIds = new Set((playingXI ?? []).map((p) => p.player_id))

  // Fetch full player details for available players
  const { data: allPlayers } = await admin
    .from("players")
    .select("*, team:teams(*)")
    .in("team_id", [match.team_home_id, match.team_away_id])
    .eq("is_active", true)

  const availablePlayers = (allPlayers ?? []).filter(
    (p) => availablePlayerIds.size === 0 || availablePlayerIds.has(p.id)
  ) as unknown as PlayerWithTeam[]

  if (availablePlayers.length < 11) {
    return { success: false, error: `Only ${availablePlayers.length} players available, need 11` }
  }

  // 4. Try to copy previous match's team
  let selectedIds: string[] | null = null
  let source: AutoPickResult["source"] = "random"

  const prevSelection = await getPreviousMatchSelection(admin, userId, match.match_number)
  if (prevSelection) {
    // Filter to only players available in this match
    const validPrev = prevSelection.filter((id) =>
      availablePlayers.some((p) => p.id === id)
    )
    if (validPrev.length === 11 && isValidComposition(validPrev, availablePlayers)) {
      selectedIds = validPrev
      source = "previous_match"
    }
  }

  // 5. Fallback: most-selected players by other users
  if (!selectedIds) {
    const popular = await getMostPopularPicks(admin, matchId, availablePlayers)
    if (popular && popular.length === 11 && isValidComposition(popular, availablePlayers)) {
      selectedIds = popular
      source = "popular"
    }
  }

  // 6. Last resort: greedy composition-valid random pick
  if (!selectedIds) {
    selectedIds = buildValidTeam(availablePlayers)
    source = "random"
    if (!selectedIds) {
      return { success: false, error: "Could not build a valid 11-player team" }
    }
  }

  // 7. Insert selection with is_auto_pick=true, no captain/VC
  const { data: sel } = await admin
    .from("selections")
    .insert({
      user_id: userId,
      match_id: matchId,
      captain_id: null,
      vice_captain_id: null,
      is_auto_pick: true,
      locked_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (!sel) return { success: false, error: "Failed to insert selection" }

  await admin.from("selection_players").insert(
    selectedIds.map((pid) => ({ selection_id: sel.id, player_id: pid }))
  )

  return { success: true, selectionId: sel.id, playerIds: selectedIds, source }
}

/**
 * Run auto-pick for all users who haven't submitted a team for a given match.
 */
export async function runAutoPickForMatch(matchId: string): Promise<{
  processed: number
  succeeded: number
  errors: string[]
}> {
  const admin = createAdminClient()

  // Get all users
  const { data: allProfiles } = await admin.from("profiles").select("id").limit(200)
  const allUserIds = (allProfiles ?? []).map((p) => p.id)

  // Get users who already submitted
  const { data: existingSelections } = await admin
    .from("selections")
    .select("user_id")
    .eq("match_id", matchId)
    .limit(200)
  const submittedIds = new Set((existingSelections ?? []).map((s) => s.user_id))

  // Users who need auto-pick
  const missingUsers = allUserIds.filter((id) => !submittedIds.has(id))

  const errors: string[] = []
  let succeeded = 0

  for (const userId of missingUsers) {
    const result = await createAutoPick(matchId, userId)
    if (result.success) {
      succeeded++
    } else {
      errors.push(`${userId}: ${result.error}`)
    }
  }

  return { processed: missingUsers.length, succeeded, errors }
}

// ============================================================
// Internal helpers
// ============================================================

async function getPreviousMatchSelection(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  currentMatchNumber: number
): Promise<string[] | null> {
  // Find the previous match by match_number
  const { data: prevMatch } = await admin
    .from("matches")
    .select("id")
    .lt("match_number", currentMatchNumber)
    .order("match_number", { ascending: false })
    .limit(1)
    .single()

  if (!prevMatch) return null

  const { data: sel } = await admin
    .from("selections")
    .select("id")
    .eq("user_id", userId)
    .eq("match_id", prevMatch.id)
    .single()

  if (!sel) return null

  const { data: players } = await admin
    .from("selection_players")
    .select("player_id")
    .eq("selection_id", sel.id)

  return players?.map((p) => p.player_id) ?? null
}

async function getMostPopularPicks(
  admin: ReturnType<typeof createAdminClient>,
  matchId: string,
  availablePlayers: PlayerWithTeam[]
): Promise<string[] | null> {
  // Get all selections for this match, count player picks
  const { data: selections } = await admin
    .from("selections")
    .select("id")
    .eq("match_id", matchId)

  if (!selections || selections.length === 0) return null

  const selIds = selections.map((s) => s.id)
  const { data: picks } = await admin
    .from("selection_players")
    .select("player_id")
    .in("selection_id", selIds)

  if (!picks) return null

  // Count frequency
  const freq = new Map<string, number>()
  for (const p of picks) {
    freq.set(p.player_id, (freq.get(p.player_id) ?? 0) + 1)
  }

  // Sort available players by popularity
  const sorted = [...availablePlayers].sort(
    (a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0)
  )

  return buildValidTeam(sorted)
}

/**
 * Greedy algorithm to build a composition-valid 11 from sorted candidates.
 * Respects: 1-4 WK, 3-5 BAT, 1-3 AR, 3-5 BOWL, max 7 per team.
 */
function buildValidTeam(candidates: PlayerWithTeam[]): string[] | null {
  const limits = {
    WK: { min: 1, max: 4 },
    BAT: { min: 3, max: 5 },
    AR: { min: 1, max: 3 },
    BOWL: { min: 3, max: 5 },
  }

  // First pass: fill minimums
  const selected: PlayerWithTeam[] = []
  const used = new Set<string>()
  const teamCount = new Map<string, number>()
  const roleCount = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }

  for (const role of ["WK", "BAT", "AR", "BOWL"] as const) {
    const needed = limits[role].min
    for (const p of candidates) {
      if (used.has(p.id) || p.role !== role) continue
      if ((teamCount.get(p.team_id) ?? 0) >= 7) continue
      selected.push(p)
      used.add(p.id)
      roleCount[role]++
      teamCount.set(p.team_id, (teamCount.get(p.team_id) ?? 0) + 1)
      if (roleCount[role] >= needed) break
    }
  }

  // Check minimums met
  for (const role of ["WK", "BAT", "AR", "BOWL"] as const) {
    if (roleCount[role] < limits[role].min) return null
  }

  // Second pass: fill remaining slots to reach 11
  for (const p of candidates) {
    if (selected.length >= 11) break
    if (used.has(p.id)) continue
    if (roleCount[p.role] >= limits[p.role].max) continue
    if ((teamCount.get(p.team_id) ?? 0) >= 7) continue

    selected.push(p)
    used.add(p.id)
    roleCount[p.role]++
    teamCount.set(p.team_id, (teamCount.get(p.team_id) ?? 0) + 1)
  }

  if (selected.length !== 11) return null
  return selected.map((p) => p.id)
}

function isValidComposition(playerIds: string[], allPlayers: PlayerWithTeam[]): boolean {
  const players = playerIds
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter(Boolean) as PlayerWithTeam[]

  if (players.length !== 11) return false

  const byRole = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  const byTeam = new Map<string, number>()

  for (const p of players) {
    byRole[p.role]++
    byTeam.set(p.team_id, (byTeam.get(p.team_id) ?? 0) + 1)
  }

  return (
    byRole.WK >= 1 && byRole.WK <= 4 &&
    byRole.BAT >= 3 && byRole.BAT <= 5 &&
    byRole.AR >= 1 && byRole.AR <= 3 &&
    byRole.BOWL >= 3 && byRole.BOWL <= 5 &&
    Math.max(0, ...byTeam.values()) <= 7
  )
}

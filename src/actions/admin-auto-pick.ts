"use server"

import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildValidTeam } from "@/lib/auto-pick"
import type { PlayerWithTeam } from "@/lib/types"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) throw new Error("Not admin")
  return user.id
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Backfill auto-picks for every user with no selection for the given match.
 * Picks an independently randomized 11 from the Playing 22 per user.
 * No captain/VC set — penalty for being auto-picked (per CLAUDE.md).
 */
export async function randomBackfillAutoPick(matchId: string): Promise<{
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: xi } = await admin
    .from("playing_xi")
    .select("player_id")
    .eq("match_id", matchId)

  const xiIds = (xi ?? []).map((r) => r.player_id)
  if (xiIds.length < 11) {
    throw new Error(`Playing XI not set (${xiIds.length} players); need at least 11`)
  }

  const { data: players } = await admin
    .from("players")
    .select("*, team:teams(*)")
    .in("id", xiIds)

  const xiPlayers = (players ?? []) as unknown as PlayerWithTeam[]

  const { data: allProfiles } = await admin.from("profiles").select("id")
  const allUserIds = (allProfiles ?? []).map((p) => p.id)

  const { data: existing } = await admin
    .from("selections")
    .select("user_id")
    .eq("match_id", matchId)
  const submitted = new Set((existing ?? []).map((s) => s.user_id))

  const missing = allUserIds.filter((id) => !submitted.has(id))

  const errors: string[] = []
  let succeeded = 0

  for (const userId of missing) {
    const shuffled = shuffle(xiPlayers)
    const teamIds = buildValidTeam(shuffled)
    if (!teamIds) {
      errors.push(`${userId}: could not build valid 11 from XI`)
      continue
    }

    const { data: sel, error: selErr } = await admin
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

    if (selErr || !sel) {
      errors.push(`${userId}: insert selection failed: ${selErr?.message ?? "unknown"}`)
      continue
    }

    const { error: spErr } = await admin
      .from("selection_players")
      .insert(teamIds.map((pid) => ({ selection_id: sel.id, player_id: pid })))

    if (spErr) {
      errors.push(`${userId}: insert players failed: ${spErr.message}`)
      continue
    }

    succeeded++
  }

  revalidateTag("selections", "minutes")
  revalidateTag("matches", "minutes")

  return {
    processed: missing.length,
    succeeded,
    failed: missing.length - succeeded,
    errors,
  }
}

"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { searchPlayers } from "@/lib/api/cricapi"
import type { PlayerRole } from "@/lib/types"

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

  if (!profile?.is_admin) throw new Error("Not authorized")
  return user
}

export async function updatePlayer(
  playerId: string,
  updates: {
    role?: PlayerRole
    is_active?: boolean
    credit_cost?: number
    howstat_id?: number | null
  }
) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from("players")
    .update(updates)
    .eq("id", playerId)

  if (error) return { error: error.message }
  return { success: true }
}

export type CricapiIdProposal = {
  playerId: string
  playerName: string
  cricapiId: string
  apiName: string
  country: string
}

/**
 * Preview: search CricAPI for each player without a cricapi_id.
 * Returns proposals — does NOT write to DB.
 */
export async function previewCricapiIdBackfill(): Promise<{
  proposals?: CricapiIdProposal[]
  error?: string
}> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: players, error } = await admin
    .from("players")
    .select("id, name")
    .is("cricapi_id", null)
    .order("name")

  if (error) return { error: error.message }
  if (!players || players.length === 0) return { proposals: [] }

  const proposals: CricapiIdProposal[] = []

  for (const player of players) {
    // Stagger requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 100))
    const results = await searchPlayers(player.name)
    if (results && results.length > 0) {
      proposals.push({
        playerId: player.id,
        playerName: player.name,
        cricapiId: results[0].id,
        apiName: results[0].name,
        country: results[0].country,
      })
    }
  }

  return { proposals }
}

/** Confirm: write the approved cricapi_id proposals to the players table */
export async function confirmCricapiIdBackfill(
  proposals: CricapiIdProposal[]
): Promise<{ success?: boolean; updated?: number; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  let updated = 0
  for (const p of proposals) {
    const { error } = await admin
      .from("players")
      .update({ cricapi_id: p.cricapiId })
      .eq("id", p.playerId)
    if (!error) updated++
  }

  return { success: true, updated }
}

export async function syncPlayerStats(playerId?: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!projectUrl || !serviceKey) {
    return { error: "Missing Supabase config" }
  }

  const body: Record<string, string> = {}
  if (playerId) body.player_id = playerId

  const res = await fetch(`${projectUrl}/functions/v1/sync-player-stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    return { error: `Sync failed: ${text}` }
  }

  const data = await res.json()
  return { success: true, data }
}

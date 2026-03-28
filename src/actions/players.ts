"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSquad, fuzzyMatchName } from "@/lib/api/sportmonks"
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
 * Preview: fetch lineups from recent matches to backfill SportMonks player IDs.
 * Returns proposals — does NOT write to DB.
 */
export async function previewCricapiIdBackfill(): Promise<{
  proposals?: CricapiIdProposal[]
  error?: string
}> {
  await requireAdmin()
  const admin = createAdminClient()

  // Get players without a cricapi_id
  const { data: players, error } = await admin
    .from("players")
    .select("id, name")
    .is("cricapi_id", null)
    .order("name")

  if (error) return { error: error.message }
  if (!players || players.length === 0) return { proposals: [] }

  // Get matches that have a SportMonks fixture ID
  const { data: matches } = await admin
    .from("matches")
    .select("cricapi_match_id")
    .not("cricapi_match_id", "is", null)
    .in("status", ["live", "completed"])
    .order("start_time", { ascending: false })
    .limit(5)

  if (!matches || matches.length === 0) {
    return { error: "No matches with fixture IDs found. Import fixtures first." }
  }

  // Fetch lineups from recent fixtures to collect SportMonks player IDs + names
  const apiPlayers = new Map<string, { id: string; name: string }>() // normalized name → { id, name }
  for (const m of matches) {
    const lineup = await fetchSquad(m.cricapi_match_id)
    if (!lineup) continue
    for (const p of lineup) {
      const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
      if (!apiPlayers.has(norm)) {
        apiPlayers.set(norm, { id: p.id, name: p.name })
      }
    }
  }

  // Build name map for fuzzy matching
  const nameMap = new Map<string, string>()
  for (const [norm, p] of apiPlayers) {
    nameMap.set(norm, p.id)
  }

  const proposals: CricapiIdProposal[] = []
  for (const player of players) {
    const matchedId = fuzzyMatchName(player.name, nameMap)
    if (matchedId) {
      const apiPlayer = [...apiPlayers.values()].find((p) => p.id === matchedId)
      proposals.push({
        playerId: player.id,
        playerName: player.name,
        cricapiId: matchedId,
        apiName: apiPlayer?.name ?? matchedId,
        country: "",
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

"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

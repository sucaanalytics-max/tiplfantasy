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

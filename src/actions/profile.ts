"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function setAutoPickEnabled(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ auto_pick_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateDisplayName(displayName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const trimmed = displayName.trim()
  if (trimmed.length < 2 || trimmed.length > 30) {
    return { error: "Name must be 2-30 characters" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

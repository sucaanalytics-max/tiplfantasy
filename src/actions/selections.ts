"use server"

import { createClient } from "@/lib/supabase/server"
import { validateSelection } from "@/lib/validation"
import type { PlayerWithTeam } from "@/lib/types"

export async function submitSelection(
  matchId: string,
  playerIds: string[],
  captainId: string | null,
  viceCaptainId: string | null
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Check match is still upcoming
  const { data: match } = await supabase
    .from("matches")
    .select("status, start_time")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }
  if (match.status !== "upcoming") return { error: "Match is locked" }
  if (new Date(match.start_time) <= new Date()) return { error: "Match has started" }

  // Fetch player details for validation
  const { data: players } = await supabase
    .from("players")
    .select("*, team:teams(*)")
    .in("id", playerIds)

  if (!players || players.length !== playerIds.length) {
    return { error: "Invalid player selection" }
  }

  const validation = validateSelection(
    players as unknown as PlayerWithTeam[],
    captainId,
    viceCaptainId
  )
  if (!validation.valid) return { error: validation.errors[0] }

  // Check for existing selection
  const { data: existing } = await supabase
    .from("selections")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .single()

  if (existing) {
    // Update existing
    await supabase
      .from("selections")
      .update({
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
        is_auto_pick: false,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    // Replace players
    await supabase.from("selection_players").delete().eq("selection_id", existing.id)
    await supabase.from("selection_players").insert(
      playerIds.map((pid) => ({ selection_id: existing.id, player_id: pid }))
    )
  } else {
    // Insert new
    const { data: sel } = await supabase
      .from("selections")
      .insert({
        user_id: user.id,
        match_id: matchId,
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
        is_auto_pick: false,
        locked_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (!sel) return { error: "Failed to save selection" }

    await supabase.from("selection_players").insert(
      playerIds.map((pid) => ({ selection_id: sel.id, player_id: pid }))
    )
  }

  return { success: true }
}

export async function getMyTeamForMatch(matchId: string): Promise<{
  players: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: selection } = await supabase
    .from("selections")
    .select("captain_id, vice_captain_id, selection_players(player_id, player:players(*, team:teams(*)))")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!selection) return null

  const players = (selection.selection_players as { player_id: string; player: unknown }[])
    .map((sp) => sp.player as PlayerWithTeam)
    .filter(Boolean)

  return {
    players,
    captainId: selection.captain_id as string | null,
    viceCaptainId: selection.vice_captain_id as string | null,
  }
}

"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PredictionCategory, AwardStanding } from "@/lib/types"

const PREDICTION_DEADLINE_MATCH = 11

async function getDeadline(): Promise<Date | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("matches")
    .select("start_time")
    .eq("match_number", PREDICTION_DEADLINE_MATCH)
    .single()
  return data ? new Date(data.start_time) : null
}

async function isPastDeadline(): Promise<boolean> {
  const deadline = await getDeadline()
  if (!deadline) return false // no match 11 yet, allow predictions
  return new Date() >= deadline
}

export async function getPredictionDeadline(): Promise<string | null> {
  const deadline = await getDeadline()
  return deadline?.toISOString() ?? null
}

export async function submitPrediction(
  category: PredictionCategory,
  playerId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (await isPastDeadline()) {
    return { error: "Prediction deadline has passed (Match 11 has started)" }
  }

  const admin = createAdminClient()

  // Verify player exists
  const { data: player } = await admin
    .from("players")
    .select("id")
    .eq("id", playerId)
    .single()
  if (!player) return { error: "Player not found" }

  const { error } = await admin
    .from("season_predictions")
    .upsert(
      {
        user_id: user.id,
        category,
        player_id: playerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category" }
    )

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMyPredictions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("season_predictions")
    .select("*, player:players(name, team_id, role, team:teams(short_name, color))")
    .eq("user_id", user.id)

  return data ?? []
}

export async function getAwardStandings(
  category: PredictionCategory,
  limit = 10
): Promise<AwardStanding[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_award_standings", {
    p_category: category,
    p_limit: limit,
  })
  if (error) return []
  return (data ?? []) as AwardStanding[]
}

export async function getAllPredictions() {
  const admin = createAdminClient()
  const { data } = await admin
    .from("season_predictions")
    .select("*, player:players(name, team_id, team:teams(short_name, color)), profile:profiles(display_name)")

  return data ?? []
}

export async function getCommunityVotes(): Promise<Record<PredictionCategory, { player_id: string; count: number }[]>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("season_predictions")
    .select("category, player_id")

  const empty = { purple_cap: [], orange_cap: [], mvp: [] } as Record<PredictionCategory, { player_id: string; count: number }[]>
  if (!data) return empty

  const counts: Record<string, Record<string, number>> = {}
  for (const row of data) {
    if (!counts[row.category]) counts[row.category] = {}
    counts[row.category][row.player_id] = (counts[row.category][row.player_id] ?? 0) + 1
  }

  const result = { ...empty }
  for (const cat of ["purple_cap", "orange_cap", "mvp"] as PredictionCategory[]) {
    result[cat] = Object.entries(counts[cat] ?? {})
      .map(([player_id, count]) => ({ player_id, count }))
      .sort((a, b) => b.count - a.count)
  }
  return result
}

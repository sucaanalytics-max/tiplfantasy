"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadScoringRules, calculatePlayerPoints, calculateUserMatchScore } from "@/lib/scoring"
import type { PlayerStats } from "@/lib/scoring"
import { resolveMatchChallenges } from "@/actions/h2h"

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

export async function savePlayerScores(
  matchId: string,
  scores: Array<{ playerId: string; stats: PlayerStats }>
) {
  await requireAdmin()
  const admin = createAdminClient()
  const rules = await loadScoringRules()

  // Delete existing scores for this match
  await admin.from("match_player_scores").delete().eq("match_id", matchId)

  // Calculate and insert
  const rows = scores.map(({ playerId, stats }) => {
    const { total, breakdown } = calculatePlayerPoints(stats, rules)
    return {
      match_id: matchId,
      player_id: playerId,
      runs: stats.runs,
      balls_faced: stats.balls_faced,
      fours: stats.fours,
      sixes: stats.sixes,
      wickets: stats.wickets,
      overs_bowled: stats.overs_bowled,
      runs_conceded: stats.runs_conceded,
      maidens: stats.maidens,
      catches: stats.catches,
      stumpings: stats.stumpings,
      run_outs: stats.run_outs,
      fantasy_points: total,
      breakdown,
    }
  })

  const { error } = await admin.from("match_player_scores").insert(rows)
  if (error) return { error: error.message }
  return { success: true }
}

export async function calculateMatchPoints(matchId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  // Get player scores for this match
  const { data: playerScores } = await admin
    .from("match_player_scores")
    .select("player_id, fantasy_points")
    .eq("match_id", matchId)

  if (!playerScores || playerScores.length === 0) {
    return { error: "No player scores found. Save scores first." }
  }

  const scoreMap = new Map(playerScores.map((s) => [s.player_id, s.fantasy_points]))

  // Get all selections for this match (up to 100 users)
  const { data: selections } = await admin
    .from("selections")
    .select("id, user_id, captain_id, vice_captain_id, is_auto_pick")
    .eq("match_id", matchId)
    .limit(200)

  if (!selections || selections.length === 0) {
    return { error: "No selections found for this match" }
  }

  // Get selection players (100 users × 11 players = 1100 rows, exceeds Supabase 1000 default)
  const selectionIds = selections.map((s) => s.id)
  const { data: selPlayers } = await admin
    .from("selection_players")
    .select("selection_id, player_id")
    .in("selection_id", selectionIds)
    .limit(2200)

  if (!selPlayers) return { error: "Failed to load selection players" }

  // Group players by selection
  const playersBySelection = new Map<string, string[]>()
  for (const sp of selPlayers) {
    const arr = playersBySelection.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    playersBySelection.set(sp.selection_id, arr)
  }

  // Calculate per-user scores
  const userScores = selections.map((sel) => {
    const result = calculateUserMatchScore(
      {
        userId: sel.user_id,
        selectionId: sel.id,
        captainId: sel.captain_id,
        viceCaptainId: sel.vice_captain_id,
        isAutoPick: sel.is_auto_pick,
        playerIds: playersBySelection.get(sel.id) ?? [],
      },
      scoreMap
    )
    return {
      userId: sel.user_id,
      total: result.total,
      captainPoints: result.captainPoints,
      vcPoints: result.vcPoints,
      rank: 0,
    }
  })

  // Sort by total descending for ranking
  userScores.sort((a, b) => b.total - a.total)

  // Assign ranks (handle ties)
  let currentRank = 1
  for (let i = 0; i < userScores.length; i++) {
    if (i > 0 && userScores[i].total < userScores[i - 1].total) {
      currentRank = i + 1
    }
    userScores[i].rank = currentRank
  }

  // Delete existing user match scores
  await admin.from("user_match_scores").delete().eq("match_id", matchId)

  // Insert user match scores
  const rows = userScores.map((s) => ({
    user_id: s.userId,
    match_id: matchId,
    total_points: s.total,
    rank: s.rank,
    captain_points: s.captainPoints,
    vc_points: s.vcPoints,
    breakdown: null,
  }))

  const { error } = await admin.from("user_match_scores").insert(rows)
  if (error) return { error: error.message }

  // Update match status to completed
  await admin.from("matches").update({ status: "completed" }).eq("id", matchId)

  // Refresh leaderboard
  await admin.rpc("refresh_leaderboard")

  // Resolve H2H challenges for this match
  await resolveMatchChallenges(matchId).catch(() => {
    // Non-critical — don't fail scoring if H2H resolution fails
  })

  // Fire-and-forget: update player stats tables (season/venue/vs-team)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    fetch(`${supabaseUrl}/functions/v1/update-player-stats`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ match_id: matchId }),
    }).catch(() => {
      // Non-critical — don't fail scoring if stats update fails
    })
  }

  return { success: true, results: userScores }
}

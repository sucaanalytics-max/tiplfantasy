"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadScoringRules, calculatePlayerPoints, calculateUserMatchScore } from "@/lib/scoring"
import { fetchMatchInfo } from "@/lib/api/sportmonks"
import type { PlayerStats } from "@/lib/scoring"

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
      dismissal: stats.dismissal ?? null,
      batting_position: stats.batting_position ?? null,
    }
  })

  const { error } = await admin.from("match_player_scores").insert(rows)
  if (error) return { error: error.message }
  return { success: true }
}

export async function calculateMatchPoints(matchId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  // Apply POTM bonus before calculating user scores
  try {
    const { data: matchRow } = await admin
      .from("matches")
      .select("cricapi_match_id")
      .eq("id", matchId)
      .single()

    if (matchRow?.cricapi_match_id) {
      const rules = await loadScoringRules()
      const potmPts = rules.find((r) => r.name === "potm")?.points ?? 0
      if (potmPts > 0) {
        const fixtureInfo = await fetchMatchInfo(matchRow.cricapi_match_id)
        if (fixtureInfo?.man_of_match_id) {
          const { data: potmPlayer } = await admin
            .from("players").select("id").eq("cricapi_id", String(fixtureInfo.man_of_match_id)).single()
          if (potmPlayer) {
            const { data: mps } = await admin
              .from("match_player_scores")
              .select("fantasy_points, breakdown")
              .eq("match_id", matchId).eq("player_id", potmPlayer.id).single()
            if (mps) {
              const bd = (mps.breakdown as Record<string, number>) ?? {}
              if (!bd.potm) {
                bd.potm = potmPts
                const newTotal = Object.values(bd).reduce((a, b) => a + b, 0)
                await admin.from("match_player_scores")
                  .update({ fantasy_points: newTotal, breakdown: bd })
                  .eq("match_id", matchId).eq("player_id", potmPlayer.id)
              }
            }
          }
        }
      }
    }
  } catch { /* POTM is non-critical — don't fail scoring */ }

  // Get player scores for this match (after POTM applied)
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

/**
 * Calculates provisional user points mid-match without finalising.
 * Safe to run multiple times — upserts instead of replacing.
 * Does NOT update match status, leaderboard, or H2H.
 */
export async function calculateLiveMatchPoints(matchId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: playerScores } = await admin
    .from("match_player_scores")
    .select("player_id, fantasy_points")
    .eq("match_id", matchId)

  if (!playerScores || playerScores.length === 0) {
    return { error: "No player scores found. Fetch scorecard and save scores first." }
  }

  const scoreMap = new Map(playerScores.map((s) => [s.player_id, s.fantasy_points]))

  const { data: selections } = await admin
    .from("selections")
    .select("id, user_id, captain_id, vice_captain_id, is_auto_pick")
    .eq("match_id", matchId)
    .limit(200)

  if (!selections || selections.length === 0) {
    return { error: "No selections found for this match" }
  }

  const selectionIds = selections.map((s) => s.id)
  const { data: selPlayers } = await admin
    .from("selection_players")
    .select("selection_id, player_id")
    .in("selection_id", selectionIds)
    .limit(2200)

  if (!selPlayers) return { error: "Failed to load selection players" }

  const playersBySelection = new Map<string, string[]>()
  for (const sp of selPlayers) {
    const arr = playersBySelection.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    playersBySelection.set(sp.selection_id, arr)
  }

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
    return { userId: sel.user_id, total: result.total, captainPoints: result.captainPoints, vcPoints: result.vcPoints, rank: 0 }
  })

  userScores.sort((a, b) => b.total - a.total)
  let currentRank = 1
  for (let i = 0; i < userScores.length; i++) {
    if (i > 0 && userScores[i].total < userScores[i - 1].total) currentRank = i + 1
    userScores[i].rank = currentRank
  }

  const rows = userScores.map((s) => ({
    user_id: s.userId,
    match_id: matchId,
    total_points: s.total,
    rank: s.rank,
    captain_points: s.captainPoints,
    vc_points: s.vcPoints,
    breakdown: null,
  }))

  // Upsert — safe to run repeatedly during a live match
  const { error } = await admin
    .from("user_match_scores")
    .upsert(rows, { onConflict: "user_id,match_id" })
  if (error) return { error: error.message }

  // Record when live points were last calculated
  await admin.from("matches").update({ live_scores_at: new Date().toISOString() }).eq("id", matchId)

  return { success: true, count: userScores.length }
}

/**
 * Recalculates user_match_scores from current match_player_scores.
 * Used after POTM bonus is applied retroactively (e.g. backfill cron).
 * No admin auth — called from server-side cron context.
 */
export async function recalculateUserMatchScores(matchId: string) {
  const admin = createAdminClient()

  const { data: playerScores } = await admin
    .from("match_player_scores")
    .select("player_id, fantasy_points")
    .eq("match_id", matchId)

  if (!playerScores || playerScores.length === 0) return

  const scoreMap = new Map(playerScores.map((s) => [s.player_id, s.fantasy_points]))

  const { data: selections } = await admin
    .from("selections")
    .select("id, user_id, captain_id, vice_captain_id, is_auto_pick")
    .eq("match_id", matchId)
    .limit(200)

  if (!selections || selections.length === 0) return

  const selectionIds = selections.map((s) => s.id)
  const { data: selPlayers } = await admin
    .from("selection_players")
    .select("selection_id, player_id")
    .in("selection_id", selectionIds)
    .limit(2200)

  if (!selPlayers) return

  const playersBySelection = new Map<string, string[]>()
  for (const sp of selPlayers) {
    const arr = playersBySelection.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    playersBySelection.set(sp.selection_id, arr)
  }

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
    const breakdown: Record<string, number> = {}
    for (const pid of playersBySelection.get(sel.id) ?? []) {
      const pts = scoreMap.get(pid) ?? 0
      if (pts > 0) breakdown[pid] = pts
    }
    return { userId: sel.user_id, total: result.total, captainPoints: result.captainPoints, vcPoints: result.vcPoints, rank: 0, breakdown }
  })

  userScores.sort((a, b) => b.total - a.total)
  let currentRank = 1
  for (let i = 0; i < userScores.length; i++) {
    if (i > 0 && userScores[i].total < userScores[i - 1].total) currentRank = i + 1
    userScores[i].rank = currentRank
  }

  const rows = userScores.map((s) => ({
    user_id: s.userId,
    match_id: matchId,
    total_points: s.total,
    rank: s.rank,
    captain_points: s.captainPoints,
    vc_points: s.vcPoints,
    breakdown: s.breakdown,
  }))

  await admin
    .from("user_match_scores")
    .upsert(rows, { onConflict: "user_id,match_id" })

  await admin.rpc("refresh_leaderboard")
}

/**
 * Applies POTM bonus to a completed match by fetching man_of_match from SportMonks.
 * Idempotent — skips if POTM already applied. Recalculates user scores after.
 */
export async function applyPotmBonus(matchId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  // Get the match's cricapi_match_id
  const { data: match } = await admin
    .from("matches")
    .select("cricapi_match_id, match_number")
    .eq("id", matchId)
    .single()

  if (!match?.cricapi_match_id) {
    return { error: "Match has no cricapi_match_id" }
  }

  // Check if POTM already applied
  const { data: existingPotm } = await admin
    .from("match_player_scores")
    .select("player_id, breakdown")
    .eq("match_id", matchId)

  const alreadyApplied = (existingPotm ?? []).some((s) => {
    const bd = s.breakdown as Record<string, number> | null
    return bd && bd.potm != null
  })

  if (alreadyApplied) {
    return { error: "POTM bonus already applied to this match" }
  }

  // Load POTM points from scoring rules
  const rules = await loadScoringRules()
  const potmPts = rules.find((r) => r.name === "potm")?.points ?? 0
  if (potmPts <= 0) {
    return { error: "POTM scoring rule not found or has 0 points" }
  }

  // Fetch fixture info from SportMonks
  const fixtureInfo = await fetchMatchInfo(match.cricapi_match_id)
  if (!fixtureInfo?.man_of_match_id) {
    return { error: "No Man of the Match data available from API" }
  }

  // Find the POTM player in our DB
  const { data: potmPlayer } = await admin
    .from("players")
    .select("id, name")
    .eq("cricapi_id", String(fixtureInfo.man_of_match_id))
    .single()

  if (!potmPlayer) {
    return { error: `POTM player not found in DB (cricapi_id: ${fixtureInfo.man_of_match_id})` }
  }

  // Get their current score row
  const { data: mps } = await admin
    .from("match_player_scores")
    .select("fantasy_points, breakdown")
    .eq("match_id", matchId)
    .eq("player_id", potmPlayer.id)
    .single()

  if (!mps) {
    return { error: `No score row found for POTM player ${potmPlayer.name}` }
  }

  // Apply bonus
  const bd = (mps.breakdown as Record<string, number>) ?? {}
  bd.potm = potmPts
  const newTotal = Object.values(bd).reduce((a, b) => a + b, 0)

  await admin
    .from("match_player_scores")
    .update({ fantasy_points: newTotal, breakdown: bd })
    .eq("match_id", matchId)
    .eq("player_id", potmPlayer.id)

  // Recalculate user scores with updated POTM
  await recalculateUserMatchScores(matchId)

  return { success: true, playerName: potmPlayer.name, bonus: potmPts }
}

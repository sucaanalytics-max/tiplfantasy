"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSquad, fetchScorecard, parseScorecardToStats, fuzzyMatchName } from "@/lib/api/cricapi"
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

export async function lockMatch(matchId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from("matches")
    .update({ status: "live", updated_at: new Date().toISOString() })
    .eq("id", matchId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function markNoResult(matchId: string): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  // Give flat 15 points to everyone who made a selection
  const { data: selections } = await admin
    .from("selections")
    .select("user_id")
    .eq("match_id", matchId)

  if (selections && selections.length > 0) {
    await admin.from("user_match_scores").delete().eq("match_id", matchId)

    const rows = selections.map((s) => ({
      user_id: s.user_id,
      match_id: matchId,
      total_points: 15,
      rank: 1,
      captain_points: 0,
      vc_points: 0,
      breakdown: null,
    }))

    const { error: insertError } = await admin.from("user_match_scores").insert(rows)
    if (insertError) return { error: `Failed to insert scores: ${insertError.message}` }
  }

  await admin
    .from("matches")
    .update({ status: "no_result", updated_at: new Date().toISOString() })
    .eq("id", matchId)

  await admin.rpc("refresh_leaderboard")

  return { success: true }
}

export async function fetchPlayingXI(matchId: string, cricapiMatchId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const squad = await fetchSquad(cricapiMatchId)
  if (!squad) return { error: "Failed to fetch squad from CricAPI" }

  const { data: match } = await admin
    .from("matches")
    .select("team_home_id, team_away_id")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  const { data: dbPlayers } = await admin
    .from("players")
    .select("id, name, team_id")
    .in("team_id", [match.team_home_id, match.team_away_id])

  if (!dbPlayers) return { error: "Failed to load players" }

  const nameMap = new Map<string, string>()
  for (const p of dbPlayers) {
    nameMap.set(
      p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(),
      p.id
    )
  }

  const matched: string[] = []
  const unmatched: string[] = []

  for (const apiPlayer of squad) {
    const dbId = fuzzyMatchName(apiPlayer.name, nameMap)
    if (dbId) {
      matched.push(dbId)
    } else {
      unmatched.push(apiPlayer.name)
    }
  }

  // Deduplicate — fuzzyMatchName can map multiple API names to the same DB player
  const deduped = [...new Set(matched)]

  if (deduped.length === 0) {
    return { error: "No players matched from API response" }
  }

  // Validate: must be exactly 11 per team (22 total) — not full squad
  const playerTeamMap = new Map(dbPlayers.map((p) => [p.id, p.team_id]))
  const byTeam = new Map<string, string[]>()
  for (const pid of deduped) {
    const tid = playerTeamMap.get(pid)
    if (!tid) continue
    const list = byTeam.get(tid) ?? []
    list.push(pid)
    byTeam.set(tid, list)
  }

  const teamCounts = [...byTeam.values()].map((v) => v.length)
  if (teamCounts.length !== 2 || teamCounts.some((c) => c !== 11)) {
    return {
      error: `Squad data returned (${deduped.length} players: ${teamCounts.join(" + ")}), not confirmed Playing XI (11+11). Try again after toss.`,
    }
  }

  await admin.from("playing_xi").delete().eq("match_id", matchId)
  const { error: insertError } = await admin.from("playing_xi").insert(
    deduped.map((pid) => ({
      match_id: matchId,
      player_id: pid,
      team_id: playerTeamMap.get(pid)!,
    }))
  )
  if (insertError) return { error: `Failed to insert Playing XI: ${insertError.message}` }

  return { success: true, matched: deduped.length, unmatched }
}

export async function fetchMatchScorecard(
  matchId: string,
  cricapiMatchId: string
): Promise<{
  error?: string
  success?: boolean
  scores?: Array<{ playerId: string; playerName: string; stats: PlayerStats }>
  unmatched?: string[]
}> {
  await requireAdmin()
  const admin = createAdminClient()

  const innings = await fetchScorecard(cricapiMatchId)
  if (!innings) return { error: "Failed to fetch scorecard from CricAPI" }

  const parsed = parseScorecardToStats(innings)

  const { data: match } = await admin
    .from("matches")
    .select("team_home_id, team_away_id")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }

  const { data: dbPlayers } = await admin
    .from("players")
    .select("id, name")
    .in("team_id", [match.team_home_id, match.team_away_id])

  if (!dbPlayers) return { error: "Failed to load players" }

  const nameMap = new Map<string, string>()
  const idToName = new Map<string, string>()
  for (const p of dbPlayers) {
    const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
    nameMap.set(norm, p.id)
    idToName.set(p.id, p.name)
  }

  const scores: Array<{ playerId: string; playerName: string; stats: PlayerStats }> = []
  const unmatched: string[] = []

  for (const [apiName, stats] of parsed) {
    const dbId = fuzzyMatchName(apiName, nameMap)
    if (dbId) {
      scores.push({ playerId: dbId, playerName: idToName.get(dbId) ?? apiName, stats })
    } else {
      unmatched.push(apiName)
    }
  }

  return { success: true, scores, unmatched }
}

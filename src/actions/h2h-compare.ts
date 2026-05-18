"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchAllIn } from "@/lib/supabase/paginated"
import { unstable_cache } from "next/cache"
import type { PlayerRole } from "@/lib/types"

export type H2HPlayerRow = {
  player_id: string
  player_name: string
  player_role: PlayerRole
  team_short_name: string
  team_color: string
  a_matches_picked: number
  a_captain_count: number
  a_vc_count: number
  a_eo_pct: number
  a_contribution: number
  b_matches_picked: number
  b_captain_count: number
  b_vc_count: number
  b_eo_pct: number
  b_contribution: number
  matches_on_scorecard: number
  net_edge: number
}

export type H2HUser = {
  id: string
  display_name: string
  season_total: number
}

export type H2HCompareResult = {
  a_user: H2HUser
  b_user: H2HUser
  matches_compared: number
  total_edge: number
  players: H2HPlayerRow[]
}

type MatchRow = { id: string; match_number: number }
type SelectionRow = {
  id: string
  user_id: string
  match_id: string
  captain_id: string | null
  vice_captain_id: string | null
}
type SelectionPlayerRow = { id: string; selection_id: string; player_id: string }
type ScoreRow = { id: string; match_id: string; player_id: string; fantasy_points: number | string }
type PlayerJoined = {
  id: string
  name: string
  role: PlayerRole
  team: { short_name: string; color: string } | null
}

async function _compareTwoUsersSeason(
  userIdA: string,
  userIdB: string
): Promise<H2HCompareResult> {
  const empty: H2HCompareResult = {
    a_user: { id: userIdA, display_name: "?", season_total: 0 },
    b_user: { id: userIdB, display_name: "?", season_total: 0 },
    matches_compared: 0,
    total_edge: 0,
    players: [],
  }

  if (!userIdA || !userIdB || userIdA === userIdB) return empty

  const admin = createAdminClient()

  // 1. Profiles + season totals (summed from user_match_scores)
  const [{ data: profiles }, { data: scoreTotals }] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", [userIdA, userIdB]),
    admin
      .from("user_match_scores")
      .select("user_id, total_points")
      .in("user_id", [userIdA, userIdB])
      .limit(500),
  ])

  if (!profiles || profiles.length === 0) return empty

  const profMap = new Map(profiles.map((p) => [p.id, p.display_name as string]))
  const totalsMap = new Map<string, number>()
  for (const row of scoreTotals ?? []) {
    totalsMap.set(
      row.user_id,
      (totalsMap.get(row.user_id) ?? 0) + Number(row.total_points)
    )
  }
  const a_user: H2HUser = {
    id: userIdA,
    display_name: profMap.get(userIdA) ?? "?",
    season_total: Math.round(totalsMap.get(userIdA) ?? 0),
  }
  const b_user: H2HUser = {
    id: userIdB,
    display_name: profMap.get(userIdB) ?? "?",
    season_total: Math.round(totalsMap.get(userIdB) ?? 0),
  }

  // 2. Completed / no-result matches
  const { data: matchesRaw } = await admin
    .from("matches")
    .select("id, match_number")
    .in("status", ["completed", "no_result"])
    .order("start_time", { ascending: true })
    .limit(200)

  const matches = (matchesRaw ?? []) as MatchRow[]
  const matchIds = matches.map((m) => m.id)
  if (matchIds.length === 0) return { ...empty, a_user, b_user }

  // 3. Selections for both users
  const { data: selectionsRaw } = await admin
    .from("selections")
    .select("id, user_id, match_id, captain_id, vice_captain_id")
    .in("user_id", [userIdA, userIdB])
    .in("match_id", matchIds)
    .limit(500)

  const selections = (selectionsRaw ?? []) as SelectionRow[]
  if (selections.length === 0) return { ...empty, a_user, b_user }

  const selectionIds = selections.map((s) => s.id)

  // 4. Selection players (paginate — 2 users × ~61 matches × 11 ≈ 1342)
  const selPlayers = await fetchAllIn<SelectionPlayerRow>(
    admin,
    "selection_players",
    "id, selection_id, player_id",
    "selection_id",
    selectionIds
  )

  // 5. Match player scores (paginate — 61 × 22 ≈ 1342)
  const scores = await fetchAllIn<ScoreRow>(
    admin,
    "match_player_scores",
    "id, match_id, player_id, fantasy_points",
    "match_id",
    matchIds
  )

  // 6. Players + teams for all involved player_ids
  const playerIdSet = new Set<string>()
  for (const sp of selPlayers) playerIdSet.add(sp.player_id)
  for (const s of scores) playerIdSet.add(s.player_id)
  const playerIds = Array.from(playerIdSet)

  const { data: playersRaw } = await admin
    .from("players")
    .select("id, name, role, team:teams(short_name, color)")
    .in("id", playerIds)
    .limit(500)

  const players = (playersRaw ?? []) as unknown as PlayerJoined[]
  const playerMap = new Map(players.map((p) => [p.id, p]))

  // ── Build lookup maps ─────────────────────────────────────────
  const playersBySel = new Map<string, string[]>()
  for (const sp of selPlayers) {
    const arr = playersBySel.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    playersBySel.set(sp.selection_id, arr)
  }

  const fpLookup = new Map<string, number>()
  const playerAppearances = new Map<string, number>()
  for (const s of scores) {
    fpLookup.set(`${s.match_id}:${s.player_id}`, Number(s.fantasy_points))
    playerAppearances.set(s.player_id, (playerAppearances.get(s.player_id) ?? 0) + 1)
  }

  const matchSetByUser = new Map<string, Set<string>>([
    [userIdA, new Set<string>()],
    [userIdB, new Set<string>()],
  ])
  for (const sel of selections) matchSetByUser.get(sel.user_id)?.add(sel.match_id)

  // ── Aggregate per player ──────────────────────────────────────
  type Agg = {
    a_picks: number
    a_captain: number
    a_vc: number
    a_weighted: number
    a_contribution: number
    b_picks: number
    b_captain: number
    b_vc: number
    b_weighted: number
    b_contribution: number
  }
  const newAgg = (): Agg => ({
    a_picks: 0, a_captain: 0, a_vc: 0, a_weighted: 0, a_contribution: 0,
    b_picks: 0, b_captain: 0, b_vc: 0, b_weighted: 0, b_contribution: 0,
  })
  const aggByPlayer = new Map<string, Agg>()

  for (const sel of selections) {
    const isA = sel.user_id === userIdA
    const picked = playersBySel.get(sel.id) ?? []
    for (const pid of picked) {
      const base = fpLookup.get(`${sel.match_id}:${pid}`) ?? 0
      let mult = 1
      let isCaptain = false
      let isVc = false
      // C/VC multiplier — mirrors src/lib/scoring.ts post-fix.
      // captain_id can be null (pure auto-pick); strict equality handles that.
      if (pid === sel.captain_id) { mult = 2; isCaptain = true }
      else if (pid === sel.vice_captain_id) { mult = 1.5; isVc = true }

      const acc = aggByPlayer.get(pid) ?? newAgg()
      if (isA) {
        acc.a_picks++
        if (isCaptain) acc.a_captain++
        if (isVc) acc.a_vc++
        acc.a_weighted += mult
        acc.a_contribution += base * mult
      } else {
        acc.b_picks++
        if (isCaptain) acc.b_captain++
        if (isVc) acc.b_vc++
        acc.b_weighted += mult
        acc.b_contribution += base * mult
      }
      aggByPlayer.set(pid, acc)
    }
  }

  // ── Build rows ────────────────────────────────────────────────
  const rows: H2HPlayerRow[] = []
  for (const [pid, acc] of aggByPlayer) {
    const p = playerMap.get(pid)
    if (!p) continue
    const onCard = playerAppearances.get(pid) ?? 0
    rows.push({
      player_id: pid,
      player_name: p.name,
      player_role: p.role,
      team_short_name: p.team?.short_name ?? "—",
      team_color: p.team?.color ?? "#888",
      a_matches_picked: acc.a_picks,
      a_captain_count: acc.a_captain,
      a_vc_count: acc.a_vc,
      a_eo_pct: onCard > 0 ? Math.round((acc.a_weighted / onCard) * 1000) / 10 : 0,
      a_contribution: Math.round(acc.a_contribution),
      b_matches_picked: acc.b_picks,
      b_captain_count: acc.b_captain,
      b_vc_count: acc.b_vc,
      b_eo_pct: onCard > 0 ? Math.round((acc.b_weighted / onCard) * 1000) / 10 : 0,
      b_contribution: Math.round(acc.b_contribution),
      matches_on_scorecard: onCard,
      net_edge: Math.round(acc.a_contribution - acc.b_contribution),
    })
  }

  rows.sort((a, b) => b.net_edge - a.net_edge)

  const aSet = matchSetByUser.get(userIdA) ?? new Set()
  const bSet = matchSetByUser.get(userIdB) ?? new Set()
  let matchesCompared = 0
  for (const m of aSet) if (bSet.has(m)) matchesCompared++

  const totalEdge = rows.reduce((s, r) => s + r.net_edge, 0)

  return {
    a_user,
    b_user,
    matches_compared: matchesCompared,
    total_edge: totalEdge,
    players: rows,
  }
}

export const compareTwoUsersSeason = unstable_cache(
  _compareTwoUsersSeason,
  ["h2h-compare-v1"],
  { tags: ["user-data", "leaderboard"], revalidate: 300 }
)

export type ProfileOption = { id: string; display_name: string }

export async function listProfilesForH2H(): Promise<ProfileOption[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select("id, display_name")
    .order("display_name", { ascending: true })
    .limit(500)
  return (data ?? []) as ProfileOption[]
}

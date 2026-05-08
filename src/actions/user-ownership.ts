"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { unstable_cache } from "next/cache"
import type {
  HeroRow,
  OwnershipInsights,
  PlayerRole,
  RegretRow,
} from "@/lib/types"

type PlayerRow = {
  id: string
  name: string
  role: PlayerRole
  team_id: string
  team: { short_name: string } | null
}

type SelectionRow = {
  id: string
  match_id: string
  captain_id: string | null
  vice_captain_id: string | null
}

type ScoreRow = {
  match_id: string
  player_id: string
  fantasy_points: number
}

type SelectionPlayerRow = {
  selection_id: string
  player_id: string
}

type UserMatchScoreRow = {
  match_id: string
  rank: number | null
}

type MatchRow = {
  id: string
  match_number: number
  team_home: { short_name: string } | null
  team_away: { short_name: string } | null
}

const EMPTY: OwnershipInsights = {
  regrets: [],
  heroes: [],
  rankOneMatchCount: 0,
  totalCost: 0,
  matchesAnalysed: 0,
}

async function loadRaw(userId: string) {
  const admin = createAdminClient()

  const [{ data: matchesRaw }, { data: selectionsRaw }, { data: userScoresRaw }] =
    await Promise.all([
      admin
        .from("matches")
        .select(
          "id, match_number, " +
            "team_home:teams!matches_team_home_id_fkey(short_name), " +
            "team_away:teams!matches_team_away_id_fkey(short_name)"
        )
        .in("status", ["completed", "no_result"])
        .order("start_time", { ascending: true })
        .limit(200),
      admin
        .from("selections")
        .select("id, match_id, captain_id, vice_captain_id")
        .eq("user_id", userId)
        .not("locked_at", "is", null)
        .limit(200),
      admin
        .from("user_match_scores")
        .select("match_id, rank")
        .eq("user_id", userId)
        .limit(200),
    ])

  const matches = (matchesRaw ?? []) as unknown as MatchRow[]
  const selections = (selectionsRaw ?? []) as SelectionRow[]
  const userScores = (userScoresRaw ?? []) as UserMatchScoreRow[]

  const matchIds = matches.map((m) => m.id)
  const selectionIds = selections.map((s) => s.id)

  if (matchIds.length === 0 || selectionIds.length === 0) {
    return null
  }

  const [{ data: selPlayersRaw }, { data: scoresRaw }, { data: playersRaw }] =
    await Promise.all([
      admin
        .from("selection_players")
        .select("selection_id, player_id")
        .in("selection_id", selectionIds)
        .limit(5000),
      admin
        .from("match_player_scores")
        .select("match_id, player_id, fantasy_points")
        .in("match_id", matchIds)
        .limit(10000),
      admin
        .from("players")
        .select("id, name, role, team_id, team:teams(short_name)")
        .limit(500),
    ])

  return {
    matches,
    selections,
    userScores,
    selectionPlayers: (selPlayersRaw ?? []) as SelectionPlayerRow[],
    scores: (scoresRaw ?? []) as ScoreRow[],
    players: (playersRaw ?? []) as unknown as PlayerRow[],
  }
}

function computeInsights(
  raw: NonNullable<Awaited<ReturnType<typeof loadRaw>>>
): OwnershipInsights {
  const { matches, selections, userScores, selectionPlayers, scores, players } = raw

  const playerMap = new Map<string, PlayerRow>()
  for (const p of players) playerMap.set(p.id, p)

  const matchMap = new Map<string, MatchRow>()
  for (const m of matches) matchMap.set(m.id, m)

  // matchId -> rank
  const userRankByMatch = new Map<string, number | null>()
  for (const us of userScores) userRankByMatch.set(us.match_id, us.rank)

  // selectionId -> playerIds[]
  const selPlayersBySel = new Map<string, string[]>()
  for (const sp of selectionPlayers) {
    const arr = selPlayersBySel.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    selPlayersBySel.set(sp.selection_id, arr)
  }

  // matchId -> Array<{player_id, fp}>
  const scoresByMatch = new Map<string, ScoreRow[]>()
  for (const s of scores) {
    const arr = scoresByMatch.get(s.match_id) ?? []
    arr.push(s)
    scoresByMatch.set(s.match_id, arr)
  }

  // matchId:player_id -> fp
  const fpLookup = new Map<string, number>()
  for (const s of scores) {
    fpLookup.set(`${s.match_id}:${s.player_id}`, Number(s.fantasy_points))
  }

  // Aggregators
  type RegretAcc = {
    totalCost: number
    matchesCount: number
    pointsSum: number
    worst: { match_number: number; cost: number; matchup: string } | null
  }
  const regretAgg = new Map<string, RegretAcc>()

  type HeroAcc = {
    totalContribution: number
    matchesCount: number
    captained: number
    vcCount: number
    best: { match_number: number; contribution: number; matchup: string } | null
  }
  const heroAgg = new Map<string, HeroAcc>()

  let rankOneMatchCount = 0
  let matchesAnalysed = 0

  for (const sel of selections) {
    const match = matchMap.get(sel.match_id)
    if (!match) continue
    matchesAnalysed++

    const matchup = `${match.team_home?.short_name ?? "?"} vs ${match.team_away?.short_name ?? "?"}`
    const pickedIds = selPlayersBySel.get(sel.id) ?? []
    const pickedSet = new Set(pickedIds)
    const matchScores = scoresByMatch.get(sel.match_id) ?? []

    // ── REGRETS ─────────────────────────────────────────────
    // Build worst-pick-points per role from user's actual picks
    const minPickedPtsByRole = new Map<PlayerRole, number>()
    let minPickedPtsAny = Number.POSITIVE_INFINITY
    for (const pid of pickedIds) {
      const pInfo = playerMap.get(pid)
      if (!pInfo) continue
      const pts = fpLookup.get(`${sel.match_id}:${pid}`) ?? 0
      const cur = minPickedPtsByRole.get(pInfo.role)
      if (cur === undefined || pts < cur) minPickedPtsByRole.set(pInfo.role, pts)
      if (pts < minPickedPtsAny) minPickedPtsAny = pts
    }
    if (!Number.isFinite(minPickedPtsAny)) minPickedPtsAny = 0

    for (const s of matchScores) {
      if (pickedSet.has(s.player_id)) continue
      const pInfo = playerMap.get(s.player_id)
      if (!pInfo) continue
      const nonOwnedPts = Number(s.fantasy_points)
      const baseline = minPickedPtsByRole.get(pInfo.role) ?? minPickedPtsAny
      const cost = Math.max(0, nonOwnedPts - baseline)
      if (cost <= 0) continue

      const acc = regretAgg.get(s.player_id) ?? {
        totalCost: 0,
        matchesCount: 0,
        pointsSum: 0,
        worst: null,
      }
      acc.totalCost += cost
      acc.matchesCount++
      acc.pointsSum += nonOwnedPts
      if (!acc.worst || cost > acc.worst.cost) {
        acc.worst = { match_number: match.match_number, cost, matchup }
      }
      regretAgg.set(s.player_id, acc)
    }

    // ── HEROES ──────────────────────────────────────────────
    // Only count contribution in matches the user finished #1
    const rank = userRankByMatch.get(sel.match_id)
    if (rank !== 1) continue
    rankOneMatchCount++

    for (const pid of pickedIds) {
      const pInfo = playerMap.get(pid)
      if (!pInfo) continue
      const basePts = fpLookup.get(`${sel.match_id}:${pid}`) ?? 0
      const isCaptain = sel.captain_id === pid
      const isVc = sel.vice_captain_id === pid
      const multiplier = isCaptain ? 2 : isVc ? 1.5 : 1
      const contribution = basePts * multiplier

      const acc = heroAgg.get(pid) ?? {
        totalContribution: 0,
        matchesCount: 0,
        captained: 0,
        vcCount: 0,
        best: null,
      }
      acc.totalContribution += contribution
      acc.matchesCount++
      if (isCaptain) acc.captained++
      if (isVc) acc.vcCount++
      if (!acc.best || contribution > acc.best.contribution) {
        acc.best = { match_number: match.match_number, contribution, matchup }
      }
      heroAgg.set(pid, acc)
    }
  }

  // ── Format outputs ──────────────────────────────────────────
  const regrets: RegretRow[] = []
  for (const [pid, acc] of regretAgg) {
    const p = playerMap.get(pid)
    if (!p) continue
    regrets.push({
      player_id: pid,
      player_name: p.name,
      player_role: p.role,
      team_short_name: p.team?.short_name ?? "—",
      total_cost: Math.round(acc.totalCost),
      matches_count: acc.matchesCount,
      avg_points_when_skipped:
        acc.matchesCount > 0
          ? Math.round((acc.pointsSum / acc.matchesCount) * 10) / 10
          : 0,
      worst_match: acc.worst
        ? { ...acc.worst, cost: Math.round(acc.worst.cost) }
        : null,
    })
  }
  regrets.sort((a, b) => b.total_cost - a.total_cost)
  const topRegrets = regrets.slice(0, 15)
  const totalCost = regrets.reduce((sum, r) => sum + r.total_cost, 0)

  const heroes: HeroRow[] = []
  for (const [pid, acc] of heroAgg) {
    const p = playerMap.get(pid)
    if (!p) continue
    heroes.push({
      player_id: pid,
      player_name: p.name,
      player_role: p.role,
      team_short_name: p.team?.short_name ?? "—",
      total_contribution: Math.round(acc.totalContribution),
      matches_count: acc.matchesCount,
      captained_count: acc.captained,
      vc_count: acc.vcCount,
      best_match: acc.best
        ? { ...acc.best, contribution: Math.round(acc.best.contribution) }
        : null,
    })
  }
  heroes.sort((a, b) => b.total_contribution - a.total_contribution)
  const topHeroes = heroes.slice(0, 15)

  return {
    regrets: topRegrets,
    heroes: topHeroes,
    rankOneMatchCount,
    totalCost,
    matchesAnalysed,
  }
}

const _getUserOwnershipInsights = async (
  userId: string
): Promise<OwnershipInsights> => {
  const raw = await loadRaw(userId)
  if (!raw) return EMPTY
  return computeInsights(raw)
}

export const getUserOwnershipInsights = unstable_cache(
  _getUserOwnershipInsights,
  ["user-ownership-insights"],
  { tags: ["user-data"], revalidate: 300 }
)

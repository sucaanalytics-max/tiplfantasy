import { createAdminClient } from "./supabase/admin"
import type { ScoringRule } from "./types"

export type PlayerStats = {
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
  isOut?: boolean
  role?: string
}

export async function loadScoringRules(): Promise<ScoringRule[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("*")
    .eq("is_active", true)
  if (error) throw new Error(`Failed to load scoring rules: ${error.message}`)
  return data as ScoringRule[]
}

export function calculatePlayerPoints(
  stats: PlayerStats,
  rules: ScoringRule[]
): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}
  const ruleMap = new Map(rules.map((r) => [r.name, r.points]))

  function add(name: string, count: number = 1) {
    const pts = ruleMap.get(name)
    if (pts && count > 0) {
      breakdown[name] = pts * count
    }
  }

  // Playing XI bonus (every player in the scorecard gets this)
  add("playing_xi_bonus")

  // Batting
  add("run", stats.runs)
  add("four_bonus", stats.fours)
  add("six_bonus", stats.sixes)

  // Batting milestones — mutually exclusive (highest wins)
  if (stats.runs >= 100) {
    add("century")
  } else if (stats.runs >= 50) {
    add("half_century")
  } else if (stats.runs >= 30) {
    add("thirty")
  }

  // Duck — BAT/WK/AR only, not bowlers. (isOut !== false preserves backwards compat)
  const duckEligible = !stats.role || stats.role !== "BOWL"
  if (duckEligible && stats.runs === 0 && stats.balls_faced >= 1 && stats.isOut !== false) {
    add("duck")
  }

  // Strike rate bonus/penalty (min 10 balls)
  if (stats.balls_faced >= 10) {
    const sr = (stats.runs / stats.balls_faced) * 100
    if (sr >= 170) add("sr_above_170")
    else if (sr >= 150) add("sr_150_170")
    else if (sr < 70) add("sr_below_70")
    else if (sr < 80) add("sr_70_80")
  }

  // Bowling
  add("wicket", stats.wickets)
  add("maiden", stats.maidens)

  // Wicket hauls — cumulative
  if (stats.wickets >= 5) add("five_wicket_haul")
  if (stats.wickets >= 4) add("four_wicket_haul")
  if (stats.wickets >= 3) add("three_wicket_haul")

  // Economy bonus/penalty (min 2 overs)
  if (stats.overs_bowled >= 2) {
    const economy = stats.runs_conceded / stats.overs_bowled
    if (economy <= 5) add("econ_below_5")
    else if (economy <= 6) add("econ_5_6")
    else if (economy > 11) add("econ_above_11")
    else if (economy >= 10) add("econ_10_11")
  }

  // Fielding
  add("catch", stats.catches)
  add("stumping", stats.stumpings)
  add("run_out", stats.run_outs)

  // 3+ catches bonus
  if (stats.catches >= 3) add("three_catch_bonus")

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return { total, breakdown }
}

export type UserMatchScoreInput = {
  userId: string
  selectionId: string
  captainId: string | null
  viceCaptainId: string | null
  isAutoPick: boolean
  playerIds: string[]
}

export function calculateUserMatchScore(
  selection: UserMatchScoreInput,
  playerScores: Map<string, number>
): { total: number; captainPoints: number; vcPoints: number } {
  let total = 0
  let captainPoints = 0
  let vcPoints = 0

  for (const playerId of selection.playerIds) {
    const base = playerScores.get(playerId) ?? 0
    let multiplier = 1

    if (!selection.isAutoPick) {
      if (playerId === selection.captainId) {
        multiplier = 2
        captainPoints = base
      } else if (playerId === selection.viceCaptainId) {
        multiplier = 1.5
        vcPoints = base * 0.5
      }
    }

    total += base * multiplier
  }

  return { total: Math.round(total), captainPoints, vcPoints: Math.round(vcPoints) }
}

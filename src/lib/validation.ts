import type { PlayerWithTeam } from "./types"
import { TOTAL_BUDGET } from "./constants"

export type ValidationResult = {
  valid: boolean
  errors: string[]
  checks: {
    totalPlayers: boolean
    wicketKeepers: boolean
    batsmen: boolean
    allRounders: boolean
    bowlers: boolean
    maxPerTeam: boolean
    budgetValid: boolean
    captainValid: boolean
    viceCaptainValid: boolean
    captainNotVC: boolean
  }
}

export function validateSelection(
  players: PlayerWithTeam[],
  captainId: string | null,
  viceCaptainId: string | null
): ValidationResult {
  const errors: string[] = []
  const playerIds = new Set(players.map((p) => p.id))

  // Count by role
  const byRole = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  players.forEach((p) => {
    byRole[p.role]++
  })

  // Count by team
  const byTeam = new Map<string, number>()
  players.forEach((p) => {
    byTeam.set(p.team_id, (byTeam.get(p.team_id) ?? 0) + 1)
  })
  const maxTeamCount = Math.max(0, ...byTeam.values())

  // Budget
  const totalCost = players.reduce((sum, p) => sum + (p.credit_cost ?? 0), 0)

  const totalPlayers = players.length === 11
  if (!totalPlayers) errors.push(`Select exactly 11 players (have ${players.length})`)

  const wicketKeepers = byRole.WK >= 1 && byRole.WK <= 4
  if (!wicketKeepers) errors.push(`Need 1-4 wicket-keepers (have ${byRole.WK})`)

  const batsmen = byRole.BAT >= 3 && byRole.BAT <= 5
  if (!batsmen) errors.push(`Need 3-5 batsmen (have ${byRole.BAT})`)

  const allRounders = byRole.AR >= 1 && byRole.AR <= 3
  if (!allRounders) errors.push(`Need 1-3 all-rounders (have ${byRole.AR})`)

  const bowlers = byRole.BOWL >= 3 && byRole.BOWL <= 5
  if (!bowlers) errors.push(`Need 3-5 bowlers (have ${byRole.BOWL})`)

  const maxPerTeam = maxTeamCount <= 7
  if (!maxPerTeam) errors.push(`Max 7 players from one team (have ${maxTeamCount})`)

  const budgetValid = totalCost <= TOTAL_BUDGET
  if (!budgetValid) errors.push(`Over budget: ${totalCost.toFixed(1)}/${TOTAL_BUDGET} credits`)

  const captainValid = !captainId || playerIds.has(captainId)
  if (!captainValid) errors.push("Captain must be in your squad")

  const viceCaptainValid = !viceCaptainId || playerIds.has(viceCaptainId)
  if (!viceCaptainValid) errors.push("Vice-captain must be in your squad")

  const captainNotVC = !captainId || !viceCaptainId || captainId !== viceCaptainId
  if (!captainNotVC) errors.push("Captain and vice-captain must be different")

  const checks = {
    totalPlayers,
    wicketKeepers,
    batsmen,
    allRounders,
    bowlers,
    maxPerTeam,
    budgetValid,
    captainValid,
    viceCaptainValid,
    captainNotVC,
  }

  return {
    valid: Object.values(checks).every(Boolean),
    errors,
    checks,
  }
}

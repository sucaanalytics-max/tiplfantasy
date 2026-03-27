import type { PlayerWithTeam, PlayerRole } from "./types"
import { TOTAL_BUDGET } from "./constants"

export const ROLE_LIMITS: Record<PlayerRole, [number, number]> = {
  WK: [1, 4],
  BAT: [2, 5],
  AR: [1, 3],
  BOWL: [2, 5],
}

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

  const [wkMin, wkMax] = ROLE_LIMITS.WK
  const wicketKeepers = byRole.WK >= wkMin && byRole.WK <= wkMax
  if (!wicketKeepers) errors.push(`Need ${wkMin}-${wkMax} wicket-keepers (have ${byRole.WK})`)

  const [batMin, batMax] = ROLE_LIMITS.BAT
  const batsmen = byRole.BAT >= batMin && byRole.BAT <= batMax
  if (!batsmen) errors.push(`Need ${batMin}-${batMax} batsmen (have ${byRole.BAT})`)

  const [arMin, arMax] = ROLE_LIMITS.AR
  const allRounders = byRole.AR >= arMin && byRole.AR <= arMax
  if (!allRounders) errors.push(`Need ${arMin}-${arMax} all-rounders (have ${byRole.AR})`)

  const [bowlMin, bowlMax] = ROLE_LIMITS.BOWL
  const bowlers = byRole.BOWL >= bowlMin && byRole.BOWL <= bowlMax
  if (!bowlers) errors.push(`Need ${bowlMin}-${bowlMax} bowlers (have ${byRole.BOWL})`)

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

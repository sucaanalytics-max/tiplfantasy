import type { LeagueLeaderboardEntry, LeagueMatchScore } from "@/lib/types"

export type RaceUser = {
  userId: string
  displayName: string
  isCurrentUser: boolean
  finalRank: number
  cumPoints: number[]
  cumRanks: number[]
}

export type RaceData = {
  matchNumbers: number[]
  matchIds: string[]
  users: RaceUser[]
}

const COHORT_TOP_N = 10

export function buildRaceData(
  matchScores: LeagueMatchScore[],
  leaderboard: LeagueLeaderboardEntry[],
  currentUserId: string,
): RaceData | null {
  if (!matchScores.length) return null

  const matchOrder = new Map<number, { id: string; t: number }>()
  for (const row of matchScores) {
    if (!matchOrder.has(row.match_number)) {
      matchOrder.set(row.match_number, {
        id: row.match_id,
        t: new Date(row.start_time).getTime(),
      })
    }
  }
  const sortedMatches = [...matchOrder.entries()].sort((a, b) => {
    if (a[1].t !== b[1].t) return a[1].t - b[1].t
    return a[0] - b[0]
  })
  const matchNumbers = sortedMatches.map(([n]) => n)
  const matchIds = sortedMatches.map(([, v]) => v.id)
  if (matchNumbers.length < 2) return null

  const matchIndex = new Map(matchNumbers.map((n, i) => [n, i]))

  const userMap = new Map<
    string,
    { displayName: string; pointsPerMatch: number[] }
  >()

  for (const row of matchScores) {
    let entry = userMap.get(row.user_id)
    if (!entry) {
      entry = {
        displayName: row.display_name,
        pointsPerMatch: new Array(matchNumbers.length).fill(0),
      }
      userMap.set(row.user_id, entry)
    }
    const idx = matchIndex.get(row.match_number)
    if (idx !== undefined) {
      entry.pointsPerMatch[idx] = Number(row.total_points) || 0
    }
  }

  const allUsers = [...userMap.entries()].map(([userId, e]) => {
    const cumPoints: number[] = []
    let running = 0
    for (const p of e.pointsPerMatch) {
      running += p
      cumPoints.push(running)
    }
    return { userId, displayName: e.displayName, cumPoints }
  })

  // Compute dense cumulative rank at each match index
  const ranksByUser = new Map<string, number[]>()
  for (const u of allUsers) ranksByUser.set(u.userId, [])

  for (let i = 0; i < matchNumbers.length; i++) {
    const sorted = [...allUsers]
      .map((u) => ({ id: u.userId, pts: u.cumPoints[i] }))
      .sort((a, b) => b.pts - a.pts)
    let lastPts = Infinity
    let lastRank = 0
    sorted.forEach((row, i2) => {
      const rank = row.pts === lastPts ? lastRank : i2 + 1
      lastPts = row.pts
      lastRank = rank
      ranksByUser.get(row.id)!.push(rank)
    })
  }

  // Cohort: top 10 by leaderboard order, plus current user
  const lbOrder = leaderboard.map((e) => e.user_id)
  const cohortIds = new Set<string>(lbOrder.slice(0, COHORT_TOP_N))
  cohortIds.add(currentUserId)

  // Final-rank lookup from leaderboard order (1-based)
  const finalRankById = new Map<string, number>()
  lbOrder.forEach((id, i) => finalRankById.set(id, i + 1))

  const users: RaceUser[] = allUsers
    .filter((u) => cohortIds.has(u.userId))
    .map((u) => ({
      userId: u.userId,
      displayName: u.displayName,
      isCurrentUser: u.userId === currentUserId,
      finalRank: finalRankById.get(u.userId) ?? lbOrder.length + 1,
      cumPoints: u.cumPoints,
      cumRanks: ranksByUser.get(u.userId) ?? [],
    }))
    .sort((a, b) => a.finalRank - b.finalRank)

  if (users.length < 2) return null

  return { matchNumbers, matchIds, users }
}

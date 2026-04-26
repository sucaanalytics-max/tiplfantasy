/**
 * Rivalry helpers — pure functions, no React, no DOM.
 *
 * Powers the standings table + rival drawer on the live match page.
 * Lifted from the previous `compareData` memo in scores-client.tsx so
 * we can unit-test it and reuse from multiple components.
 */

export type PlayerLite = {
  id: string
  name: string
  role: string
  team: { short_name: string; color: string }
}

export type PlayerScore = {
  player_id: string
  fantasy_points: number | string
  player: { name: string; role: string; team_id: string; team: { short_name: string; color: string } }
  // Optional live stats for points-in-play estimation
  balls_faced?: number
  overs_bowled?: number | string
  batting_position?: number | null
}

export type Selection = {
  user_id: string
  captain_id: string | null
  vice_captain_id: string | null
  player_ids: string[]
}

export type UserScore = {
  user_id: string
  total_points: number | string
  rank: number | null
  profile: { display_name: string }
}

// ─── Default rival picker ─────────────────────────────────────────────────

export function pickDefaultRival(
  userScores: UserScore[],
  currentUserId: string,
): string | null {
  const me = userScores.find((s) => s.user_id === currentUserId)
  if (!me || me.rank == null) {
    const first = userScores.find((s) => s.user_id !== currentUserId)
    return first?.user_id ?? null
  }
  // Person directly above me, or person directly below if I'm leader
  const above = userScores.find((s) => s.rank != null && s.rank === (me.rank ?? 0) - 1)
  if (above) return above.user_id
  const below = userScores.find((s) => s.rank != null && s.rank === (me.rank ?? 0) + 1)
  if (below) return below.user_id
  return userScores.find((s) => s.user_id !== currentUserId)?.user_id ?? null
}

// ─── Edge / shared / overlap ──────────────────────────────────────────────

export type EdgeEntry = {
  player_id: string
  player: PlayerScore["player"]
  fantasyPoints: number
  isC: boolean
  isVC: boolean
  effective: number
  // Set when the entry is a captaincy-differential pick (both own the player,
  // but multipliers differ — we promote the diff into the edge section).
  isMultEdge?: boolean
  myIsC?: boolean
  myIsVC?: boolean
  theirIsC?: boolean
  theirIsVC?: boolean
}

export type SharedEntry = {
  player_id: string
  player: PlayerScore["player"]
  fantasyPoints: number
  myMult: number
  theirMult: number
  myEff: number
  theirEff: number
}

export type HeadToHead = {
  myEdge: EdgeEntry[]
  theirEdge: EdgeEntry[]
  shared: SharedEntry[]
  overlapCount: number
  totalPicks: number
}

export function buildHeadToHead(
  mySel: Selection,
  theirSel: Selection,
  psMap: Map<string, PlayerScore>,
  rosterMap: Map<string, PlayerLite>,
): HeadToHead {
  const mySet = new Set(mySel.player_ids)
  const theirSet = new Set(theirSel.player_ids)

  const getPlayer = (pid: string): { player: PlayerScore["player"]; fp: number } | null => {
    const ps = psMap.get(pid)
    if (ps) return { player: ps.player, fp: Number(ps.fantasy_points) }
    const info = rosterMap.get(pid)
    if (info) return { player: { name: info.name, role: info.role, team_id: "", team: info.team }, fp: 0 }
    return null
  }

  const myEdge: EdgeEntry[] = []
  const theirEdge: EdgeEntry[] = []
  const shared: SharedEntry[] = []

  for (const pid of mySel.player_ids) {
    if (theirSet.has(pid)) continue
    const p = getPlayer(pid)
    if (!p) continue
    const isC = mySel.captain_id === pid
    const isVC = mySel.vice_captain_id === pid
    const mult = isC ? 2 : isVC ? 1.5 : 1
    myEdge.push({
      player_id: pid,
      player: p.player,
      fantasyPoints: p.fp,
      isC, isVC,
      effective: round2(p.fp * mult),
    })
  }

  for (const pid of theirSel.player_ids) {
    if (mySet.has(pid)) continue
    const p = getPlayer(pid)
    if (!p) continue
    const isC = theirSel.captain_id === pid
    const isVC = theirSel.vice_captain_id === pid
    const mult = isC ? 2 : isVC ? 1.5 : 1
    theirEdge.push({
      player_id: pid,
      player: p.player,
      fantasyPoints: p.fp,
      isC, isVC,
      effective: round2(p.fp * mult),
    })
  }

  for (const pid of mySel.player_ids) {
    if (!theirSet.has(pid)) continue
    const p = getPlayer(pid)
    if (!p) continue
    const myMult = mySel.captain_id === pid ? 2 : mySel.vice_captain_id === pid ? 1.5 : 1
    const theirMult = theirSel.captain_id === pid ? 2 : theirSel.vice_captain_id === pid ? 1.5 : 1
    const myEff = round2(p.fp * myMult)
    const theirEff = round2(p.fp * theirMult)

    if (myMult !== theirMult) {
      const delta = round2(Math.abs(myEff - theirEff))
      const myIsC = mySel.captain_id === pid
      const myIsVC = mySel.vice_captain_id === pid
      const theirIsC = theirSel.captain_id === pid
      const theirIsVC = theirSel.vice_captain_id === pid
      if (myMult > theirMult) {
        myEdge.push({
          player_id: pid, player: p.player, fantasyPoints: p.fp,
          isC: myIsC, isVC: myIsVC,
          effective: delta,
          isMultEdge: true, theirIsC, theirIsVC,
        })
      } else {
        theirEdge.push({
          player_id: pid, player: p.player, fantasyPoints: p.fp,
          isC: theirIsC, isVC: theirIsVC,
          effective: delta,
          isMultEdge: true, myIsC, myIsVC,
        })
      }
    } else {
      shared.push({
        player_id: pid, player: p.player, fantasyPoints: p.fp,
        myMult, theirMult, myEff, theirEff,
      })
    }
  }

  myEdge.sort((a, b) => b.effective - a.effective)
  theirEdge.sort((a, b) => b.effective - a.effective)

  const overlapCount = mySel.player_ids.filter((pid) => theirSet.has(pid)).length

  return {
    myEdge,
    theirEdge,
    shared,
    overlapCount,
    totalPicks: mySel.player_ids.length || 11,
  }
}

export function computeXiOverlap(mySel: Selection, theirSel: Selection): { count: number; pct: number } {
  if (!mySel.player_ids.length || !theirSel.player_ids.length) return { count: 0, pct: 0 }
  const theirSet = new Set(theirSel.player_ids)
  const count = mySel.player_ids.filter((pid) => theirSet.has(pid)).length
  return { count, pct: Math.round((count / mySel.player_ids.length) * 100) }
}

// ─── Captain duel ─────────────────────────────────────────────────────────

export type CaptainDuel = {
  myCaptain: { name: string; role: string; basePoints: number; effective: number } | null
  theirCaptain: { name: string; role: string; basePoints: number; effective: number } | null
  myVC: { name: string; role: string; basePoints: number; effective: number } | null
  theirVC: { name: string; role: string; basePoints: number; effective: number } | null
  captainDelta: number    // signed: my captain effective − their captain effective
  vcDelta: number
}

export function buildCaptainDuel(
  mySel: Selection,
  theirSel: Selection,
  psMap: Map<string, PlayerScore>,
  rosterMap: Map<string, PlayerLite>,
): CaptainDuel {
  const lookup = (pid: string | null) => {
    if (!pid) return null
    const ps = psMap.get(pid)
    if (ps) return { name: ps.player.name, role: ps.player.role, basePoints: Number(ps.fantasy_points) }
    const info = rosterMap.get(pid)
    if (info) return { name: info.name, role: info.role, basePoints: 0 }
    return null
  }
  const my = lookup(mySel.captain_id)
  const their = lookup(theirSel.captain_id)
  const myV = lookup(mySel.vice_captain_id)
  const theirV = lookup(theirSel.vice_captain_id)
  const myCaptain = my && { ...my, effective: round2(my.basePoints * 2) }
  const theirCaptain = their && { ...their, effective: round2(their.basePoints * 2) }
  const myVC = myV && { ...myV, effective: round2(myV.basePoints * 1.5) }
  const theirVC = theirV && { ...theirV, effective: round2(theirV.basePoints * 1.5) }
  return {
    myCaptain,
    theirCaptain,
    myVC,
    theirVC,
    captainDelta: round2((myCaptain?.effective ?? 0) - (theirCaptain?.effective ?? 0)),
    vcDelta: round2((myVC?.effective ?? 0) - (theirVC?.effective ?? 0)),
  }
}

// ─── Points still in play ─────────────────────────────────────────────────

/**
 * Conservative estimate of points still in play for a side.
 *
 * A player has "points in play" if they are in the XI but haven't started
 * their fantasy-relevant action yet. Conservative defaults:
 *   - Batters / WK / AR with 0 balls_faced → 30 pts in play (a typical T20 cameo).
 *   - Bowlers with 0 overs → 30 pts (3 overs at 1 wicket = 25, plus economy bonus).
 *   - Bowlers under 4 overs → 8 pts per remaining over (capped at 4).
 * Captain (×2) and VC (×1.5) multipliers applied.
 *
 * Returns null when we can't compute it (no player roster info).
 */
export function computePointsInPlay(
  sel: Selection,
  psMap: Map<string, PlayerScore>,
  rosterMap: Map<string, PlayerLite>,
  overLimit = 4,
): number | null {
  if (!sel.player_ids.length) return null
  let total = 0
  let known = 0
  for (const pid of sel.player_ids) {
    const ps = psMap.get(pid)
    const info = ps?.player ?? rosterMap.get(pid)
    if (!info) continue
    known += 1
    const role = info.role
    const mult = sel.captain_id === pid ? 2 : sel.vice_captain_id === pid ? 1.5 : 1
    let base = 0
    if (role === "BOWL" || role === "AR") {
      const oversBowled = ps ? Number(ps.overs_bowled ?? 0) : 0
      const remaining = Math.max(0, overLimit - oversBowled)
      base += remaining * 8
      // AR can also bat — add a small batting allowance if not yet faced
      if (role === "AR") {
        const balls = ps ? Number(ps.balls_faced ?? 0) : 0
        if (balls === 0) base += 20
      }
    } else if (role === "BAT" || role === "WK") {
      const balls = ps ? Number(ps.balls_faced ?? 0) : 0
      if (balls === 0) base += 30
    }
    total += base * mult
  }
  if (known === 0) return null
  return Math.round(total)
}

// ─── Insights ─────────────────────────────────────────────────────────────

export type InsightInput = {
  pointsDelta: number          // signed: my total − their total
  captainDuel: CaptainDuel
  myInPlay: number | null
  theirInPlay: number | null
  myEdgeCount: number
  theirEdgeCount: number
  overlapPct: number
  matchStatus: string          // upcoming | live | completed | no_result | abandoned
}

/**
 * Generates one short tactical insight per rival card.
 * Rule-based; ordered so the most decision-relevant insight wins.
 */
export function generateInsight(input: InsightInput): string | null {
  const {
    pointsDelta, captainDuel, myInPlay, theirInPlay,
    myEdgeCount, theirEdgeCount, overlapPct, matchStatus,
  } = input

  if (matchStatus === "completed" || matchStatus === "no_result") {
    if (Math.abs(pointsDelta) < 5) return "Decided by single-figure margin."
    if (pointsDelta > 0) return `Won by ${Math.abs(pointsDelta)} pts.`
    return `Lost by ${Math.abs(pointsDelta)} pts.`
  }

  if (matchStatus === "upcoming") {
    if (overlapPct >= 80) return "Near-identical XI — captaincy will decide it."
    if (overlapPct <= 30) return "Very different XIs — a points-spread duel."
    return null
  }

  // Live insights
  const captainDelta = captainDuel.captainDelta
  if (captainDuel.myCaptain && captainDuel.theirCaptain && Math.abs(captainDelta) >= 25) {
    if (captainDelta > 0) return `Your captain (+${captainDuel.myCaptain.basePoints}) is winning the duel by ${Math.abs(captainDelta)}.`
    return `Their captain (+${captainDuel.theirCaptain.basePoints}) is winning the duel by ${Math.abs(captainDelta)}.`
  }

  if (myInPlay != null && theirInPlay != null) {
    const swing = myInPlay - theirInPlay
    if (Math.abs(swing) >= 30) {
      if (swing > 0) return `You have ~${myInPlay} pts still in play vs their ~${theirInPlay}.`
      return `They have ~${theirInPlay} pts still in play vs your ~${myInPlay}.`
    }
    if (myInPlay < 10 && theirInPlay < 10) return "Almost everyone has played — the gap is locked in."
  }

  if (overlapPct >= 80) return "8+/11 shared — the captain pick is the whole game."
  if (myEdgeCount >= 4 && theirEdgeCount >= 4) return "Different XIs — points-spread duel."
  if (Math.abs(pointsDelta) <= 10) return "Within 10 pts — every wicket matters."
  return null
}

// ─── Momentum ─────────────────────────────────────────────────────────────

export type MomentumPoint = { over: number; points: number }

/**
 * Extract a per-user momentum series from the over-by-over snapshots.
 * Returns null when there are fewer than 2 data points.
 */
export function computeMomentumSeries(
  userId: string,
  snapshots: Array<{ over_number: number; scores: Record<string, number> }>,
): MomentumPoint[] | null {
  if (!snapshots.length) return null
  const series: MomentumPoint[] = []
  for (const snap of snapshots) {
    const pts = snap.scores?.[userId]
    if (typeof pts === "number") series.push({ over: snap.over_number, points: pts })
  }
  if (series.length < 2) return null
  return series
}

// ─── Util ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

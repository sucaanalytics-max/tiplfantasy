'use client'

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchHistoryTable } from "./match-history-table"
import type { MatchHistoryRow } from "./match-history-table"

export type ScoreTimelineEntry = {
  matchNumber: number
  label: string
  userScore: number
  leagueAvg: number
  rank: number
  rolling3: number | null
}

export type RoleBreakdownData = {
  WK: number
  BAT: number
  AR: number
  BOWL: number
  captainBonus: number
  vcBonus: number
}

export type SquadDNARow = {
  teamId: string
  shortName: string
  color: string
  logoUrl: string | null
  pickCount: number
  totalContribution: number
  avgContribution: number
  bestPick: number
  pctOfTotal: number
}

type StreakEntry = {
  type: "Win" | "Dry"
  startLabel: string
  endLabel: string
  length: number
  scoreMin: number
  scoreMax: number
}

type TeamPerf = {
  teamShort: string
  color: string
  played: number
  wins: number
  winPct: number
  avgPts: number
  avgRank: number
}

type RoleKey = "WK" | "BAT" | "AR" | "BOWL"

type RolePerf = {
  role: RoleKey
  picks: number
  total: number
  avgPerPick: number
  vsOverallPct: number
  pctOfTotal: number
}

const ROLE_META: Record<RoleKey, { label: string; color: string }> = {
  BAT: { label: "Batter", color: "oklch(0.72 0.18 86)" },
  BOWL: { label: "Bowler", color: "oklch(0.60 0.18 250)" },
  AR: { label: "All-Round", color: "oklch(0.68 0.16 160)" },
  WK: { label: "Wicket-Keeper", color: "oklch(0.65 0.15 320)" },
}

type Props = {
  scoreTimeline: ScoreTimelineEntry[]
  roleBreakdown: RoleBreakdownData
  roleCounts: { WK: number; BAT: number; AR: number; BOWL: number }
  matchHistoryRows: MatchHistoryRow[]
  totalPoints: number
  leagueSize: number
  seasonAvg: number
  squadDNA: SquadDNARow[]
}

function deriveFormBanner(timeline: ScoreTimelineEntry[], seasonAvg: number): string | null {
  if (timeline.length < 3 || seasonAvg === 0) return null
  const last3 = timeline.slice(-3)
  const avg3 = last3.reduce((sum, t) => sum + t.userScore, 0) / 3
  const diff = avg3 - seasonAvg
  if (diff > 10)
    return `Last 3 avg (${avg3.toFixed(0)} pts) is above your season avg (${seasonAvg.toFixed(0)} pts)`
  if (diff < -10)
    return `Last 3 avg (${avg3.toFixed(0)} pts) is below your season avg (${seasonAvg.toFixed(0)} pts)`
  return `Consistent — last 3 avg (${avg3.toFixed(0)} pts) is in line with your season avg (${seasonAvg.toFixed(0)} pts)`
}

function isPositiveBanner(timeline: ScoreTimelineEntry[], seasonAvg: number): boolean {
  if (timeline.length < 3) return false
  const last3 = timeline.slice(-3)
  const avg3 = last3.reduce((sum, t) => sum + t.userScore, 0) / 3
  return avg3 >= seasonAvg
}

function computeStreaks(timeline: ScoreTimelineEntry[]): StreakEntry[] {
  if (timeline.length === 0) return []
  const streaks: StreakEntry[] = []
  let i = 0
  while (i < timeline.length) {
    const isWin = timeline[i].rank === 1
    let j = i
    while (j < timeline.length && (timeline[j].rank === 1) === isWin) j++
    const slice = timeline.slice(i, j)
    const scores = slice.map((t) => t.userScore)
    streaks.push({
      type: isWin ? "Win" : "Dry",
      startLabel: slice[0].label,
      endLabel: slice[slice.length - 1].label,
      length: slice.length,
      scoreMin: Math.min(...scores),
      scoreMax: Math.max(...scores),
    })
    i = j
  }
  return streaks
}

function computeTeamPerf(rows: MatchHistoryRow[]): TeamPerf[] {
  const map = new Map<
    string,
    { color: string; pts: number[]; ranks: number[]; wins: number }
  >()
  for (const row of rows) {
    for (const team of [
      { short: row.homeShortName, color: row.homeColor },
      { short: row.awayShortName, color: row.awayColor },
    ]) {
      if (!team.short || team.short === "—") continue
      const entry = map.get(team.short) ?? {
        color: team.color,
        pts: [],
        ranks: [],
        wins: 0,
      }
      entry.pts.push(row.totalPoints)
      if (row.rank != null) entry.ranks.push(row.rank)
      if (row.rank === 1) entry.wins++
      map.set(team.short, entry)
    }
  }
  return Array.from(map.entries()).map(([short, v]) => ({
    teamShort: short,
    color: v.color,
    played: v.pts.length,
    wins: v.wins,
    winPct: Math.round((v.wins / v.pts.length) * 100),
    avgPts: Math.round(v.pts.reduce((a, b) => a + b, 0) / v.pts.length),
    avgRank:
      v.ranks.length > 0
        ? Number((v.ranks.reduce((a, b) => a + b, 0) / v.ranks.length).toFixed(1))
        : 0,
  }))
}

function computeRolePerf(
  roleCounts: { WK: number; BAT: number; AR: number; BOWL: number },
  roleBreakdown: RoleBreakdownData,
): RolePerf[] {
  const totalPicks = roleCounts.WK + roleCounts.BAT + roleCounts.AR + roleCounts.BOWL
  const totalRolePts =
    roleBreakdown.WK + roleBreakdown.BAT + roleBreakdown.AR + roleBreakdown.BOWL
  const overallAvg = totalPicks > 0 ? totalRolePts / totalPicks : 0
  const roles: RoleKey[] = ["BAT", "BOWL", "AR", "WK"]
  return roles
    .map((role) => {
      const picks = roleCounts[role]
      const total = roleBreakdown[role]
      const avgPerPick = picks > 0 ? total / picks : 0
      return {
        role,
        picks,
        total: Math.round(total),
        avgPerPick: Number(avgPerPick.toFixed(1)),
        vsOverallPct:
          overallAvg > 0 ? Math.round((avgPerPick / overallAvg - 1) * 100) : 0,
        pctOfTotal:
          totalRolePts > 0 ? Math.round((total / totalRolePts) * 100) : 0,
      }
    })
    .filter((r) => r.picks > 0)
}

function ColHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string
  active: boolean
  asc: boolean
  onClick: () => void
}) {
  return (
    <th
      className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors"
      onClick={onClick}
    >
      {label}
      <span className="ml-1 opacity-50">{active ? (asc ? "↑" : "↓") : "↕"}</span>
    </th>
  )
}

function PlainHeader({ label }: { label: string }) {
  return (
    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
      {label}
    </th>
  )
}

export function SeasonArcTab({
  scoreTimeline,
  roleBreakdown,
  roleCounts,
  matchHistoryRows,
  seasonAvg,
  squadDNA,
}: Props) {
  const [streakSort, setStreakSort] = useState<{ col: "length" | "type"; asc: boolean }>({
    col: "length",
    asc: false,
  })
  const [teamPerfSort, setTeamPerfSort] = useState<{
    col: "winPct" | "avgPts" | "played" | "avgRank"
    asc: boolean
  }>({ col: "winPct", asc: false })
  const [roleSort, setRoleSort] = useState<{
    col: "avg" | "picks" | "vs"
    asc: boolean
  }>({ col: "avg", asc: false })
  const [dnaSort, setDnaSort] = useState<{
    col: "total" | "avg" | "picks" | "best"
    asc: boolean
  }>({ col: "total", asc: false })

  const formBanner = deriveFormBanner(scoreTimeline, seasonAvg)
  const bannerPositive = isPositiveBanner(scoreTimeline, seasonAvg)

  const streaks = useMemo(() => computeStreaks(scoreTimeline), [scoreTimeline])
  const teamPerf = useMemo(() => computeTeamPerf(matchHistoryRows), [matchHistoryRows])
  const rolePerf = useMemo(
    () => computeRolePerf(roleCounts, roleBreakdown),
    [roleCounts, roleBreakdown],
  )

  const sortedStreaks = useMemo(() => {
    const arr = [...streaks]
    arr.sort((a, b) => {
      const diff =
        streakSort.col === "length"
          ? a.length - b.length
          : a.type.localeCompare(b.type)
      return streakSort.asc ? diff : -diff
    })
    return arr.slice(0, 20)
  }, [streaks, streakSort])

  const sortedTeamPerf = useMemo(() => {
    const arr = [...teamPerf]
    arr.sort((a, b) => {
      let diff = 0
      if (teamPerfSort.col === "winPct")
        diff = a.winPct - b.winPct || a.avgPts - b.avgPts
      else if (teamPerfSort.col === "avgPts") diff = a.avgPts - b.avgPts
      else if (teamPerfSort.col === "played") diff = a.played - b.played
      else diff = a.avgRank - b.avgRank
      return teamPerfSort.asc ? diff : -diff
    })
    return arr
  }, [teamPerf, teamPerfSort])

  const sortedRolePerf = useMemo(() => {
    const arr = [...rolePerf]
    arr.sort((a, b) => {
      let diff = 0
      if (roleSort.col === "avg") diff = a.avgPerPick - b.avgPerPick
      else if (roleSort.col === "picks") diff = a.picks - b.picks
      else diff = a.vsOverallPct - b.vsOverallPct
      return roleSort.asc ? diff : -diff
    })
    return arr
  }, [rolePerf, roleSort])

  const sortedDNA = useMemo(() => {
    const arr = [...squadDNA]
    arr.sort((a, b) => {
      let diff = 0
      if (dnaSort.col === "total") diff = a.totalContribution - b.totalContribution
      else if (dnaSort.col === "avg") diff = a.avgContribution - b.avgContribution
      else if (dnaSort.col === "picks") diff = a.pickCount - b.pickCount
      else diff = a.bestPick - b.bestPick
      return dnaSort.asc ? diff : -diff
    })
    return arr
  }, [squadDNA, dnaSort])

  function toggleStreak(col: "length" | "type") {
    setStreakSort((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: false },
    )
  }
  function toggleTeamPerf(col: "winPct" | "avgPts" | "played" | "avgRank") {
    setTeamPerfSort((prev) =>
      prev.col === col
        ? { col, asc: !prev.asc }
        : { col, asc: col === "avgRank" },
    )
  }
  function toggleRole(col: "avg" | "picks" | "vs") {
    setRoleSort((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: false },
    )
  }
  function toggleDNA(col: "total" | "avg" | "picks" | "best") {
    setDnaSort((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: false },
    )
  }

  if (scoreTimeline.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No matches played yet
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {formBanner && (
        <div
          className={
            bannerPositive
              ? "rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-sm text-green-400"
              : "rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400"
          }
        >
          {formBanner}
        </div>
      )}

      {/* ── Streak Log ── */}
      {sortedStreaks.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Streak Log</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <ColHeader
                    label="Type"
                    active={streakSort.col === "type"}
                    asc={streakSort.asc}
                    onClick={() => toggleStreak("type")}
                  />
                  <PlainHeader label="Matches" />
                  <ColHeader
                    label="Length"
                    active={streakSort.col === "length"}
                    asc={streakSort.asc}
                    onClick={() => toggleStreak("length")}
                  />
                  <PlainHeader label="Score Range" />
                </tr>
              </thead>
              <tbody>
                {sortedStreaks.map((s, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/20 last:border-0 ${
                      s.type === "Win" ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-semibold ${
                          s.type === "Win" ? "text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {s.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.startLabel === s.endLabel
                        ? s.startLabel
                        : `${s.startLabel}–${s.endLabel}`}
                    </td>
                    <td className="px-3 py-2 font-medium">{s.length}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {s.length === 1 ? `${s.scoreMin}` : `${s.scoreMin}–${s.scoreMax}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Team Performance (match-based) ── */}
      {sortedTeamPerf.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Team Performance</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Your rank &amp; score in matches involving each team
            </p>
          </CardHeader>
          <CardContent className="pt-0 pb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <PlainHeader label="Team" />
                  <ColHeader
                    label="Played"
                    active={teamPerfSort.col === "played"}
                    asc={teamPerfSort.asc}
                    onClick={() => toggleTeamPerf("played")}
                  />
                  <PlainHeader label="Wins" />
                  <ColHeader
                    label="Win%"
                    active={teamPerfSort.col === "winPct"}
                    asc={teamPerfSort.asc}
                    onClick={() => toggleTeamPerf("winPct")}
                  />
                  <ColHeader
                    label="Avg Pts"
                    active={teamPerfSort.col === "avgPts"}
                    asc={teamPerfSort.asc}
                    onClick={() => toggleTeamPerf("avgPts")}
                  />
                  <ColHeader
                    label="Avg Rank"
                    active={teamPerfSort.col === "avgRank"}
                    asc={teamPerfSort.asc}
                    onClick={() => toggleTeamPerf("avgRank")}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedTeamPerf.map((t) => (
                  <tr
                    key={t.teamShort}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="text-xs font-medium">{t.teamShort}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{t.played}</td>
                    <td className="px-3 py-2 tabular-nums">{t.wins}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-medium tabular-nums ${
                          t.winPct >= 30
                            ? "text-amber-400"
                            : t.winPct < 10
                            ? "text-muted-foreground"
                            : ""
                        }`}
                      >
                        {t.winPct}%
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{t.avgPts}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`tabular-nums ${
                          t.avgRank > 0 && t.avgRank <= 3
                            ? "text-amber-400 font-medium"
                            : ""
                        }`}
                      >
                        {t.avgRank > 0 ? t.avgRank.toFixed(1) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Role Breakdown (pick-based) ── */}
      {sortedRolePerf.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Role Breakdown</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Hit-rate per role vs your overall average per pick
            </p>
          </CardHeader>
          <CardContent className="pt-0 pb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <PlainHeader label="Role" />
                  <ColHeader
                    label="Picks"
                    active={roleSort.col === "picks"}
                    asc={roleSort.asc}
                    onClick={() => toggleRole("picks")}
                  />
                  <ColHeader
                    label="Avg/Pick"
                    active={roleSort.col === "avg"}
                    asc={roleSort.asc}
                    onClick={() => toggleRole("avg")}
                  />
                  <ColHeader
                    label="vs Avg"
                    active={roleSort.col === "vs"}
                    asc={roleSort.asc}
                    onClick={() => toggleRole("vs")}
                  />
                  <PlainHeader label="% of Pts" />
                </tr>
              </thead>
              <tbody>
                {sortedRolePerf.map((r) => {
                  const meta = ROLE_META[r.role]
                  return (
                    <tr key={r.role} className="border-b border-border/20 last:border-0">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-xs font-medium">{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.picks}</td>
                      <td className="px-3 py-2 font-medium tabular-nums">
                        {r.avgPerPick.toFixed(1)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            r.vsOverallPct >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {r.vsOverallPct >= 0 ? "+" : "−"}
                          {Math.abs(r.vsOverallPct)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                        {r.pctOfTotal}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Team Picks (pick-based) ── */}
      {sortedDNA.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Team Picks</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Contribution from players you picked, by IPL team
            </p>
          </CardHeader>
          <CardContent className="pt-0 pb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <PlainHeader label="Team" />
                  <ColHeader
                    label="Picks"
                    active={dnaSort.col === "picks"}
                    asc={dnaSort.asc}
                    onClick={() => toggleDNA("picks")}
                  />
                  <ColHeader
                    label="Avg/Pick"
                    active={dnaSort.col === "avg"}
                    asc={dnaSort.asc}
                    onClick={() => toggleDNA("avg")}
                  />
                  <ColHeader
                    label="Best"
                    active={dnaSort.col === "best"}
                    asc={dnaSort.asc}
                    onClick={() => toggleDNA("best")}
                  />
                  <ColHeader
                    label="Total"
                    active={dnaSort.col === "total"}
                    asc={dnaSort.asc}
                    onClick={() => toggleDNA("total")}
                  />
                  <PlainHeader label="% of Pts" />
                </tr>
              </thead>
              <tbody>
                {sortedDNA.map((d) => (
                  <tr key={d.teamId} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-xs font-medium">{d.shortName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{d.pickCount}</td>
                    <td className="px-3 py-2 tabular-nums">{d.avgContribution}</td>
                    <td className="px-3 py-2 tabular-nums text-amber-400/80">
                      {d.bestPick}
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {d.totalContribution.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {d.pctOfTotal}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Match History */}
      {matchHistoryRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold tracking-wide uppercase">
              Match History
            </h2>
            <span className="text-2xs text-muted-foreground">Tap a header to sort</span>
          </div>
          <MatchHistoryTable rows={matchHistoryRows} />
        </div>
      )}
    </div>
  )
}

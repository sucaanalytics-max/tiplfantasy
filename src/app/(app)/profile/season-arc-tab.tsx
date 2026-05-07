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

type FixturePerf = {
  fixture: string
  homeColor: string
  awayColor: string
  played: number
  wins: number
  winPct: number
  avgScore: number
}

type Props = {
  scoreTimeline: ScoreTimelineEntry[]
  roleBreakdown: RoleBreakdownData
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

function computeFixturePerf(rows: MatchHistoryRow[]): FixturePerf[] {
  const map = new Map<
    string,
    { homeColor: string; awayColor: string; scores: number[]; wins: number }
  >()
  for (const row of rows) {
    const key = `${row.homeShortName} vs ${row.awayShortName}`
    const entry = map.get(key) ?? {
      homeColor: row.homeColor,
      awayColor: row.awayColor,
      scores: [],
      wins: 0,
    }
    entry.scores.push(row.totalPoints)
    if (row.rank === 1) entry.wins++
    map.set(key, entry)
  }
  return Array.from(map.entries()).map(([fixture, v]) => ({
    fixture,
    homeColor: v.homeColor,
    awayColor: v.awayColor,
    played: v.scores.length,
    wins: v.wins,
    winPct: Math.round((v.wins / v.scores.length) * 100),
    avgScore: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
  }))
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
  matchHistoryRows,
  seasonAvg,
  squadDNA,
}: Props) {
  const [streakSort, setStreakSort] = useState<{ col: "length" | "type"; asc: boolean }>({
    col: "length",
    asc: false,
  })
  const [fixtureSort, setFixtureSort] = useState<{
    col: "winPct" | "avgScore" | "played"
    asc: boolean
  }>({ col: "winPct", asc: false })
  const [dnaSort, setDnaSort] = useState<{ col: "total" | "avg" | "picks"; asc: boolean }>({
    col: "total",
    asc: false,
  })

  const formBanner = deriveFormBanner(scoreTimeline, seasonAvg)
  const bannerPositive = isPositiveBanner(scoreTimeline, seasonAvg)

  const streaks = useMemo(() => computeStreaks(scoreTimeline), [scoreTimeline])
  const fixturePerf = useMemo(() => computeFixturePerf(matchHistoryRows), [matchHistoryRows])

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

  const sortedFixtures = useMemo(() => {
    const arr = [...fixturePerf]
    arr.sort((a, b) => {
      let diff = 0
      if (fixtureSort.col === "winPct") diff = a.winPct - b.winPct || a.avgScore - b.avgScore
      else if (fixtureSort.col === "avgScore") diff = a.avgScore - b.avgScore
      else diff = a.played - b.played
      return fixtureSort.asc ? diff : -diff
    })
    return arr
  }, [fixturePerf, fixtureSort])

  const sortedDNA = useMemo(() => {
    const arr = [...squadDNA]
    arr.sort((a, b) => {
      let diff = 0
      if (dnaSort.col === "total") diff = a.totalContribution - b.totalContribution
      else if (dnaSort.col === "avg") diff = a.avgContribution - b.avgContribution
      else diff = a.pickCount - b.pickCount
      return dnaSort.asc ? diff : -diff
    })
    return arr
  }, [squadDNA, dnaSort])

  function toggleStreak(col: "length" | "type") {
    setStreakSort((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: false }
    )
  }
  function toggleFixture(col: "winPct" | "avgScore" | "played") {
    setFixtureSort((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: false }
    )
  }
  function toggleDNA(col: "total" | "avg" | "picks") {
    setDnaSort((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: false }
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

      {/* ── Fixture Performance ── */}
      {sortedFixtures.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Fixture Performance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <PlainHeader label="Fixture" />
                  <ColHeader
                    label="Played"
                    active={fixtureSort.col === "played"}
                    asc={fixtureSort.asc}
                    onClick={() => toggleFixture("played")}
                  />
                  <PlainHeader label="Wins" />
                  <ColHeader
                    label="Win%"
                    active={fixtureSort.col === "winPct"}
                    asc={fixtureSort.asc}
                    onClick={() => toggleFixture("winPct")}
                  />
                  <ColHeader
                    label="Avg Pts"
                    active={fixtureSort.col === "avgScore"}
                    asc={fixtureSort.asc}
                    onClick={() => toggleFixture("avgScore")}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedFixtures.map((f, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: f.homeColor }}
                        />
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: f.awayColor }}
                        />
                        <span className="text-xs">{f.fixture}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{f.played}</td>
                    <td className="px-3 py-2 tabular-nums">{f.wins}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-medium tabular-nums ${
                          f.winPct === 100
                            ? "text-amber-400"
                            : f.winPct === 0
                            ? "text-muted-foreground"
                            : ""
                        }`}
                      >
                        {f.winPct}%
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{f.avgScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Squad DNA ── */}
      {sortedDNA.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Squad DNA</CardTitle>
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

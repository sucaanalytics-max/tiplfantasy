'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart } from "@/components/charts/line-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { MatchHistoryTable } from "./match-history-table"
import type { MatchHistoryRow } from "./match-history-table"

export type ScoreTimelineEntry = {
  matchNumber: number
  label: string      // "M1", "M2", …
  userScore: number
  leagueAvg: number
  rank: number
  rolling3: number | null  // null for first 2 entries
}

export type RoleBreakdownData = {
  WK: number
  BAT: number
  AR: number
  BOWL: number
  captainBonus: number
  vcBonus: number
}

type Props = {
  scoreTimeline: ScoreTimelineEntry[]
  roleBreakdown: RoleBreakdownData
  matchHistoryRows: MatchHistoryRow[]
  totalPoints: number
  leagueSize: number
  seasonAvg: number
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

export function SeasonArcTab({
  scoreTimeline,
  roleBreakdown,
  matchHistoryRows,
  totalPoints,
  leagueSize,
  seasonAvg,
}: Props) {
  if (scoreTimeline.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No matches played yet
      </div>
    )
  }

  const formBanner = deriveFormBanner(scoreTimeline, seasonAvg)
  const bannerPositive = isPositiveBanner(scoreTimeline, seasonAvg)

  const xLabels = scoreTimeline.map((t) => t.label)
  const userScores = scoreTimeline.map((t) => t.userScore)
  const leagueAvgs = scoreTimeline.map((t) => t.leagueAvg)
  const rankData = scoreTimeline.map((t) => t.rank)

  // Rolling 3 series — fill early entries with cumulative avg so the line
  // doesn't start mid-chart, but fades to indicate it needs ≥3 data points.
  const rolling3Values = scoreTimeline.map((_, i) => {
    const window = scoreTimeline.slice(Math.max(0, i - 2), i + 1)
    return window.reduce((sum, t) => sum + t.userScore, 0) / window.length
  })

  // Role donut segments — only non-zero values
  const donutSegments = [
    { label: "Batting", value: Math.round(roleBreakdown.BAT), color: "oklch(0.72 0.18 86)" },
    { label: "Bowling", value: Math.round(roleBreakdown.BOWL), color: "oklch(0.60 0.18 250)" },
    { label: "All-Round", value: Math.round(roleBreakdown.AR), color: "oklch(0.68 0.16 160)" },
    { label: "WK", value: Math.round(roleBreakdown.WK), color: "oklch(0.65 0.15 320)" },
    { label: "Captain +", value: Math.round(roleBreakdown.captainBonus), color: "oklch(0.78 0.17 50)" },
    { label: "VC +", value: Math.round(roleBreakdown.vcBonus), color: "oklch(0.68 0.12 45)" },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-5">
      {/* Form banner */}
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

      {/* Score Journey */}
      <Card className="glass">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Score Journey</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="[&_svg]:!w-full [&_svg]:!h-auto">
            <LineChart
              series={[
                { label: "Your Score", values: userScores, color: "oklch(0.78 0.17 86)" },
                {
                  label: "League Avg",
                  values: leagueAvgs,
                  color: "hsl(var(--muted-foreground) / 0.45)",
                },
                ...(scoreTimeline.length >= 3
                  ? [
                      {
                        label: "3-Match Avg",
                        values: rolling3Values,
                        color: "oklch(0.78 0.17 86 / 0.4)",
                      },
                    ]
                  : []),
              ]}
              xLabels={xLabels}
              width={400}
              height={160}
              showDots
              showArea
            />
          </div>
        </CardContent>
      </Card>

      {/* Rank Journey */}
      {leagueSize > 1 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">
              Rank Journey{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (#1 = best)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="[&_svg]:!w-full [&_svg]:!h-auto">
              <LineChart
                series={[
                  {
                    label: "Your Rank",
                    values: rankData,
                    color: "oklch(0.65 0.18 250)",
                  },
                ]}
                xLabels={xLabels}
                width={400}
                height={140}
                invertY
                showDots
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points by Source */}
      {donutSegments.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Points by Source</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-2 pb-4">
            <DonutChart
              segments={donutSegments}
              size={148}
              strokeWidth={14}
              centerValue={totalPoints.toLocaleString()}
              centerLabel="total pts"
            />
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

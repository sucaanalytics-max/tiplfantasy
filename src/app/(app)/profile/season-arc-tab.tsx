'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart } from "@/components/charts/line-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { MatchHistoryTable } from "./match-history-table"
import type { MatchHistoryRow } from "./match-history-table"

// ── Per-match bar chart ────────────────────────────────────────────────
// Bars are colored amber (above league avg) or muted (below). A dashed
// reference line sits at the league avg. Labels shown every ~7 matches.
function MatchBarChart({
  data,
}: {
  data: { userScore: number; leagueAvg: number; label: string }[]
}) {
  if (data.length === 0) return null

  const W = 500
  const H = 150
  const padL = 34, padR = 14, padT = 10, padB = 22
  const cW = W - padL - padR
  const cH = H - padT - padB
  const n = data.length

  const scores = data.map((d) => d.userScore)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  const range = maxScore - minScore || 1

  const avgLine = data.reduce((s, d) => s + d.leagueAvg, 0) / n

  const slotW = cW / n
  const barW = Math.max(2, slotW * 0.72)

  const toBarH = (v: number) => ((v - minScore) / range) * cH
  const toY = (v: number) => padT + cH - toBarH(v)
  const toX = (i: number) => padL + i * slotW + (slotW - barW) / 2

  const avgY = toY(avgLine)
  const labelEvery = Math.max(1, Math.ceil(n / 7))

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Floor */}
        <line
          x1={padL} y1={padT + cH}
          x2={W - padR} y2={padT + cH}
          stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.5}
        />

        {/* Bars */}
        {data.map((d, i) => {
          const bH = Math.max(2, toBarH(d.userScore))
          const above = d.userScore >= d.leagueAvg
          return (
            <rect
              key={i}
              x={toX(i)}
              y={padT + cH - bH}
              width={barW}
              height={bH}
              rx={1.5}
              fill={above ? "oklch(0.72 0.16 86)" : "oklch(0.48 0.04 250)"}
              opacity={above ? 0.95 : 0.6}
            />
          )
        })}

        {/* League avg dashed reference line */}
        <line
          x1={padL} y1={avgY}
          x2={W - padR - 10} y2={avgY}
          stroke="oklch(0.72 0.16 86)"
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={W - padR}
          y={avgY}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={6.5}
          fill="oklch(0.72 0.16 86)"
          opacity={0.6}
        >
          avg
        </text>

        {/* Y-axis: max and min */}
        <text
          x={padL - 4} y={padT}
          textAnchor="end" dominantBaseline="hanging"
          fontSize={7} fill="currentColor" opacity={0.4}
        >
          {Math.round(maxScore)}
        </text>
        <text
          x={padL - 4} y={padT + cH}
          textAnchor="end" dominantBaseline="auto"
          fontSize={7} fill="currentColor" opacity={0.4}
        >
          {Math.round(minScore)}
        </text>

        {/* X-axis: sparse labels */}
        {data.map((d, i) => {
          if (i % labelEvery !== 0) return null
          return (
            <text
              key={i}
              x={toX(i) + barW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={7}
              fill="currentColor"
              opacity={0.45}
            >
              {d.label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: "oklch(0.72 0.16 86)" }}
          />
          Above avg
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm opacity-60"
            style={{ backgroundColor: "oklch(0.48 0.04 250)" }}
          />
          Below avg
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-5 h-px border-t border-dashed opacity-60" style={{ borderColor: "oklch(0.72 0.16 86)" }} />
          League avg
        </div>
      </div>
    </div>
  )
}

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

  const rankData = scoreTimeline.map((t) => t.rank)

  // Sparse rank labels — at most 7 visible regardless of match count
  const n = scoreTimeline.length
  const labelEvery = Math.max(1, Math.ceil(n / 7))
  const sparseRankLabels = scoreTimeline.map((t, i) =>
    i % labelEvery === 0 ? t.label : ""
  )

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

      {/* Score Journey — per-match bars, amber = above league avg */}
      <Card className="glass">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Score Journey</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <MatchBarChart
            data={scoreTimeline.map((t) => ({
              userScore: t.userScore,
              leagueAvg: t.leagueAvg,
              label: t.label,
            }))}
          />
        </CardContent>
      </Card>

      {/* Rank Journey — line chart, inverted Y, sparse labels */}
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
                series={[{ label: "Your Rank", values: rankData, color: "oklch(0.65 0.18 250)" }]}
                xLabels={sparseRankLabels}
                width={400}
                height={130}
                invertY
                showDots={false}
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

"use client"

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/badges"
import type { PlayerWithTeam, PlayerVenueStats, PlayerVsTeamStats, PlayerSeasonStats } from "@/lib/types"
import { StackedBar } from "@/components/charts/stacked-bar"

const BAT_KEYS = new Set(["run", "four_bonus", "six_bonus", "thirty", "half_century", "century", "duck", "sr_above_170", "sr_150_170", "sr_70_80", "sr_below_70"])
const BOWL_KEYS = new Set(["wicket", "maiden", "three_wicket_haul", "four_wicket_haul", "five_wicket_haul", "econ_below_5", "econ_5_6", "econ_10_11", "econ_above_11"])
const FIELD_KEYS = new Set(["catch", "stumping", "run_out", "three_catch_bonus"])

function categorize(breakdown: Record<string, number>): { bat: number; bowl: number; field: number; bonus: number } {
  let bat = 0, bowl = 0, field = 0, bonus = 0
  for (const [k, v] of Object.entries(breakdown)) {
    if (BAT_KEYS.has(k)) bat += v
    else if (BOWL_KEYS.has(k)) bowl += v
    else if (FIELD_KEYS.has(k)) field += v
    else bonus += v
  }
  return { bat, bowl, field, bonus }
}

function StatCell({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined) return null
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function MiniBarChart({ scores, color }: { scores: number[]; color: string }) {
  const max = Math.max(...scores, 1)
  return (
    <div className="flex items-end gap-1 h-8">
      {scores.map((score, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm min-h-[2px]"
            style={{
              height: `${(score / max) * 100}%`,
              backgroundColor: color,
              opacity: 0.7 + (i / scores.length) * 0.3,
            }}
          />
          <span className="text-[9px] text-muted-foreground">{score}</span>
        </div>
      ))}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function PlayerStatsDrawer({
  player,
  tiplScores,
  venueStats,
  vsTeamStats,
  seasonStats,
  matchVenue,
  opponentTeamName,
  open,
  onClose,
}: {
  player: PlayerWithTeam | null
  tiplScores: Array<{ total: number; breakdown: Record<string, number> }>
  venueStats: PlayerVenueStats | null
  vsTeamStats: PlayerVsTeamStats | null
  seasonStats: PlayerSeasonStats[]
  matchVenue: string
  opponentTeamName: string
  open: boolean
  onClose: () => void
}) {
  if (!player) return null

  const hasStats = player.ipl_matches !== null
  const hasBowling = (player.ipl_wickets ?? 0) > 0
  const hasRecentForm = player.ipl_recent_scores && player.ipl_recent_scores.length > 0
  const hasTiplScores = tiplScores.length > 0
  const tiplTotals = tiplScores.map((s) => s.total)
  const tiplAvg = hasTiplScores
    ? Math.round(tiplTotals.reduce((a, b) => a + b, 0) / tiplTotals.length)
    : null
  const tiplHigh = hasTiplScores ? Math.max(...tiplTotals) : null
  const tiplLast = hasTiplScores ? tiplTotals[tiplTotals.length - 1] : null

  // Category averages across all matches
  const avgCategories = hasTiplScores ? (() => {
    let bat = 0, bowl = 0, field = 0
    for (const s of tiplScores) {
      const c = categorize(s.breakdown)
      bat += c.bat; bowl += c.bowl; field += c.field
    }
    const n = tiplScores.length
    return { bat: Math.round(bat / n), bowl: Math.round(bowl / n), field: Math.round(field / n) }
  })() : null

  // Form trend: compare avg of last 2 vs first 2
  const formTrend = tiplTotals.length >= 3 ? (() => {
    const recent = tiplTotals.slice(-2).reduce((a, b) => a + b, 0) / 2
    const early = tiplTotals.slice(0, 2).reduce((a, b) => a + b, 0) / 2
    const diff = recent - early
    if (diff > 10) return "rising" as const
    if (diff < -10) return "falling" as const
    return "steady" as const
  })() : null

  // Consistency: 100 - (CV * 100), capped 0-100
  const consistency = tiplTotals.length >= 2 ? (() => {
    const mean = tiplTotals.reduce((a, b) => a + b, 0) / tiplTotals.length
    if (mean === 0) return 0
    const variance = tiplTotals.reduce((a, b) => a + (b - mean) ** 2, 0) / tiplTotals.length
    const cv = Math.sqrt(variance) / Math.abs(mean)
    return Math.max(0, Math.min(100, Math.round(100 - cv * 100)))
  })() : null
  const hasMatchContext = venueStats || vsTeamStats
  const hasSeasonStats = seasonStats.length > 0

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        {/* Team color bar */}
        <div
          className="h-1 rounded-t-[10px]"
          style={{ backgroundColor: player.team.color }}
        />

        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-left">{player.name}</DrawerTitle>
              <DrawerDescription className="text-left flex items-center gap-2 mt-1">
                <span style={{ color: player.team.color }} className="font-semibold">
                  {player.team.short_name}
                </span>
                <Badge variant="outline" className={ROLE_COLORS[player.role]}>
                  {ROLE_LABELS[player.role]}
                </Badge>
                <span className="text-muted-foreground">{player.credit_cost} cr</span>
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          {!hasStats && !hasTiplScores && !hasMatchContext && !hasSeasonStats && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No stats available
            </div>
          )}

          {/* TIPL Form — prominent at top */}
          {hasTiplScores && (
            <>
              <SectionHeader>TIPL Form ({tiplScores.length} match{tiplScores.length > 1 ? "es" : ""})</SectionHeader>

              {/* Summary: Avg / Last / High */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center rounded-lg bg-overlay-subtle py-2">
                  <p className="text-lg font-bold text-foreground">{tiplAvg}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg</p>
                </div>
                <div className="text-center rounded-lg bg-overlay-subtle py-2">
                  <p className="text-lg font-bold text-foreground">{tiplLast}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last</p>
                </div>
                <div className="text-center rounded-lg bg-overlay-subtle py-2">
                  <p className="text-lg font-bold text-foreground">{tiplHigh}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">High</p>
                </div>
              </div>

              {/* Category split bar */}
              {avgCategories && (avgCategories.bat > 0 || avgCategories.bowl > 0 || avgCategories.field > 0) && (
                <div className="mb-3">
                  <StackedBar
                    segments={[
                      { label: "BAT", value: avgCategories.bat, color: "#4ade80" },
                      { label: "BOWL", value: avgCategories.bowl, color: "#60a5fa" },
                      { label: "FLD", value: avgCategories.field, color: "#fb923c" },
                    ]}
                    height={20}
                    showLabels
                    showLegend
                  />
                </div>
              )}

              {/* Per-match bar chart */}
              <MiniBarChart scores={tiplTotals} color="oklch(0.68 0.16 265)" />

              {/* Form trend + Consistency */}
              <div className="flex items-center justify-center gap-4 mt-2">
                {formTrend && (
                  <span className="text-xs text-muted-foreground">
                    Form:{" "}
                    <span className={formTrend === "rising" ? "text-[var(--tw-emerald-text)] font-semibold" : formTrend === "falling" ? "text-[var(--tw-red-text)] font-semibold" : "text-muted-foreground font-medium"}>
                      {formTrend === "rising" ? "↑ Rising" : formTrend === "falling" ? "↓ Falling" : "→ Steady"}
                    </span>
                  </span>
                )}
                {consistency !== null && (
                  <span className="text-xs text-muted-foreground">
                    Consistency:{" "}
                    <span className={consistency >= 70 ? "text-[var(--tw-emerald-text)] font-semibold" : consistency >= 40 ? "text-[var(--tw-amber-text)] font-semibold" : "text-[var(--tw-red-text)] font-semibold"}>
                      {consistency}%
                    </span>
                  </span>
                )}
              </div>
            </>
          )}

          {/* Match Context — vs opponent + at venue */}
          {hasMatchContext && (
            <>
              <SectionHeader>Match Context</SectionHeader>
              <div className="grid grid-cols-2 gap-3">
                {vsTeamStats && (
                  <div className="rounded-lg border border-overlay-border p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      vs {opponentTeamName}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell
                        label="Avg"
                        value={vsTeamStats.balls_faced > 0
                          ? (vsTeamStats.runs / Math.max(vsTeamStats.matches, 1)).toFixed(1)
                          : null}
                      />
                      <StatCell
                        label="SR"
                        value={vsTeamStats.balls_faced > 0
                          ? ((vsTeamStats.runs / vsTeamStats.balls_faced) * 100).toFixed(1)
                          : null}
                      />
                      <StatCell label="Wkts" value={vsTeamStats.wickets || null} />
                      <StatCell
                        label="Econ"
                        value={Number(vsTeamStats.overs_bowled) > 0
                          ? (vsTeamStats.runs_conceded / Number(vsTeamStats.overs_bowled)).toFixed(1)
                          : null}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center mt-1">
                      {vsTeamStats.matches} mat
                    </p>
                  </div>
                )}
                {venueStats && (
                  <div className="rounded-lg border border-overlay-border p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 truncate">
                      At {matchVenue.split(",")[0]}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell
                        label="Avg"
                        value={venueStats.balls_faced > 0
                          ? (venueStats.runs / Math.max(venueStats.matches, 1)).toFixed(1)
                          : null}
                      />
                      <StatCell
                        label="SR"
                        value={venueStats.balls_faced > 0
                          ? ((venueStats.runs / venueStats.balls_faced) * 100).toFixed(1)
                          : null}
                      />
                      <StatCell label="Wkts" value={venueStats.wickets || null} />
                      <StatCell
                        label="Econ"
                        value={Number(venueStats.overs_bowled) > 0
                          ? (venueStats.runs_conceded / Number(venueStats.overs_bowled)).toFixed(1)
                          : null}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center mt-1">
                      {venueStats.matches} mat
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Season Breakdown */}
          {hasSeasonStats && (
            <>
              <SectionHeader>Season Breakdown</SectionHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left py-1 font-semibold">Year</th>
                      <th className="text-center py-1 font-semibold">Mat</th>
                      <th className="text-center py-1 font-semibold">Runs</th>
                      <th className="text-center py-1 font-semibold">Avg</th>
                      <th className="text-center py-1 font-semibold">SR</th>
                      <th className="text-center py-1 font-semibold">Wkts</th>
                      <th className="text-center py-1 font-semibold">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonStats.map((ss, i) => {
                      const battingAvg = ss.innings > 0
                        ? (ss.runs / Math.max(ss.innings - ss.not_outs, 1)).toFixed(1)
                        : "-"
                      const sr = ss.balls_faced > 0
                        ? ((ss.runs / ss.balls_faced) * 100).toFixed(1)
                        : "-"
                      const econ = Number(ss.overs_bowled) > 0
                        ? (ss.runs_conceded / Number(ss.overs_bowled)).toFixed(1)
                        : "-"
                      return (
                        <tr
                          key={ss.season}
                          className={i % 2 === 0 ? "bg-muted/30" : ""}
                        >
                          <td className="py-1.5 pl-1 font-medium text-foreground">{ss.season}</td>
                          <td className="text-center py-1.5">{ss.matches}</td>
                          <td className="text-center py-1.5">{ss.runs}</td>
                          <td className="text-center py-1.5">{battingAvg}</td>
                          <td className="text-center py-1.5">{sr}</td>
                          <td className="text-center py-1.5">{ss.wickets || "-"}</td>
                          <td className="text-center py-1.5">{econ}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* IPL Career Batting */}
          {hasStats && (
            <>
              <SectionHeader>IPL Career</SectionHeader>
              <div className="grid grid-cols-4 gap-3">
                <StatCell label="Mat" value={player.ipl_matches} />
                <StatCell label="Inn" value={player.ipl_innings} />
                <StatCell label="Runs" value={player.ipl_runs} />
                <StatCell label="Avg" value={player.ipl_batting_avg} />
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                <StatCell label="SR" value={player.ipl_strike_rate} />
                <StatCell label="HS" value={player.ipl_highest_score} />
                <StatCell label="50s" value={player.ipl_fifties} />
                <StatCell label="100s" value={player.ipl_hundreds} />
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                <StatCell label="4s" value={player.ipl_fours} />
                <StatCell label="6s" value={player.ipl_sixes} />
                <StatCell label="Ct" value={player.ipl_catches} />
                <StatCell label="" value={null} />
              </div>
            </>
          )}

          {/* Bowling */}
          {hasBowling && (
            <>
              <SectionHeader>Bowling</SectionHeader>
              <div className="grid grid-cols-4 gap-3">
                <StatCell label="Wkts" value={player.ipl_wickets} />
                <StatCell label="Avg" value={player.ipl_bowling_avg} />
                <StatCell label="Econ" value={player.ipl_economy} />
                <StatCell label="Best" value={player.ipl_best_bowling} />
              </div>
            </>
          )}

          {/* Recent IPL Form */}
          {hasRecentForm && (
            <>
              <SectionHeader>Recent IPL Form</SectionHeader>
              <MiniBarChart
                scores={player.ipl_recent_scores!}
                color={player.team.color}
              />
            </>
          )}

          {/* (TIPL Form section moved to top of drawer) */}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

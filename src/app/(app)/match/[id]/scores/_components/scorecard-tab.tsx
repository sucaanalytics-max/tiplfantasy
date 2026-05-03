"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ScoreBreakdownDrawer } from "@/components/score-breakdown-drawer"
import type { PlayerScoreRow, TeamInfo } from "../scores-client"

type Props = {
  playerScores: PlayerScoreRow[]
  home: TeamInfo
  away: TeamInfo
  homeTeamId: string
  awayTeamId: string
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-amber-500",
  BAT: "text-blue-500",
  AR: "text-emerald-500",
  BOWL: "text-purple-500",
}

function calcSR(runs: number, balls: number) {
  if (balls === 0) return "—"
  return ((runs / balls) * 100).toFixed(1)
}

function calcEcon(runsConceded: number, overs: number | string) {
  const o = Number(overs)
  if (o === 0) return "—"
  return (runsConceded / o).toFixed(2)
}

function sortBatting(scores: PlayerScoreRow[]) {
  const withPos = scores
    .filter((ps) => ps.batting_position != null)
    .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99))
  const noPos = scores.filter((ps) => ps.batting_position == null)
  return [...withPos, ...noPos]
}

function sortBowling(scores: PlayerScoreRow[]) {
  return scores
    .filter((ps) => Number(ps.overs_bowled) > 0)
    .sort((a, b) => b.wickets - a.wickets || Number(b.overs_bowled) - Number(a.overs_bowled))
}

function InningsSection({
  battingTeam,
  bowlingTeam,
  battingScores,
  bowlingScores,
  onSelectRow,
}: {
  battingTeam: TeamInfo
  bowlingTeam: TeamInfo
  battingScores: PlayerScoreRow[]
  bowlingScores: PlayerScoreRow[]
  onSelectRow: (row: PlayerScoreRow) => void
}) {
  const batters = sortBatting(battingScores)
  const bowlers = sortBowling(bowlingScores)

  return (
    <div className="mb-6">
      {/* Batting table */}
      <div className="mb-1 px-3 py-1.5 flex items-center gap-2 border-b border-overlay-border">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: `#${battingTeam.color}` }}
        />
        <span className="text-xs font-bold tracking-wide">{battingTeam.short_name} BATTING</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-overlay-border">
              <th className="text-left py-1.5 pl-3 pr-2 font-medium w-[40%]">Batter</th>
              <th className="text-left py-1.5 pr-2 font-medium hidden sm:table-cell">Dismissal</th>
              <th className="text-right py-1.5 pr-2 font-medium tabular-nums">R</th>
              <th className="text-right py-1.5 pr-2 font-medium tabular-nums">B</th>
              <th className="text-right py-1.5 pr-2 font-medium tabular-nums">4s</th>
              <th className="text-right py-1.5 pr-2 font-medium tabular-nums">6s</th>
              <th className="text-right py-1.5 pr-2 font-medium tabular-nums hidden sm:table-cell">SR</th>
              <th className="text-right py-1.5 pr-3 font-medium tabular-nums text-primary">FP</th>
            </tr>
          </thead>
          <tbody>
            {batters.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-4 pl-3">
                  No batting data yet
                </td>
              </tr>
            ) : (
              batters.map((ps) => {
                // DNB = never assigned a batting position and had no batting activity
                const dnb = ps.batting_position == null && ps.runs === 0 && ps.balls_faced === 0
                return (
                  <tr
                    key={ps.player_id}
                    onClick={() => onSelectRow(ps)}
                    className="border-b border-overlay-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 pl-3 pr-2">
                      <span className="font-medium">{ps.player.name}</span>
                      <span className={cn("ml-1.5 text-[10px] font-semibold", ROLE_COLORS[ps.player.role] ?? "text-muted-foreground")}>
                        {ps.player.role}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground hidden sm:table-cell">
                      {dnb ? "did not bat" : (ps.dismissal ?? "not out")}
                    </td>
                    <td className={cn("py-2 pr-2 text-right tabular-nums font-semibold", dnb && "text-muted-foreground")}>
                      {dnb ? "—" : ps.runs}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                      {dnb ? "—" : ps.balls_faced}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                      {dnb ? "—" : ps.fours}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                      {dnb ? "—" : ps.sixes}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {dnb ? "—" : calcSR(ps.runs, ps.balls_faced)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-bold text-primary">
                      {Number(ps.fantasy_points) > 0 ? Number(ps.fantasy_points) : "—"}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bowling table — always render section, show placeholder row when no overs yet */}
      {(
        <>
          <div className="mt-4 mb-1 px-3 py-1.5 flex items-center gap-2 border-b border-overlay-border">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: `#${bowlingTeam.color}` }}
            />
            <span className="text-xs font-bold tracking-wide">{bowlingTeam.short_name} BOWLING</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-overlay-border">
                  <th className="text-left py-1.5 pl-3 pr-2 font-medium w-[40%]">Bowler</th>
                  <th className="text-right py-1.5 pr-2 font-medium tabular-nums">O</th>
                  <th className="text-right py-1.5 pr-2 font-medium tabular-nums">M</th>
                  <th className="text-right py-1.5 pr-2 font-medium tabular-nums">R</th>
                  <th className="text-right py-1.5 pr-2 font-medium tabular-nums">W</th>
                  <th className="text-right py-1.5 pr-2 font-medium tabular-nums hidden sm:table-cell">Econ</th>
                  <th className="text-right py-1.5 pr-3 font-medium tabular-nums text-primary">FP</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-4 pl-3">
                      No bowling data yet
                    </td>
                  </tr>
                ) : bowlers.map((ps) => (
                  <tr
                    key={ps.player_id}
                    onClick={() => onSelectRow(ps)}
                    className="border-b border-overlay-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 pl-3 pr-2">
                      <span className="font-medium">{ps.player.name}</span>
                      <span className={cn("ml-1.5 text-[10px] font-semibold", ROLE_COLORS[ps.player.role] ?? "text-muted-foreground")}>
                        {ps.player.role}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{ps.overs_bowled}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{ps.maidens}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{ps.runs_conceded}</td>
                    <td className="py-2 pr-2 text-right tabular-nums font-semibold">{ps.wickets}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {calcEcon(ps.runs_conceded, ps.overs_bowled)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-bold text-primary">
                      {Number(ps.fantasy_points) > 0 ? Number(ps.fantasy_points) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export function ScorecardTab({ playerScores, home, away, homeTeamId, awayTeamId }: Props) {
  const [drawerRow, setDrawerRow] = useState<PlayerScoreRow | null>(null)

  const homeScores = playerScores.filter((ps) => ps.player.team_id === homeTeamId)
  const awayScores = playerScores.filter((ps) => ps.player.team_id === awayTeamId)

  if (playerScores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Scorecard not yet available.
      </p>
    )
  }

  return (
    <div className="pb-4">
      <InningsSection
        battingTeam={home}
        bowlingTeam={away}
        battingScores={homeScores}
        bowlingScores={awayScores}
        onSelectRow={setDrawerRow}
      />
      <InningsSection
        battingTeam={away}
        bowlingTeam={home}
        battingScores={awayScores}
        bowlingScores={homeScores}
        onSelectRow={setDrawerRow}
      />
      <ScoreBreakdownDrawer
        open={drawerRow !== null}
        onOpenChange={(open) => { if (!open) setDrawerRow(null) }}
        row={drawerRow}
      />
    </div>
  )
}

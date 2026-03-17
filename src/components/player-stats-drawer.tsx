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
import type { PlayerWithTeam } from "@/lib/types"

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
  open,
  onClose,
}: {
  player: PlayerWithTeam | null
  tiplScores: number[]
  open: boolean
  onClose: () => void
}) {
  if (!player) return null

  const hasStats = player.ipl_matches !== null
  const hasBowling = (player.ipl_wickets ?? 0) > 0
  const hasRecentForm = player.ipl_recent_scores && player.ipl_recent_scores.length > 0
  const hasTiplScores = tiplScores.length > 0
  const tiplAvg = hasTiplScores
    ? (tiplScores.reduce((a, b) => a + b, 0) / tiplScores.length).toFixed(1)
    : null

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
          {!hasStats && !hasTiplScores && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No stats available
            </div>
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

          {/* TIPL Fantasy Scores */}
          {hasTiplScores && (
            <>
              <SectionHeader>TIPL Fantasy</SectionHeader>
              <MiniBarChart scores={tiplScores} color="oklch(0.68 0.16 265)" />
              <p className="text-xs text-muted-foreground mt-1.5 text-center">
                Avg: <span className="text-foreground font-semibold">{tiplAvg} pts</span>
                {" "}(last {tiplScores.length})
              </p>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

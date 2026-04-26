"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PlayerScoreRow } from "../scores-client"

const ROLE_COLORS: Record<string, string> = {
  WK: "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]",
  BAT: "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]",
  AR: "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]",
  BOWL: "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]",
}

type Props = {
  playerScores: PlayerScoreRow[]
  myPlayerSet: Set<string>
  count?: number
}

/**
 * Top scoring players for the match. Reads from `playerScores`
 * (already sorted by fantasy_points DESC server-side).
 *
 * Each row: role badge · name · key stats · fantasy points · marker
 * if owned by me. Stats compress to runs(balls) for batting and
 * wickets/runs for bowling, separated by ` · ` when both are present.
 */
export function TopScorers({ playerScores, myPlayerSet, count = 5 }: Props) {
  const top = playerScores
    .filter((ps) => Number(ps.fantasy_points) > 0)
    .slice(0, count)

  if (top.length === 0) return null

  return (
    <section className="px-3 pt-4 pb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Top Scorers
        </span>
        <span className="text-[10px] text-muted-foreground/60">match</span>
      </div>
      <div className="space-y-1">
        {top.map((ps) => {
          const isMine = myPlayerSet.has(ps.player_id)
          const bowled = Number(ps.overs_bowled) > 0
          const batted = ps.runs > 0 || ps.balls_faced > 0
          return (
            <div
              key={ps.player_id}
              className={cn(
                "flex items-center gap-2 py-1.5 px-2.5 rounded-lg",
                isMine
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-overlay-subtle",
              )}
            >
              <Badge
                variant="outline"
                className={cn(
                  "text-[8px] px-1 py-0 h-[14px] shrink-0",
                  ROLE_COLORS[ps.player.role],
                )}
              >
                {ps.player.role}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate">
                  {ps.player.name}
                  {isMine && <span className="text-[8px] text-primary ml-1">●</span>}
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {batted && `${ps.runs}(${ps.balls_faced})`}
                  {batted && bowled && " · "}
                  {bowled && `${ps.wickets}/${ps.runs_conceded}`}
                </p>
              </div>
              <span className="text-sm font-bold font-display tabular-nums shrink-0">
                {Number(ps.fantasy_points)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

"use client"

import { AnimatedNumber } from "@/components/animated-number"
import { cn } from "@/lib/utils"

type Props = {
  rank: number | null
  totalPlayers: number
  totalPoints: number
  captainName: string | null
  captainPoints: number
  vcName?: string | null
  vcPoints?: number
  leaderPoints: number
  isLive: boolean
}

export function MatchScoreBlock({
  rank,
  totalPlayers,
  totalPoints,
  captainName,
  captainPoints,
  vcName = null,
  vcPoints = 0,
  leaderPoints,
  isLive,
}: Props) {
  if (rank == null) return null

  const isFirst = rank === 1
  const isBottom = totalPlayers > 0 && rank > Math.floor(totalPlayers * 0.8)
  const gap = leaderPoints - totalPoints
  const pct = leaderPoints > 0 ? Math.min((totalPoints / leaderPoints) * 100, 100) : 0

  return (
    <div className="px-4 pt-3 pb-3 bg-overlay-subtle border-b border-overlay-border">
      {/* Row 1: rank + points */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div
            className={cn(
              "font-display font-black leading-none tracking-tight tabular-nums",
              isFirst ? "text-[var(--captain-gold)]" : isBottom ? "text-rose-400" : "text-foreground",
            )}
            style={{ fontSize: 52 }}
          >
            #{rank}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            of {totalPlayers} players
          </div>
        </div>

        <div className="text-right">
          <div
            className={cn(
              "font-display font-black leading-none tabular-nums text-[var(--captain-gold)]",
              isLive && "animate-pulse-subtle",
            )}
            style={{ fontSize: 36 }}
          >
            {isLive ? <AnimatedNumber value={totalPoints} /> : totalPoints}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">pts</div>
        </div>
      </div>

      {/* Row 2: progress to leader */}
      {!isFirst && leaderPoints > 0 && (
        <>
          <div className="mt-2.5 h-1 bg-overlay-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">
            −{gap} to #1
          </div>
        </>
      )}

      {/* Row 3: captain + vc chips */}
      {(captainName || vcName) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {captainName && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-overlay-muted border border-overlay-border text-[10px]">
              <span className="font-black text-[var(--captain-gold)]">©</span>
              <span className="font-medium">{captainName}</span>
              <span className="text-[var(--captain-gold)] font-bold tabular-nums">+{captainPoints}</span>
              <span className="text-muted-foreground/60">(2×)</span>
            </span>
          )}
          {vcName && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-overlay-muted border border-overlay-border text-[10px]">
              <span className="font-black text-primary">VC</span>
              <span className="font-medium">{vcName}</span>
              <span className="text-primary font-bold tabular-nums">+{vcPoints}</span>
              <span className="text-muted-foreground/60">(1.5×)</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

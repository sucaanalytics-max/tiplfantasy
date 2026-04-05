"use client"

import { cn } from "@/lib/utils"

type Props = {
  rank: number | null
  totalPoints: number
  captainName: string | null
  captainPoints: number
  leaderPoints: number
  isLive: boolean
  totalUsers: number
}

export function FantasyHUD({ rank, totalPoints, captainName, captainPoints, leaderPoints, isLive, totalUsers }: Props) {
  const pct = leaderPoints > 0 ? Math.min((totalPoints / leaderPoints) * 100, 100) : 0
  const gap = leaderPoints - totalPoints
  const isLeading = rank === 1

  return (
    <div className="px-4 py-2.5 bg-overlay-subtle border-b border-overlay-border">
      <div className="flex items-center justify-between gap-3">
        {/* Left: rank + points */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex items-center justify-center h-9 w-9 rounded-xl font-display font-bold text-sm shrink-0",
            rank === 1 ? "bg-amber-500/20 text-amber-400" :
            rank != null && rank <= 3 ? "bg-blue-500/20 text-blue-400" :
            "bg-overlay-muted text-muted-foreground"
          )}>
            {rank != null ? `#${rank}` : "—"}
          </div>
          <div className="min-w-0">
            <p className={cn("text-xl font-bold font-display tabular-nums", isLive && "animate-pulse-subtle")}>
              {totalPoints}
              <span className="text-xs font-normal text-muted-foreground ml-1">pts</span>
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {rank != null ? `${rank} of ${totalUsers}` : "No score yet"}
            </p>
          </div>
        </div>

        {/* Right: captain line */}
        {captainName && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground">Captain</p>
            <p className="text-sm font-semibold truncate max-w-[100px]">{captainName}</p>
            <p className="text-xs text-amber-400 font-display tabular-nums">+{captainPoints} (2×)</p>
          </div>
        )}
      </div>

      {/* Progress bar vs #1 */}
      {rank != null && rank > 1 && leaderPoints > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{gap} pts behind #1</span>
            <span className="tabular-nums">{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-overlay-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Leading indicator */}
      {isLeading && rank === 1 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          You&apos;re leading!
        </div>
      )}
    </div>
  )
}

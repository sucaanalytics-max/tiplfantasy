"use client"

import { AnimatedNumber } from "@/components/animated-number"
import { cn } from "@/lib/utils"

type Props = {
  rank: number | null
  totalPoints: number
  captainName: string | null
  captainPoints: number
  vcName?: string | null
  vcPoints?: number
  leaderPoints: number
  isLive: boolean
  totalUsers: number
  /**
   * "default" — original card with separate left rank/pts column and right captain block + progress bar (legacy).
   * "compact" — single-row strip designed to slot under a sticky cricket strip:
   *   `#4 / 23   312 pts   −28 to #1   ▓▓▓░`
   *   `C: Bumrah +88 (2×)  ·  VC: Hardik +33 (1.5×)`
   */
  variant?: "default" | "compact"
}

export function FantasyHUD({
  rank, totalPoints, captainName, captainPoints,
  vcName = null, vcPoints = 0,
  leaderPoints, isLive, totalUsers,
  variant = "default",
}: Props) {
  const pct = leaderPoints > 0 ? Math.min((totalPoints / leaderPoints) * 100, 100) : 0
  const gap = leaderPoints - totalPoints
  const isLeading = rank === 1

  if (variant === "compact") {
    return (
      <div className="px-4 py-2 bg-overlay-subtle border-b border-overlay-border">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "font-display font-bold text-sm tabular-nums",
            rank === 1 ? "text-[var(--tw-amber-text)]" : "text-foreground",
          )}>
            {rank != null ? `#${rank}` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            of {totalUsers}
          </span>
          <span className={cn(
            "ml-2 text-gold-stat text-lg leading-none",
            isLive && "animate-pulse-subtle",
          )}>
            {isLive ? <AnimatedNumber value={totalPoints} /> : totalPoints}
          </span>
          <span className="text-[10px] text-muted-foreground">pts</span>
          {rank != null && rank > 1 && leaderPoints > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              −{gap} to #1
            </span>
          )}
          {isLeading && (
            <span className="ml-auto text-[10px] text-[var(--tw-amber-text)] font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tw-amber-text)] animate-pulse" />
              Leading
            </span>
          )}
        </div>

        {/* Progress bar */}
        {rank != null && rank > 1 && leaderPoints > 0 && (
          <div className="mt-1.5 h-1 bg-overlay-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Captain / VC line */}
        {(captainName || vcName) && (
          <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground truncate">
            {captainName && (
              <span className="truncate">
                <span className="text-muted-foreground/60">C:</span>{" "}
                <span className="text-foreground/90 font-medium">{captainName}</span>
                <span className="text-[var(--tw-amber-text)] tabular-nums ml-1">+{captainPoints}</span>
                <span className="text-muted-foreground/60"> (2×)</span>
              </span>
            )}
            {vcName && (
              <span className="truncate">
                <span className="text-muted-foreground/60">VC:</span>{" "}
                <span className="text-foreground/90 font-medium">{vcName}</span>
                <span className="text-[var(--tw-sky-text)] tabular-nums ml-1">+{vcPoints}</span>
                <span className="text-muted-foreground/60"> (1.5×)</span>
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Legacy default variant ────────────────────────────────────────
  return (
    <div className="px-4 py-2.5 bg-overlay-subtle border-b border-overlay-border">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex items-center justify-center h-9 w-9 rounded-xl font-display font-bold text-sm shrink-0",
            rank === 1 ? "bg-amber-500/20 text-[var(--tw-amber-text)]" :
            rank != null && rank <= 3 ? "bg-blue-500/20 text-[var(--tw-blue-text)]" :
            "bg-overlay-muted text-muted-foreground"
          )}>
            {rank != null ? `#${rank}` : "—"}
          </div>
          <div className="min-w-0">
            <p className={cn("text-xl font-bold font-display tabular-nums", isLive && "animate-pulse-subtle")}>
              {isLive ? <AnimatedNumber value={totalPoints} /> : totalPoints}
              <span className="text-xs font-normal text-muted-foreground ml-1">pts</span>
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {rank != null ? `${rank} of ${totalUsers}` : "No score yet"}
            </p>
          </div>
        </div>

        {captainName && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground">Captain</p>
            <p className="text-sm font-semibold truncate max-w-[100px]">{captainName}</p>
            <p className="text-xs text-[var(--tw-amber-text)] font-display tabular-nums">+{captainPoints} (2×)</p>
          </div>
        )}
      </div>

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

      {isLeading && rank === 1 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--tw-amber-text)] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tw-amber-text)] animate-pulse" />
          You&apos;re leading!
        </div>
      )}
    </div>
  )
}

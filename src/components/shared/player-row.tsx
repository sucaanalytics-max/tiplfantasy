"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const ROLE_COLORS: Record<string, string> = {
  WK: "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]",
  BAT: "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]",
  AR: "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]",
  BOWL: "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]",
}

export type PlayerRowData = {
  id: string
  name: string
  role: string
  teamShortName?: string
  teamColor?: string
}

export type PlayerRowStats = {
  runs?: number
  ballsFaced?: number
  fours?: number
  sixes?: number
  wickets?: number
  oversBowled?: number
  runsConceded?: number
  maidens?: number
  catches?: number
  stumpings?: number
  runOuts?: number
  fantasyPoints?: number
}

type Props = {
  player: PlayerRowData
  stats?: PlayerRowStats
  isCaptain?: boolean
  isViceCaptain?: boolean
  multiplier?: number
  effectivePoints?: number
  isHighlighted?: boolean
  /** "compact" for leaderboard expanded, "detailed" for scores/preview, "comparison" for league compare */
  variant?: "compact" | "detailed" | "comparison"
  /** For comparison mode */
  myMultiplier?: string
  theirMultiplier?: string
  showSharedNotes?: boolean
  className?: string
}

/**
 * Unified player row component used across the app.
 * Three variants:
 * - compact: name + role + points (leaderboard expanded rows)
 * - detailed: name + role + team + stats + points (scores page, preview)
 * - comparison: name + role + team + multiplier labels + points (league compare)
 */
export function PlayerRow({
  player,
  stats,
  isCaptain,
  isViceCaptain,
  multiplier = 1,
  effectivePoints,
  isHighlighted,
  variant = "compact",
  myMultiplier,
  theirMultiplier,
  showSharedNotes,
  className,
}: Props) {
  const roleColor = ROLE_COLORS[player.role] ?? ROLE_COLORS.BAT
  const pts = effectivePoints ?? stats?.fantasyPoints ?? 0

  // C/VC badge text
  const cvLabel = isCaptain ? "C" : isViceCaptain ? "VC" : null

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 py-1 text-xs", className)}>
        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border shrink-0", roleColor)}>
          {cvLabel ?? player.role}
        </Badge>
        <span className="truncate min-w-0 font-medium">{player.name}</span>
        {stats && (
          <span className="text-muted-foreground text-[10px] truncate">
            {(stats.runs ?? 0) > 0 && `${stats.runs}(${stats.ballsFaced})`}
            {(stats.oversBowled ?? 0) > 0 && ` ${stats.wickets}/${stats.runsConceded}`}
          </span>
        )}
        <span className="ml-auto font-bold font-display tabular-nums shrink-0">{pts}</span>
      </div>
    )
  }

  if (variant === "comparison") {
    return (
      <div className={cn("flex items-center gap-3 py-2.5 px-3 rounded-lg bg-overlay-subtle border border-overlay-border", className)}>
        <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0.5 border shrink-0", roleColor)}>
          {player.role}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{player.name}</p>
          {player.teamShortName && (
            <p className="text-[11px] text-muted-foreground">{player.teamShortName}</p>
          )}
        </div>
        {showSharedNotes && myMultiplier && theirMultiplier ? (
          <div className="text-[10px] text-right shrink-0 space-y-0.5">
            <p className="text-primary/80">You: {myMultiplier}</p>
            <p className="text-muted-foreground">They: {theirMultiplier}</p>
          </div>
        ) : myMultiplier && myMultiplier !== "1×" ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-400/30 bg-[var(--tw-amber-bg)] text-[var(--tw-amber-text)] shrink-0">
            {myMultiplier}
          </span>
        ) : theirMultiplier && theirMultiplier !== "1×" ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-400/30 bg-[var(--tw-red-bg)] text-[var(--tw-red-text)] shrink-0">
            {theirMultiplier}
          </span>
        ) : null}
        {pts !== undefined && (
          <span className="text-sm font-bold font-display tabular-nums shrink-0">{pts}</span>
        )}
      </div>
    )
  }

  // detailed variant
  return (
    <div className={cn(
      "flex items-center gap-3 py-2.5 px-3 border-b border-overlay-border last:border-b-0",
      isHighlighted && "bg-primary/5",
      className,
    )}>
      <div className="flex items-center gap-1 shrink-0">
        {cvLabel && (
          <span className={cn(
            "text-[8px] font-bold",
            isCaptain ? "text-[var(--tw-amber-text)]" : "text-[var(--tw-sky-text)]"
          )}>
            {cvLabel}
          </span>
        )}
        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border", roleColor)}>
          {player.role}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{player.name}</span>
        {player.teamShortName && (
          <span
            className="text-[10px] font-semibold"
            style={{ color: player.teamColor }}
          >
            {player.teamShortName}
          </span>
        )}
      </div>
      {stats && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          {(stats.runs ?? 0) > 0 && <span>{stats.runs}({stats.ballsFaced})</span>}
          {(stats.fours ?? 0) > 0 && <span>{stats.fours}×4</span>}
          {(stats.sixes ?? 0) > 0 && <span>{stats.sixes}×6</span>}
          {(stats.oversBowled ?? 0) > 0 && <span>{stats.wickets}/{stats.runsConceded}</span>}
        </div>
      )}
      <div className="text-right shrink-0">
        <span className="text-sm font-bold font-display tabular-nums">{pts}</span>
        {multiplier > 1 && (
          <p className="text-[9px] text-muted-foreground">{stats?.fantasyPoints}×{multiplier}</p>
        )}
      </div>
    </div>
  )
}

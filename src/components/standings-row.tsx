import { Crown } from "@/components/icons/cricket-icons"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { cn } from "@/lib/utils"

export interface StandingsRowProps {
  rank: number
  displayName: string
  isMe: boolean
  gap: number | null
  points: number
}

export function StandingsRow({
  rank,
  displayName,
  isMe,
  gap,
  points,
}: StandingsRowProps) {
  const top1 = rank === 1
  const top2 = rank === 2
  const top3 = rank === 3

  return (
    <div className={cn("standings-grid px-4 py-3 transition-colors", isMe && "row-highlight-you")}>
      {/* Rank cell */}
      <div className="flex items-center justify-center">
        {top1 ? (
          <span className="relative inline-flex items-center justify-center h-7 w-7 rounded-full bg-accent text-accent-foreground ring-2 ring-accent shadow-[0_0_12px_oklch(0.78_0.17_86/0.4)]">
            <Crown className="h-3.5 w-3.5" />
          </span>
        ) : top2 ? (
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[oklch(0.72_0.01_260)] text-foreground/90 font-display font-bold text-xs ring-2 ring-[oklch(0.72_0.01_260)] shadow-sm">
            {rank}
          </span>
        ) : top3 ? (
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[oklch(0.63_0.10_55)] text-white font-display font-bold text-xs ring-2 ring-[oklch(0.63_0.10_55)] shadow-sm">
            {rank}
          </span>
        ) : (
          <span className="font-display font-semibold text-sm text-muted-foreground tabular-nums">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", getAvatarColor(displayName))}>
        <span className="text-white text-xs font-semibold">{getInitials(displayName)}</span>
      </div>

      {/* Name */}
      <span className={cn("text-sm truncate", isMe && "font-semibold")}>
        {displayName}
        {isMe && " (you)"}
      </span>

      {/* Pts (gold) */}
      <span className="text-gold-stat text-sm tabular-nums text-right">{Math.round(points).toLocaleString()}</span>

      {/* Gap to leader */}
      <span
        className={cn(
          "text-right tabular-nums text-xs",
          gap === null ? "text-muted-foreground/60" : "text-rose-400/80"
        )}
      >
        {gap === null ? "—" : `−${Math.round(Math.abs(gap)).toLocaleString()}`}
      </span>
    </div>
  )
}

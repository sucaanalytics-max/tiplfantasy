"use client"

import { RankBadge } from "@/components/rank-badge"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const MEDALS = ["🥇", "🥈", "🥉"] as const

export type LeaderboardEntry = {
  userId: string
  displayName: string
  totalPoints: number
  rank: number
  matchesPlayed?: number
  avgPoints?: number
  captainPick?: string
}

type Props = {
  entry: LeaderboardEntry
  isCurrentUser: boolean
  isExpanded?: boolean
  onToggle?: () => void
  expandedContent?: React.ReactNode
  /** "season" uses medal emojis, "match" uses RankBadge, "league" uses colored circles */
  variant?: "season" | "match" | "league"
  className?: string
}

/**
 * Unified leaderboard row used across the app.
 * Supports expandable content, different rank styles, and stats columns.
 */
export function LeaderboardRow({
  entry,
  isCurrentUser,
  isExpanded,
  onToggle,
  expandedContent,
  variant = "match",
  className,
}: Props) {
  const isExpandable = !!onToggle

  const rankElement = (() => {
    if (variant === "season") {
      return (
        <span className="w-6 text-center text-sm shrink-0">
          {entry.rank <= 3 ? MEDALS[entry.rank - 1] : <span className="text-muted-foreground">{entry.rank}</span>}
        </span>
      )
    }
    if (variant === "league") {
      return (
        <span className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
          entry.rank === 1 && "bg-amber-400/20 text-amber-400",
          entry.rank === 2 && "bg-gray-400/20 text-gray-400",
          entry.rank === 3 && "bg-amber-600/20 text-amber-600",
          entry.rank > 3 && "bg-secondary text-muted-foreground"
        )}>
          {entry.rank}
        </span>
      )
    }
    return <RankBadge rank={entry.rank} size="sm" />
  })()

  const Tag = isExpandable ? "button" : "div"

  return (
    <div className={className}>
      <Tag
        {...(isExpandable ? { onClick: onToggle } : {})}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors",
          isExpandable && "hover:bg-overlay-subtle active:bg-secondary/70",
          isCurrentUser && "bg-primary/10 border border-primary/20",
          isExpanded && !isCurrentUser && "bg-overlay-subtle",
          !isCurrentUser && entry.rank === 1 && "bg-amber-500/[0.06]",
          !isCurrentUser && entry.rank === 2 && "bg-gray-400/[0.04]",
          !isCurrentUser && entry.rank === 3 && "bg-amber-700/[0.04]",
        )}
      >
        {rankElement}

        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAvatarColor(entry.displayName))}>
          <span className="text-white text-[10px] font-semibold">{getInitials(entry.displayName)}</span>
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium truncate">
            {entry.displayName}
            {isCurrentUser && <span className="text-primary text-[10px] ml-1">(you)</span>}
          </p>
          {entry.captainPick && (
            <p className="text-[10px] text-muted-foreground truncate">C: {entry.captainPick}</p>
          )}
        </div>

        {/* Stats columns */}
        {entry.matchesPlayed != null && (
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right shrink-0">{entry.matchesPlayed}M</span>
        )}
        {entry.avgPoints != null && (
          <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right shrink-0">{entry.avgPoints.toFixed(0)} avg</span>
        )}

        <span className={cn(
          "font-bold font-display tabular-nums shrink-0",
          variant === "league" ? "text-lg" : "text-sm"
        )}>
          {entry.totalPoints}
        </span>

        {isExpandable && (
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
        )}
      </Tag>

      {isExpanded && expandedContent && (
        <div className="ml-8 mr-2 mb-2 border-t border-overlay-border pt-2 space-y-0.5">
          {expandedContent}
        </div>
      )}
    </div>
  )
}

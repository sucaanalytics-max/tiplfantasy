"use client"

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
type UserRow = {
  user_id: string
  display_name: string
  rank: number | null
  total_points: number
  captain_name: string | null
  vc_name: string | null
}

type Props = {
  rows: UserRow[]
  currentUserId: string
  myPoints: number
  rankDeltas: Map<string, number>
  snapshots: Array<{ over_number: number; scores: Record<string, number> }>
  onRowClick: (userId: string) => void
  expandedUserId: string | null
  renderPanel: (userId: string) => ReactNode
}

/**
 * League standings as a 2-line card per row. When a row is tapped, an
 * expansion panel is rendered as a normal sibling element directly below
 * the row (no modal, no overlay). The page body scrolls naturally to
 * accommodate the expanded content.
 */
export function StandingsTable({
  rows, currentUserId, myPoints, rankDeltas, snapshots,
  onRowClick, expandedUserId, renderPanel,
}: Props) {
  const myRow = useMemo(() => rows.find((r) => r.user_id === currentUserId), [rows, currentUserId])
  const myRowRef = useRef<HTMLDivElement | null>(null)
  const [showPin, setShowPin] = useState(false)

  useEffect(() => {
    if (!myRowRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowPin(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -64px 0px" },
    )
    obs.observe(myRowRef.current)
    return () => obs.disconnect()
  }, [myRow?.user_id])

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No scores yet.</p>
  }

  return (
    <div className="relative">
      <div className="divide-y divide-overlay-border">
        {rows.map((row) => {
          const isMe = row.user_id === currentUserId
          const isExpanded = expandedUserId === row.user_id
          const delta = rankDeltas.get(row.user_id) ?? 0
          return (
            <div key={row.user_id} ref={isMe ? myRowRef : undefined}>
              <StandingsRow
                row={row}
                isMe={isMe}
                isExpanded={isExpanded}
                delta={delta}
                onClick={() => onRowClick(row.user_id)}
              />
              {isExpanded && (
                <div className="border-t border-overlay-border">
                  {renderPanel(row.user_id)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky-bottom "you" pin */}
      {showPin && myRow && (
        <div className="sticky bottom-0 left-0 right-0 z-20 -mx-px border-t-2 border-primary/40 shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.25)]">
          <StandingsRow
            row={myRow}
            isMe
            isExpanded={expandedUserId === myRow.user_id}
            delta={rankDeltas.get(myRow.user_id) ?? 0}
            onClick={() => onRowClick(myRow.user_id)}
            pinned
          />
        </div>
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────

type RowProps = {
  row: UserRow
  isMe: boolean
  isExpanded: boolean
  delta: number
  onClick: () => void
  pinned?: boolean
}

const MEDALS = ["🥇", "🥈", "🥉"] as const

const StandingsRow = memo(function StandingsRow({
  row, isMe, isExpanded, delta, onClick, pinned,
}: RowProps) {
  const rank = row.rank ?? 0

  const prevPointsRef = useRef(row.total_points)
  const [pointsTick, setPointsTick] = useState(false)
  useEffect(() => {
    if (prevPointsRef.current !== row.total_points) {
      prevPointsRef.current = row.total_points
      setPointsTick(true)
      const t = setTimeout(() => setPointsTick(false), 380)
      return () => clearTimeout(t)
    }
  }, [row.total_points])

  const captainShort = row.captain_name
    ? row.captain_name.split(" ").slice(-1)[0]
    : null

  return (
    <button
      onClick={onClick}
      aria-expanded={isExpanded}
      className={cn(
        "w-full grid grid-cols-[28px_32px_1fr_auto_auto_auto_16px] items-center gap-2 px-3 py-2.5 text-left transition-colors",
        isMe && !pinned && "bg-primary/[0.04] ring-inset ring-1 ring-primary/40",
        !isMe && "hover:bg-overlay-subtle active:bg-overlay-muted",
        pinned && "bg-background",
        isExpanded && !pinned && "bg-overlay-subtle",
      )}
    >
      {/* Rank / medal */}
      <div className="flex items-center justify-center">
        {rank >= 1 && rank <= 3 ? (
          <span className="text-base leading-none">{MEDALS[rank - 1]}</span>
        ) : (
          <span className="text-sm font-display font-bold tabular-nums text-muted-foreground">
            {row.rank ?? "—"}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAvatarColor(row.display_name))}>
        <span className="text-white text-[10px] font-semibold">{getInitials(row.display_name)}</span>
      </div>

      {/* Name */}
      <div className="min-w-0 overflow-hidden">
        <span className={cn(
          "text-[13px] leading-tight truncate block",
          isMe ? "font-semibold text-primary" : "font-medium",
        )}>
          {row.display_name}
          {isMe && <span className="text-[10px] ml-1 font-normal opacity-70">(you)</span>}
        </span>
      </div>

      {/* Captain (last name only) */}
      <div className="text-right shrink-0">
        {captainShort ? (
          <span className="text-[9px] text-muted-foreground">
            <span className="text-[var(--captain-gold)] font-bold">©</span> {captainShort}
          </span>
        ) : null}
      </div>

      {/* Rank delta */}
      <div className="shrink-0 w-6 text-right">
        {delta > 0 ? (
          <span className="text-[10px] font-bold text-emerald-400">▲{delta}</span>
        ) : delta < 0 ? (
          <span className="text-[10px] font-bold text-rose-400">▼{Math.abs(delta)}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground/30">—</span>
        )}
      </div>

      {/* Points */}
      <div className="text-right shrink-0 min-w-[2.75rem]">
        <span
          className="text-gold-stat text-base tabular-nums"
          style={pointsTick ? { animation: "score-tick 350ms ease-out" } : undefined}
        >
          {row.total_points}
        </span>
      </div>

      {/* Expand chevron */}
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground/40 transition-transform shrink-0",
          isExpanded && "rotate-180 text-muted-foreground",
        )}
      />
    </button>
  )
})

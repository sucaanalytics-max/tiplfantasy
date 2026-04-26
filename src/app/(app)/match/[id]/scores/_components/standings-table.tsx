"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { computeMomentumSeries } from "@/lib/rivalry"
import { MomentumSparkline } from "./momentum-sparkline"

type UserRow = {
  user_id: string
  display_name: string
  rank: number | null
  total_points: number
  captain_short_name: string | null
}

type Props = {
  rows: UserRow[]
  currentUserId: string
  myPoints: number
  rankDeltas: Map<string, number>
  snapshots: Array<{ over_number: number; scores: Record<string, number> }>
  onRowClick: (userId: string) => void
}

/**
 * Dense league standings table with sticky-bottom "you" pin.
 *
 * Mobile (390px) columns:  # | Player | Cap | Pts | vMe / Δ
 * ≥430px adds:             + Mom sparkline column
 *
 * "You" row is rendered inline, plus a duplicate copy pinned to the bottom
 * of the viewport via IntersectionObserver — fades in only when the real
 * row scrolls offscreen.
 */
export function StandingsTable({
  rows, currentUserId, myPoints, rankDeltas, snapshots, onRowClick,
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
      {/* Header */}
      <div className="grid grid-cols-[1.5rem_1fr_3.25rem_3rem_3.5rem_minmax(0,_3.5rem)] sm:grid-cols-[1.5rem_1fr_3.5rem_3rem_3.75rem_3.5rem] items-center gap-2 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70 border-b border-overlay-border bg-overlay-subtle">
        <span className="text-left">#</span>
        <span>Player</span>
        <span className="text-left truncate">Cap</span>
        <span className="text-right">Pts</span>
        <span className="text-right">vMe</span>
        <span className="text-right hidden sm:inline">Trend</span>
        <span className="text-right inline sm:hidden">Δ</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-overlay-border">
        {rows.map((row) => {
          const isMe = row.user_id === currentUserId
          const series = computeMomentumSeries(row.user_id, snapshots)
          const delta = rankDeltas.get(row.user_id) ?? 0
          const vMe = isMe ? null : Math.round((row.total_points - myPoints) * 10) / 10
          return (
            <div key={row.user_id} ref={isMe ? myRowRef : undefined}>
              <StandingsRow
                row={row}
                isMe={isMe}
                vMe={vMe}
                delta={delta}
                series={series}
                onClick={() => onRowClick(row.user_id)}
              />
            </div>
          )
        })}
      </div>

      {/* Sticky-bottom "you" pin — only when myRow scrolls offscreen */}
      {showPin && myRow && (
        <div className="sticky bottom-0 left-0 right-0 z-20 -mx-px border-t-2 border-primary/40 shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.25)]">
          <StandingsRow
            row={myRow}
            isMe
            vMe={null}
            delta={rankDeltas.get(myRow.user_id) ?? 0}
            series={computeMomentumSeries(myRow.user_id, snapshots)}
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
  vMe: number | null
  delta: number
  series: ReturnType<typeof computeMomentumSeries>
  onClick: () => void
  pinned?: boolean
}

const StandingsRow = memo(function StandingsRow({
  row, isMe, vMe, delta, series, onClick, pinned,
}: RowProps) {
  const rank = row.rank ?? 0
  const podiumClass =
    rank === 1 ? "text-[var(--tw-amber-text)]" :
    rank === 2 ? "text-[var(--tw-slate-text,_#94a3b8)]" :
    rank === 3 ? "text-[var(--tw-orange-text,_#fb923c)]" :
    "text-muted-foreground"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full grid grid-cols-[1.5rem_1fr_3.25rem_3rem_3.5rem_minmax(0,_3.5rem)] sm:grid-cols-[1.5rem_1fr_3.5rem_3rem_3.75rem_3.5rem] items-center gap-2 px-3 py-2 text-left transition-colors",
        isMe && !pinned && "bg-primary/10",
        isMe && "border-l-[3px] border-primary",
        !isMe && "hover:bg-overlay-subtle active:bg-overlay-muted",
        pinned && "bg-background",
      )}
    >
      <span className={cn("text-xs font-display font-bold tabular-nums", podiumClass)}>
        {row.rank ?? "—"}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAvatarColor(row.display_name))}>
          <span className="text-white text-[10px] font-semibold">{getInitials(row.display_name)}</span>
        </div>
        <div className="min-w-0">
          <p className={cn("text-[13px] truncate", isMe ? "font-semibold" : "font-medium")}>
            {row.display_name}
            {isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
          </p>
        </div>
      </div>

      <span className="text-[11px] text-muted-foreground truncate">
        {row.captain_short_name ?? "—"}
      </span>

      <span className="text-sm font-bold font-display tabular-nums text-right">
        {row.total_points}
      </span>

      <span className={cn(
        "text-[11px] tabular-nums text-right font-medium",
        vMe == null ? "text-muted-foreground/40" :
        vMe > 0 ? "text-[var(--tw-red-text)]" :
        vMe < 0 ? "text-[var(--tw-emerald-text)]" :
        "text-muted-foreground",
      )}>
        {vMe == null ? "—" : vMe > 0 ? `+${vMe}` : vMe < 0 ? `${vMe}` : "0"}
      </span>

      {/* Mobile: small Δ-rank arrow. Desktop: replaced with sparkline. */}
      <div className="text-right justify-self-end">
        <span className="hidden sm:inline-block text-muted-foreground">
          <MomentumSparkline series={series} width={48} height={16} />
        </span>
        <span className="inline sm:hidden">
          <RankDeltaBadge delta={delta} />
        </span>
      </div>
    </button>
  )
})

function RankDeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-[10px] text-muted-foreground/40">—</span>
  }
  const up = delta > 0
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
      up ? "text-[var(--tw-emerald-text)]" : "text-[var(--tw-red-text)]",
    )}>
      {up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {Math.abs(delta)}
    </span>
  )
}

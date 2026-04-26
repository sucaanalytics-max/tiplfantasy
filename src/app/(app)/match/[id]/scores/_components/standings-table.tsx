"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { computeMomentumSeries } from "@/lib/rivalry"
import { MomentumSparkline } from "./momentum-sparkline"

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
}

/**
 * League standings as a 2-line card per row:
 *   [#]  [avatar]  Display Name (you)            Pts
 *                  C: Captain · VC: VC           +12 ──╱
 *
 * - Full names always visible; long names wrap into the captain line area.
 * - Sparkline column reads from `match_score_snapshots` (always populated
 *   when ≥2 snapshots exist).
 * - "You" row pins to viewport bottom via IntersectionObserver when it
 *   scrolls offscreen.
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

      {/* Sticky-bottom "you" pin */}
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
  row, isMe, vMe, series, onClick, pinned,
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
        "w-full grid grid-cols-[1.75rem_2rem_1fr_auto] items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
        isMe && !pinned && "bg-primary/10",
        isMe && "border-l-[3px] border-primary",
        !isMe && "hover:bg-overlay-subtle active:bg-overlay-muted",
        pinned && "bg-background",
      )}
    >
      {/* Rank */}
      <span className={cn("text-sm font-display font-bold tabular-nums leading-tight pt-0.5", podiumClass)}>
        {row.rank ?? "—"}
      </span>

      {/* Avatar */}
      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-px", getAvatarColor(row.display_name))}>
        <span className="text-white text-[10px] font-semibold">{getInitials(row.display_name)}</span>
      </div>

      {/* Name + C/VC stack */}
      <div className="min-w-0">
        <p className={cn(
          "text-[13px] leading-tight break-words",
          isMe ? "font-semibold" : "font-medium",
        )}>
          {row.display_name}
          {isMe && <span className="text-primary text-[10px] ml-1 font-medium">(you)</span>}
        </p>
        <p className="text-[10px] leading-snug mt-1 text-muted-foreground break-words">
          {row.captain_name ? (
            <>
              <span className="text-muted-foreground/60">C:</span>{" "}
              <span className="text-foreground/80">{row.captain_name}</span>
            </>
          ) : (
            <span className="text-muted-foreground/40">No captain</span>
          )}
          {row.vc_name && (
            <>
              <span className="text-muted-foreground/40 mx-1">·</span>
              <span className="text-muted-foreground/60">VC:</span>{" "}
              <span className="text-foreground/80">{row.vc_name}</span>
            </>
          )}
        </p>
      </div>

      {/* Right column: pts + vMe + sparkline */}
      <div className="text-right shrink-0 flex flex-col items-end gap-0.5 min-w-[3.75rem]">
        <p className="text-base font-bold font-display tabular-nums leading-tight">
          {row.total_points}
        </p>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] tabular-nums font-medium leading-tight",
            vMe == null ? "text-muted-foreground/40" :
            vMe > 0 ? "text-[var(--tw-red-text)]" :
            vMe < 0 ? "text-[var(--tw-emerald-text)]" :
            "text-muted-foreground",
          )}>
            {vMe == null ? "—" : vMe > 0 ? `+${vMe}` : vMe < 0 ? `${vMe}` : "0"}
          </span>
          <MomentumSparkline series={series} width={32} height={12} />
        </div>
      </div>
    </button>
  )
})

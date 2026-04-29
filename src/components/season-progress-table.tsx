"use client"

import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"

export type ProgressRow = {
  userId: string
  displayName: string
  seasonRank: number
  matchScores: { matchNumber: number; points: number; isWinner: boolean }[]
}

interface Props {
  rows: ProgressRow[]
  currentUserId: string
  matchNumbers: number[]
  avgScore: number
}

export function SeasonProgressTable({ rows, currentUserId, matchNumbers, avgScore }: Props) {
  const maxScore = rows.length > 0
    ? Math.max(...rows.flatMap((r) => r.matchScores.map((s) => s.points)), 1)
    : 1

  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div className="px-4 py-2.5 border-b border-overlay-border bg-overlay-subtle">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Season Race</span>
      </div>

      <div className="overflow-x-auto scrollbar-hide" data-vaul-no-drag>
        <div style={{ minWidth: `${Math.max(320, 120 + matchNumbers.length * 44)}px` }}>
          {/* Match number headers */}
          <div
            className="grid items-center px-3 py-1.5 border-b border-overlay-border"
            style={{ gridTemplateColumns: `120px repeat(${matchNumbers.length}, 1fr)` }}
          >
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Player</span>
            {matchNumbers.map((mn) => (
              <span key={mn} className="text-[10px] text-muted-foreground text-center tabular-nums">M{mn}</span>
            ))}
          </div>

          {/* Rows */}
          {rows.map((row) => {
            const isMe = row.userId === currentUserId
            return (
              <div
                key={row.userId}
                className={cn(
                  "grid items-center px-3 py-2 border-b border-overlay-border last:border-0",
                  isMe && "shadow-[inset_2px_0_0_var(--primary)] bg-primary/[0.03]",
                )}
                style={{ gridTemplateColumns: `120px repeat(${matchNumbers.length}, 1fr)` }}
              >
                {/* Name */}
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0", getAvatarColor(row.displayName))}>
                    <span className="text-white text-[8px] font-bold">{getInitials(row.displayName)}</span>
                  </div>
                  <span className={cn("text-[11px] truncate", isMe ? "font-semibold text-primary" : "font-medium")}>
                    {row.displayName}
                  </span>
                </div>

                {/* Score bars per match */}
                {matchNumbers.map((mn) => {
                  const ms = row.matchScores.find((s) => s.matchNumber === mn)
                  if (!ms) {
                    return <div key={mn} className="h-10" />
                  }
                  const barPct = Math.min(ms.points / maxScore, 1)
                  const barH = Math.max(3, Math.round(barPct * 28))
                  const barColor = ms.isWinner
                    ? "bg-[var(--captain-gold)]"
                    : ms.points >= avgScore
                    ? "bg-primary/70"
                    : "bg-overlay-muted"
                  return (
                    <div key={mn} className="flex flex-col items-center justify-end h-10 gap-0.5">
                      <div
                        className={cn("w-3.5 rounded-sm", barColor)}
                        style={{ height: barH }}
                      />
                      <span className="text-[8px] tabular-nums text-muted-foreground leading-none">
                        {ms.points}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Legend */}
          <div className="flex items-center gap-4 px-3 py-2 border-t border-overlay-border bg-overlay-subtle">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[var(--captain-gold)]" />
              <span className="text-[10px] text-muted-foreground">Match winner</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary/70" />
              <span className="text-[10px] text-muted-foreground">Above avg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-overlay-muted" />
              <span className="text-[10px] text-muted-foreground">Below avg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

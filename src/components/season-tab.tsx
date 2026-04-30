"use client"

import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { FormStatsRow } from "@/lib/types"

interface Props {
  rows: FormStatsRow[]
  currentUserId: string
}

const FORM_CONFIG = {
  hot:     { label: "🔥 Hot",     className: "text-amber-500 bg-amber-500/10" },
  steady:  { label: "→ Steady",   className: "text-muted-foreground bg-overlay-subtle" },
  cooling: { label: "📉 Cooling", className: "text-blue-400 bg-blue-400/10" },
}

export function SeasonTab({ rows, currentUserId }: Props) {
  // Sort by current_rank
  const sorted = [...rows].sort((a, b) => a.current_rank - b.current_rank)
  const leader = sorted[0]

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-muted-foreground">
        Form = last 5 match average vs season average.
        🔥 Hot: last-5 avg &gt; season avg by 20+ pts · 📉 Cooling: last-5 avg &lt; season avg by 20+ pts.
      </p>

      {sorted.map((row) => {
        const isMe = row.user_id === currentUserId
        const ptsFromLeader = row.user_id === leader.user_id ? null : row.total_points - leader.total_points
        const formCfg = FORM_CONFIG[row.form]

        return (
          <div
            key={row.user_id}
            className={cn(
              "glass rounded-2xl p-4 space-y-3",
              isMe && "ring-1 ring-primary/30"
            )}
          >
            {/* Header row */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground w-5 tabular-nums">{row.current_rank}</span>
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold", getAvatarColor(row.display_name))}>
                {getInitials(row.display_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", isMe && "text-primary")}>
                  {row.display_name}{isMe && " (you)"}
                </p>
                {ptsFromLeader !== null && (
                  <p className="text-[10px] text-rose-400/80 tabular-nums">
                    −{Math.abs(ptsFromLeader).toLocaleString()} pts from 1st
                  </p>
                )}
              </div>
              <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full", formCfg.className)}>
                {formCfg.label}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[
                { label: "Season Avg", value: Math.round(row.season_avg).toLocaleString() },
                { label: "Last 5 Avg", value: Math.round(row.last5_avg).toLocaleString(), highlight: true },
                { label: "Consistency σ", value: Math.round(row.consistency_stddev).toLocaleString() },
                { label: "Total Pts", value: row.total_points.toLocaleString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-overlay-subtle px-2.5 py-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className={cn("text-sm font-bold tabular-nums mt-0.5", stat.highlight ? "text-gold-stat" : "text-foreground")}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Last 5 scores row */}
            {row.last5_scores.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground shrink-0">Last 5:</span>
                <div className="flex gap-1">
                  {row.last5_scores.map((score, i) => (
                    <span
                      key={i}
                      className={cn(
                        "text-[10px] tabular-nums px-1.5 py-0.5 rounded",
                        score >= 90 ? "bg-amber-500/20 text-amber-500" :
                        score >= 70 ? "bg-primary/15 text-primary" :
                        "bg-overlay-subtle text-muted-foreground"
                      )}
                    >
                      {score}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

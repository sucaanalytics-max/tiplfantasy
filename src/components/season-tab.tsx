"use client"

import { useState, useMemo } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { FormStatsRow } from "@/lib/types"

interface Props {
  rows: FormStatsRow[]
  currentUserId: string
}

type SortKey = "rank" | "avg" | "last5" | "sigma" | "total"
type SortDir = "asc" | "desc"

const FORM_CONFIG = {
  hot:     { label: "🔥", title: "Hot",     className: "text-amber-500" },
  steady:  { label: "→",  title: "Steady",  className: "text-muted-foreground" },
  cooling: { label: "📉", title: "Cooling", className: "text-blue-400" },
}

export function SeasonTab({ rows, currentUserId }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" })

  const sorted = useMemo(() => {
    const list = [...rows]
    const dir = sort.dir === "asc" ? 1 : -1
    list.sort((a, b) => {
      switch (sort.key) {
        case "rank":  return (a.current_rank - b.current_rank) * dir
        case "avg":   return (a.season_avg - b.season_avg) * dir
        case "last5": return (a.last5_avg - b.last5_avg) * dir
        case "sigma": return (a.consistency_stddev - b.consistency_stddev) * dir
        case "total": return (a.total_points - b.total_points) * dir
      }
    })
    return list
  }, [rows, sort])

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key !== key
        ? { key, dir: key === "rank" || key === "sigma" ? "asc" : "desc" }
        : { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    )
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[28px_32px_1fr_28px_3rem_3rem_3rem_5.5rem] gap-x-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium bg-overlay-subtle items-center">
        <SortHdr label="#"   skey="rank"  sort={sort} onSort={toggleSort} align="center" />
        <span />
        <span>Player</span>
        <span className="text-center">Form</span>
        <SortHdr label="Avg" skey="avg"   sort={sort} onSort={toggleSort} align="right" hide="md" />
        <SortHdr label="L5"  skey="last5" sort={sort} onSort={toggleSort} align="right" />
        <SortHdr label="σ"   skey="sigma" sort={sort} onSort={toggleSort} align="right" hide="md" />
        <SortHdr label="Pts" skey="total" sort={sort} onSort={toggleSort} align="right" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-overlay-border">
        {sorted.map((row) => {
          const isMe = row.user_id === currentUserId
          const formCfg = FORM_CONFIG[row.form]
          return (
            <div
              key={row.user_id}
              className={cn(
                "grid grid-cols-[28px_32px_1fr_28px_3rem_3rem_3rem_5.5rem] gap-x-3 px-4 py-3 items-center transition-colors",
                isMe && "row-highlight-you"
              )}
            >
              {/* Rank */}
              <span className="text-sm font-semibold text-muted-foreground tabular-nums text-center">{row.current_rank}</span>

              {/* Avatar */}
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold", getAvatarColor(row.display_name))}>
                {getInitials(row.display_name)}
              </div>

              {/* Name + last 5 score chips */}
              <div className="min-w-0">
                <p className={cn("text-sm truncate", isMe && "font-semibold")}>
                  {row.display_name}{isMe && " (you)"}
                </p>
                {row.last5_scores.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {row.last5_scores.map((s, i) => (
                      <span
                        key={i}
                        className={cn(
                          "text-[9px] tabular-nums px-1 py-px rounded",
                          s >= 90 ? "bg-amber-500/20 text-amber-500" :
                          s >= 70 ? "bg-primary/15 text-primary" :
                          "bg-overlay-subtle text-muted-foreground"
                        )}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Form icon */}
              <span className={cn("text-base text-center", formCfg.className)} title={formCfg.title}>
                {formCfg.label}
              </span>

              {/* Season avg */}
              <span className="hidden md:block text-right tabular-nums text-xs text-muted-foreground">
                {Math.round(row.season_avg)}
              </span>

              {/* Last-5 avg — coloured by form */}
              <span className={cn(
                "text-right tabular-nums text-xs font-semibold",
                row.form === "hot" ? "text-amber-500" :
                row.form === "cooling" ? "text-blue-400" :
                "text-foreground/80"
              )}>
                {Math.round(row.last5_avg)}
              </span>

              {/* Consistency σ */}
              <span className="hidden md:block text-right tabular-nums text-xs text-muted-foreground">
                {Math.round(row.consistency_stddev)}
              </span>

              {/* Total pts */}
              <span className="text-gold-stat text-base text-right tabular-nums">
                {row.total_points.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SortHdr({
  label, skey, sort, onSort, align = "left", hide,
}: {
  label: string
  skey: SortKey
  sort: { key: SortKey; dir: SortDir }
  onSort: (k: SortKey) => void
  align?: "left" | "right" | "center"
  hide?: "md"
}) {
  const active = sort.key === skey
  const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  const hideClass = hide === "md" ? "hidden md:flex" : "flex"
  return (
    <button
      type="button"
      onClick={() => onSort(skey)}
      className={cn(
        "items-center gap-0.5 transition-colors tabular-nums",
        hideClass, alignClass,
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {active && (sort.dir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
    </button>
  )
}

"use client"

import { useState, useMemo } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { Crown } from "@/components/icons/cricket-icons"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { cn } from "@/lib/utils"

export interface LeaderboardRow {
  user_id: string
  display_name: string
  season_rank: number
  total_points: number
  avg_points: number
  matches_played: number
  highest_score: number
  matchday_wins: number
}

type SortKey = "rank" | "total" | "avg" | "wins" | "highest"
type SortDir = "asc" | "desc"

interface Props {
  rows: LeaderboardRow[]
  currentUserId: string
  /** Last-5 match scores per row, indexed same as rows. Each inner array is scores most-recent-last. */
  formGuide?: number[][]
}

export function LeaderboardTable({ rows, currentUserId, formGuide }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" })

  const sortedRows = useMemo(() => {
    const list = [...rows]
    const dir = sort.dir === "asc" ? 1 : -1
    list.sort((a, b) => {
      switch (sort.key) {
        case "rank":
          return (a.season_rank - b.season_rank) * dir
        case "total":
          return (Number(a.total_points) - Number(b.total_points)) * dir
        case "avg":
          return (Number(a.avg_points) - Number(b.avg_points)) * dir
        case "wins":
          return (a.matchday_wins - b.matchday_wins) * dir
        case "highest":
          return (Number(a.highest_score) - Number(b.highest_score)) * dir
      }
    })
    return list
  }, [rows, sort])

  const leaderPoints = rows.length > 0
    ? Math.max(...rows.map((r) => Number(r.total_points)))
    : 0

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) {
        // New column — pick a sensible default direction
        return { key, dir: key === "rank" ? "asc" : "desc" }
      }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    })
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header row — sortable */}
      <div className={cn(formGuide ? "leaderboard-grid--form" : "leaderboard-grid", "px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium bg-overlay-subtle")}>
        <SortHeader label="#" active={sort.key === "rank"} dir={sort.dir} onClick={() => toggleSort("rank")} align="center" />
        <span />
        <span>Player</span>
        <SortHeader label="W" active={sort.key === "wins"} dir={sort.dir} onClick={() => toggleSort("wins")} align="right" hide="lg" />
        <SortHeader label="Hi" active={sort.key === "highest"} dir={sort.dir} onClick={() => toggleSort("highest")} align="right" hide="lg" />
        <SortHeader label="Avg" active={sort.key === "avg"} dir={sort.dir} onClick={() => toggleSort("avg")} align="right" hide="md" />
        {formGuide && <span className="hidden md:block text-right">Form</span>}
        <SortHeader label="Pts" active={sort.key === "total"} dir={sort.dir} onClick={() => toggleSort("total")} align="right" />
        <span className="text-right">Gap</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-overlay-border">
        {sortedRows.map((row, sortedIdx) => {
          const isMe = row.user_id === currentUserId
          const gap = row.season_rank === 1 || leaderPoints === 0
            ? null
            : Number(row.total_points) - leaderPoints

          // Resolve form guide for this user by matching user_id
          const userForm = formGuide
            ? formGuide[rows.findIndex((r) => r.user_id === row.user_id)]
            : undefined

          return (
            <div
              key={row.user_id}
              className={cn(
                formGuide ? "leaderboard-grid--form" : "leaderboard-grid",
                "px-4 py-3 transition-colors",
                isMe && "row-highlight-you"
              )}
            >
              {/* Rank */}
              <div className="flex items-center justify-center">
                {row.season_rank === 1 ? (
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-accent text-accent-foreground ring-2 ring-accent shadow-[0_0_12px_oklch(0.78_0.17_86/0.4)]">
                    <Crown className="h-3.5 w-3.5" />
                  </span>
                ) : row.season_rank === 2 ? (
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[oklch(0.72_0.01_260)] text-foreground/90 font-display font-bold text-xs ring-2 ring-[oklch(0.72_0.01_260)] shadow-sm">
                    2
                  </span>
                ) : row.season_rank === 3 ? (
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[oklch(0.63_0.10_55)] text-white font-display font-bold text-xs ring-2 ring-[oklch(0.63_0.10_55)] shadow-sm">
                    3
                  </span>
                ) : (
                  <span className="font-display font-semibold text-sm text-muted-foreground tabular-nums">
                    {row.season_rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", getAvatarColor(row.display_name))}>
                <span className="text-white text-xs font-semibold">{getInitials(row.display_name)}</span>
              </div>

              {/* Name */}
              <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                {row.display_name}
                {isMe && " (you)"}
              </span>

              {/* Wins */}
              <span className="hidden lg:block text-right tabular-nums text-xs text-foreground/80 font-medium">
                {row.matchday_wins}
              </span>

              {/* Highest */}
              <span className="hidden lg:block text-right tabular-nums text-xs text-muted-foreground">
                {Math.round(Number(row.highest_score))}
              </span>

              {/* Avg */}
              <span className="hidden md:block text-right tabular-nums text-xs text-muted-foreground">
                {Number(row.avg_points).toFixed(0)}
              </span>

              {/* Form guide */}
              {formGuide && (
                <div className="hidden md:flex items-center justify-end gap-0.5">
                  {(userForm ?? [null, null, null, null, null]).slice(-5).map((score, i) => {
                    const pct = score != null && row.highest_score > 0
                      ? score / Number(row.highest_score)
                      : null
                    return (
                      <div
                        key={i}
                        className={cn(
                          "w-[7px] h-[7px] rounded-[2px]",
                          pct == null ? "bg-overlay-muted/40" :
                          pct > 0.8 ? "bg-[var(--captain-gold)]" :
                          pct > 0.5 ? "bg-primary/70" :
                          "bg-overlay-muted"
                        )}
                      />
                    )
                  })}
                </div>
              )}

              {/* Pts (gold) */}
              <span className="text-gold-stat text-base text-right">
                {Number(row.total_points).toLocaleString()}
              </span>

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
        })}
      </div>
    </div>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
  hide,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: "left" | "right" | "center"
  hide?: "md" | "lg"
}) {
  const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  const hideClass = hide === "md" ? "hidden md:flex" : hide === "lg" ? "hidden lg:flex" : "flex"
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "items-center gap-0.5 tabular-nums transition-colors",
        hideClass,
        alignClass,
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {active && (dir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
    </button>
  )
}

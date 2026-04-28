"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { cn, formatIST } from "@/lib/utils"
import { TeamBadge } from "@/components/team-badge"
import { RankBadge } from "@/components/rank-badge"

export type MatchHistoryRow = {
  id: string
  matchId: string
  matchNumber: number
  startTime: string
  rank: number | null
  totalPoints: number
  homeShortName: string
  homeColor: string
  homeLogoUrl: string | null
  awayShortName: string
  awayColor: string
  awayLogoUrl: string | null
  captainName: string | null
  vcName: string | null
}

type SortKey = "matchNumber" | "rank" | "totalPoints"
type SortDir = "asc" | "desc"

/**
 * Replaces the old Performance sparkline + Rank Distribution histogram
 * with a single sortable table. Default sort: most recent match first
 * (descending matchNumber).
 *
 * Columns: # · Match · Date · Rank · Pts · C / VC
 */
export function MatchHistoryTable({ rows }: { rows: MatchHistoryRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("matchNumber")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = useMemo(() => {
    const copy = [...rows]
    const dir = sortDir === "asc" ? 1 : -1
    copy.sort((a, b) => {
      switch (sortKey) {
        case "matchNumber": return (a.matchNumber - b.matchNumber) * dir
        case "totalPoints": return (a.totalPoints - b.totalPoints) * dir
        case "rank": {
          const ar = a.rank ?? 999
          const br = b.rank ?? 999
          return (ar - br) * dir
        }
      }
    })
    return copy
  }, [rows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Most-recent-first / best-rank-first / highest-pts-first as defaults
      setSortDir(key === "rank" ? "asc" : "desc")
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No matches yet.</p>
  }

  return (
    <div className="rounded-2xl border border-overlay-border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2.2rem_1fr_3.8rem_2.5rem_2.8rem] md:grid-cols-[2.2rem_1fr_4.5rem_2.8rem_3rem_1fr] gap-2 items-center px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground border-b border-overlay-border bg-overlay-subtle">
        <SortHeader label="#" k="matchNumber" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="left" />
        <span>Match</span>
        <span className="hidden md:block">Date</span>
        <SortHeader label="Rank" k="rank" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
        <SortHeader label="Pts" k="totalPoints" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
        <span className="hidden md:block">C / VC</span>
      </div>

      <div className="divide-y divide-overlay-border">
        {sorted.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[2.2rem_1fr_3.8rem_2.5rem_2.8rem] md:grid-cols-[2.2rem_1fr_4.5rem_2.8rem_3rem_1fr] gap-2 items-center px-3 py-2.5 text-sm"
          >
            {/* # */}
            <span className="text-muted-foreground tabular-nums font-mono text-xs">
              {row.matchNumber}
            </span>

            {/* Match — team badges + vs */}
            <div className="flex items-center gap-1.5 min-w-0">
              <TeamBadge shortName={row.homeShortName} color={row.homeColor} logoUrl={row.homeLogoUrl} size="sm" />
              <span className="text-[10px] text-muted-foreground/60">vs</span>
              <TeamBadge shortName={row.awayShortName} color={row.awayColor} logoUrl={row.awayLogoUrl} size="sm" />
            </div>

            {/* Date — desktop only */}
            <span className="hidden md:block text-xs text-muted-foreground">
              {formatIST(row.startTime, "MMM d")}
            </span>

            {/* Rank */}
            <span className="text-right">
              <RankBadge rank={row.rank ?? 999} size="sm" />
            </span>

            {/* Pts */}
            <span className="text-right text-gold-stat text-base leading-none">
              {row.totalPoints}
            </span>

            {/* C / VC — desktop only */}
            <span className="hidden md:flex md:items-center md:gap-2 text-[11px] text-muted-foreground truncate">
              {row.captainName && (
                <span className="truncate"><span className="text-[var(--captain-gold)] font-bold">C</span> {row.captainName}</span>
              )}
              {row.vcName && (
                <span className="truncate"><span className="text-foreground/70 font-bold">VC</span> {row.vcName}</span>
              )}
            </span>

            {/* Mobile: C / VC shown inline below as a sub-row */}
            {(row.captainName || row.vcName) && (
              <span className="md:hidden col-span-5 -mt-1 ml-[3rem] text-[10px] text-muted-foreground flex items-center gap-2 truncate">
                {row.captainName && <span className="truncate"><span className="text-[var(--captain-gold)] font-bold">C</span> {row.captainName}</span>}
                {row.vcName && <span className="truncate"><span className="text-foreground/70 font-bold">VC</span> {row.vcName}</span>}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SortHeader({
  label, k, sortKey, sortDir, onClick, align,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: (k: SortKey) => void
  align: "left" | "right"
}) {
  const active = sortKey === k
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className={cn(
        "inline-flex items-center gap-0.5 transition-colors",
        active ? "text-foreground" : "hover:text-foreground",
        align === "right" && "justify-end ml-auto",
      )}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="uppercase tracking-widest">{label}</span>
      <Icon className="h-2.5 w-2.5 opacity-60" />
    </button>
  )
}

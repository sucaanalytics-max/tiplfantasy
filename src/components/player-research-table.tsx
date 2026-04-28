"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlayerHeadshot } from "@/components/player-headshot"
import { Badge } from "@/components/ui/badge"
import { ROLE_COLORS } from "@/lib/badges"
import type { PlayerWithTeam, PlayerRole, TiplMatchEntry } from "@/lib/types"

type SortKey = "name" | "role" | "avg" | "total" | "credit" | "selection"
type SortDir = "asc" | "desc"

type Props = {
  players: PlayerWithTeam[]
  /** Same shape as in pick-team-client: per-player array of TIPL match entries. */
  tiplMatchLog: Record<string, TiplMatchEntry[]>
  selectionPcts: Record<string, number>
  playingXIIds: string[]
  /** Set of currently selected player ids — driver of the +/✓ button state. */
  selectedIds: Set<string>
  /** Toggle a player in/out of the selection. The parent enforces composition rules. */
  onToggle: (playerId: string) => void
  /** Open the player stats drawer (shared with PlayerCardPremium). */
  onShowStats: (playerId: string) => void
  /** Whether each player can be added without violating composition. Same logic as pick-team-client. */
  getDisabledReason: (player: PlayerWithTeam) => string | null
  /** When true, render an extra "XI" status column. */
  hasPlayingXI: boolean
}

const ROLE_RANK: Record<PlayerRole, number> = { WK: 0, BAT: 1, AR: 2, BOWL: 3 }

/**
 * Sortable, dense table of all candidate players. Inspired by HowZat's
 * "Player Research" view but stripped of money/contests. Used as the
 * third tab on the pick screen alongside List and Pitch.
 *
 * Columns (mobile-first, hides credit + selection % below md):
 *   Player · Role · Avg · Total · Last · Cr · Sel% · Add
 *
 * Last is rendered as a unicode block sparkline of recent fantasy
 * scores — qualifies as a tabular status column, not a chart.
 */
export function PlayerResearchTable({
  players,
  tiplMatchLog,
  selectionPcts,
  playingXIIds,
  selectedIds,
  onToggle,
  onShowStats,
  getDisabledReason,
  hasPlayingXI,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("avg")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const xiSet = useMemo(() => new Set(playingXIIds), [playingXIIds])

  const rows = useMemo(() => {
    const enriched = players.map((p) => {
      const log = tiplMatchLog[p.id] ?? []
      const total = log.reduce((s, e) => s + e.fantasyPoints, 0)
      const avg = log.length > 0 ? Math.round(total / log.length) : null
      const lastFive = log.slice(-5).map((e) => e.fantasyPoints)
      return {
        player: p,
        avg,
        total,
        last5: lastFive,
        sel: selectionPcts[p.id] ?? 0,
      }
    })

    enriched.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortKey) {
        case "name": return a.player.name.localeCompare(b.player.name) * dir
        case "role": return (ROLE_RANK[a.player.role] - ROLE_RANK[b.player.role]) * dir
        case "credit": return (a.player.credit_cost - b.player.credit_cost) * dir
        case "selection": return (a.sel - b.sel) * dir
        case "total": return (a.total - b.total) * dir
        case "avg":
        default: {
          // Nulls sort last regardless of direction
          if (a.avg == null && b.avg == null) return 0
          if (a.avg == null) return 1
          if (b.avg == null) return -1
          return (a.avg - b.avg) * dir
        }
      }
    })

    return enriched
  }, [players, tiplMatchLog, selectionPcts, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Sensible defaults: text asc, numbers desc
      setSortDir(key === "name" || key === "role" ? "asc" : "desc")
    }
  }

  return (
    <div className="rounded-xl border border-overlay-border overflow-hidden bg-card">
      {/* Header */}
      <div className="grid grid-cols-[1.5rem_2.5rem_1fr_2.2rem_2.5rem_3.5rem_2rem_1.8rem] md:grid-cols-[1.5rem_2.5rem_1fr_2.2rem_2.8rem_2.8rem_3.5rem_2rem_1.8rem_1.8rem] gap-1 items-center px-2.5 py-2 text-[9px] uppercase tracking-widest font-semibold text-muted-foreground border-b border-overlay-border bg-overlay-subtle">
        <span aria-hidden />
        <span aria-hidden />
        <SortHeader label="Player" k="name" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="left" />
        <SortHeader label="Role" k="role" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="center" />
        <SortHeader label="Avg" k="avg" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
        <span className="text-right hidden md:block">
          <SortHeader label="Tot" k="total" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
        </span>
        <span className="text-right hidden md:block">Last 5</span>
        <SortHeader label="Cr" k="credit" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
        <SortHeader label="Sel%" k="selection" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
        <span aria-hidden />
      </div>

      {/* Rows */}
      <div className="divide-y divide-overlay-border">
        {rows.map(({ player, avg, total, last5, sel }) => {
          const disabledReason = getDisabledReason(player)
          const isDisabled = !!disabledReason
          const isSelected = selectedIds.has(player.id)
          const isInXI = xiSet.has(player.id)
          const lastNum = last5.length > 0 ? last5[last5.length - 1] : null

          return (
            <div
              key={player.id}
              className={cn(
                "grid grid-cols-[1.5rem_2.5rem_1fr_2.2rem_2.5rem_3.5rem_2rem_1.8rem] md:grid-cols-[1.5rem_2.5rem_1fr_2.2rem_2.8rem_2.8rem_3.5rem_2rem_1.8rem_1.8rem] gap-1 items-center px-2.5 py-1.5 transition-colors text-sm",
                isSelected && "bg-primary/[0.06]",
                isDisabled && "opacity-40",
                hasPlayingXI && !isInXI && "opacity-50",
              )}
            >
              {/* XI status */}
              <span className="text-center text-[9px] font-bold tabular-nums">
                {hasPlayingXI ? (
                  isInXI ? <span className="text-status-success">✓</span> : <span className="text-muted-foreground/40">·</span>
                ) : (
                  <span className="text-muted-foreground/40">?</span>
                )}
              </span>

              {/* Headshot — clickable for stats */}
              <button
                type="button"
                onClick={() => onShowStats(player.id)}
                className="shrink-0"
                aria-label={`View ${player.name} stats`}
              >
                <PlayerHeadshot player={player} size="sm" ring="team" />
              </button>

              {/* Name + team */}
              <button
                type="button"
                onClick={() => onShowStats(player.id)}
                className="min-w-0 text-left"
              >
                <div className="truncate font-medium text-[13px] leading-tight">{player.name}</div>
                <div className="text-[10px] uppercase tracking-wider truncate" style={{ color: player.team.color }}>
                  {player.team.short_name}
                </div>
              </button>

              {/* Role badge */}
              <div className="text-center">
                <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] leading-none", ROLE_COLORS[player.role])}>
                  {player.role}
                </Badge>
              </div>

              {/* Avg */}
              <span className="text-right font-display font-bold tabular-nums text-gold-stat text-sm leading-none">
                {avg ?? <span className="text-muted-foreground/40">—</span>}
              </span>

              {/* Total — desktop only */}
              <span className="text-right tabular-nums text-xs text-muted-foreground hidden md:block">
                {total > 0 ? total : "—"}
              </span>

              {/* Last 5 sparkline + numeric — desktop only */}
              <span className="text-right tabular-nums text-xs hidden md:flex md:items-baseline md:justify-end md:gap-1">
                <Sparkline values={last5} />
                <span className="text-foreground font-display font-semibold w-5 text-right">
                  {lastNum ?? "—"}
                </span>
              </span>

              {/* Credit */}
              <span className="text-right tabular-nums text-xs text-muted-foreground">
                {player.credit_cost.toFixed(1)}
              </span>

              {/* Selection % */}
              <span className="text-right tabular-nums text-[11px] text-muted-foreground">
                {sel > 0 ? `${sel}%` : "—"}
              </span>

              {/* Quick row info on mobile (sparkline shown inline below if needed) */}
              <span className="hidden md:block" />

              {/* Toggle */}
              <button
                type="button"
                onClick={() => { if (!isDisabled) onToggle(player.id) }}
                disabled={isDisabled}
                aria-label={isSelected ? `Deselect ${player.name}` : `Select ${player.name}`}
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all justify-self-end shrink-0",
                  isSelected
                    ? "bg-primary border-primary text-white"
                    : isDisabled
                    ? "border-border/30 text-muted-foreground/30 cursor-not-allowed"
                    : "border-overlay-border-hover text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : "+"}
              </button>
            </div>
          )
        })}

        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No players match the filters</div>
        )}
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
  align: "left" | "center" | "right"
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
        align === "center" && "justify-center mx-auto",
      )}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="uppercase tracking-widest">{label}</span>
      <Icon className="h-2.5 w-2.5 opacity-60" />
    </button>
  )
}

/** Compact 5-block sparkline using unicode block characters. Counts as
 *  a tabular column, not a chart, per project preference. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return <span className="text-muted-foreground/40">—</span>
  const max = Math.max(...values, 1)
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
  return (
    <span className="font-mono text-[12px] leading-none text-muted-foreground tracking-tighter">
      {values.map((v, i) => {
        const ratio = Math.max(0, v) / max
        const idx = Math.min(blocks.length - 1, Math.floor(ratio * blocks.length))
        return <span key={i}>{blocks[idx]}</span>
      })}
    </span>
  )
}

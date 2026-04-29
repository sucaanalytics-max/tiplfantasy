"use client"

import { Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlayerHeadshot } from "@/components/player-headshot"
import { CaptainOverlay } from "@/components/captain-overlay"
import { FormIcon } from "@/components/form-icon"
import type { PlayerWithTeam, PlayerRole } from "@/lib/types"

const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "Wicket-keeper",
  BAT: "Batsman",
  AR: "All-rounder",
  BOWL: "Bowler",
}

const ROLE_RING_CLS: Record<PlayerRole, string> = {
  WK: "ring-role-wk",
  BAT: "ring-role-bat",
  AR: "ring-role-ar",
  BOWL: "ring-role-bowl",
}

type Props = {
  player: PlayerWithTeam
  isSelected: boolean
  isCaptain: boolean
  isVC: boolean
  isInXI: boolean
  hasPlayingXI: boolean
  isDisabled: boolean
  disabledReason: string | null
  /** Cumulative TIPL fantasy points across the season for this player. */
  totalPts: number | null
  /** Average per match. */
  avgPts: number | null
  /** Last match points. */
  lastPts: number | null
  /** Selection % among all users so far. */
  selectionPct: number
  onToggle: () => void
  onShowStats: () => void
}

/**
 * Premium pick-screen player card.
 *
 * Replaces the legacy 9-column desktop "row" and the 2-column mobile card
 * with a single unified card. Used in a 2-col grid on both mobile and
 * desktop — left column = home team, right column = away team.
 *
 * Visual hierarchy:
 *   1. 56–64px team-ring headshot with role-tinted backing + C/VC overlay
 *   2. Player name (display font) + team + role + form indicator
 *   3. Stat tiles (Rajdhani): TOT · AVG · LAST · CR
 *   4. Toggle button (top-right): + when unselected, ✓ when selected
 *
 * The whole card surface (except the toggle button itself) is the stats
 * trigger so users can tap the headshot, name, or stats area to inspect.
 */
export function PlayerCardPremium({
  player,
  isSelected,
  isCaptain,
  isVC,
  isInXI,
  hasPlayingXI,
  isDisabled,
  disabledReason,
  totalPts,
  avgPts,
  lastPts,
  selectionPct,
  onToggle,
  onShowStats,
}: Props) {
  const role = player.role as PlayerRole

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card overflow-hidden transition-all",
        "stripe-team-left", // 4px team-color stripe via --team-color
        // Selected state — "weighty" cinematic feel: team-color rim glow,
        // subtle scale lift, deeper shadow. Deselected falls back to the
        // base card with hover affordance.
        isSelected
          ? "border-transparent team-color-rim scale-[1.015] shadow-headshot z-[1]"
          : "border-overlay-border shadow-[0_1px_3px_oklch(0_0_0/0.04)] hover:border-overlay-border-hover",
        isDisabled && "opacity-40",
        hasPlayingXI && !isInXI && "opacity-50"
      )}
      style={{ "--team-color": player.team.color } as React.CSSProperties}
    >
      {/* Captain / Vice-captain overlay (top-right corner of the card itself) */}
      {(isCaptain || isVC) && (
        <CaptainOverlay variant={isCaptain ? "captain" : "vice"} size="md" position="tl" />
      )}

      <div className="p-3 pl-4 flex flex-col gap-2.5">
        {/* Top row: headshot + name/meta (toggle is absolute) */}
        <div className="flex items-start gap-2 pr-9">
          {/* Headshot — clicking opens stats drawer */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onShowStats()
            }}
            className={cn(
              "shrink-0 rounded-full transition-transform",
              !isDisabled && "hover:scale-105"
            )}
            aria-label={`View ${player.name} stats`}
          >
            <PlayerHeadshot
              player={player}
              size="md"
              ring="team"
              shadow
              className={cn(ROLE_RING_CLS[role])}
            />
          </button>

          {/* Name + team + role */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onShowStats()
            }}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display font-bold text-[15px] leading-tight line-clamp-2 break-words">
                {player.name}
              </span>
              <FormIcon indicator={player.form_indicator} />
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
              <span
                className="font-display font-semibold uppercase tracking-wider"
                style={{ color: player.team.color }}
              >
                {player.team.short_name}
              </span>
              <span className="text-muted-foreground/40 mx-1">·</span>
              <span className="uppercase tracking-wider">{ROLE_LABELS[role]}</span>
              {hasPlayingXI && isInXI && (
                <>
                  <span className="text-muted-foreground/40 mx-1">·</span>
                  <span className="font-bold text-status-success">XI</span>
                </>
              )}
            </p>
          </button>
        </div>

        {/* Toggle button — absolute top-right so it doesn't consume name space */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (!isDisabled) onToggle()
          }}
          disabled={isDisabled}
          aria-label={isSelected ? `Deselect ${player.name}` : `Select ${player.name}`}
          className={cn(
            "absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
            isSelected
              ? "bg-primary border-primary text-white shadow-md shadow-primary/25"
              : isDisabled
              ? "border-border/30 text-muted-foreground/30 cursor-not-allowed"
              : "border-overlay-border-hover text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
          )}
        >
          {isSelected ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
        </button>

        {/* Stat tiles row */}
        <div className="grid grid-cols-4 gap-1.5">
          <StatTile label="Tot" value={totalPts} accent />
          <StatTile label="Avg" value={avgPts} />
          <StatTile label="Last" value={lastPts} />
          <StatTile label="Cr" value={player.credit_cost} />
        </div>

        {/* Footer: selection % + disabled reason */}
        {(selectionPct > 0 || isDisabled) && (
          <div className="flex items-center justify-between gap-2 -mt-1">
            {selectionPct > 0 ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                Picked by <span className="font-display font-bold text-foreground">{selectionPct}%</span>
              </span>
            ) : (
              <span />
            )}
            {isDisabled && disabledReason && (
              <span className="text-[10px] text-status-danger truncate text-right">
                {disabledReason}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  const display = value == null ? "—" : value
  const isMissing = value == null
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md py-1 bg-overlay-subtle border border-overlay-border",
        isMissing && "opacity-60"
      )}
    >
      <span
        className={cn(
          "font-display font-bold tabular-nums leading-none",
          accent && !isMissing ? "text-gold-stat text-base" : "text-foreground text-sm",
          isMissing && "text-muted-foreground/50"
        )}
      >
        {display}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 mt-0.5">
        {label}
      </span>
    </div>
  )
}

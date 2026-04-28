"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlayerHeadshot } from "@/components/player-headshot"
import { CaptainOverlay } from "@/components/captain-overlay"
import type { PlayerWithTeam, PlayerRole } from "@/lib/types"

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]
const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "Wicket-keepers",
  BAT: "Batters",
  AR: "All-rounders",
  BOWL: "Bowlers",
}

type Props = {
  /** The user's currently selected XI (sub-set of candidates). */
  selectedPlayers: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
  /** Total slot count — defaults to 11. Empty slots shown when below this. */
  totalSlots?: number
  /** Click any player chip → invoked with that player. Open an action menu
   *  (set C / set VC / remove) in the parent. */
  onPlayerClick?: (player: PlayerWithTeam) => void
  /** Quick-remove via the X button on each chip (skips the action menu). */
  onRemove?: (playerId: string) => void
  /** Optional click target shown in empty slots (e.g. opens List mode). */
  onEmptyClick?: () => void
}

/**
 * In-pick pitch visualization. Shows the user's current selected XI laid
 * out by role on an oval cricket field. Interactive — taps invoke
 * onPlayerClick so the parent can present a swap / assign-C / assign-VC
 * action sheet.
 *
 * Replaces the small read-only <CricketField/> for the pick experience.
 * The submit-flow preview still uses CricketField (smaller, non-interactive).
 */
export function PitchView({
  selectedPlayers,
  captainId,
  viceCaptainId,
  totalSlots = 11,
  onPlayerClick,
  onRemove,
  onEmptyClick,
}: Props) {
  const grouped: Record<PlayerRole, PlayerWithTeam[]> = {
    WK: selectedPlayers.filter((p) => p.role === "WK"),
    BAT: selectedPlayers.filter((p) => p.role === "BAT"),
    AR: selectedPlayers.filter((p) => p.role === "AR"),
    BOWL: selectedPlayers.filter((p) => p.role === "BOWL"),
  }
  const empty = Math.max(0, totalSlots - selectedPlayers.length)

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Pitch — an inset oval with a stripe down the middle.
          Field stays green in both themes so the metaphor reads. */}
      <div
        className="relative aspect-[3/4] rounded-[42%/30%] overflow-hidden border border-emerald-800/30"
        style={{
          background:
            "radial-gradient(ellipse 110% 70% at 50% 35%, oklch(0.55 0.13 145) 0%, oklch(0.42 0.13 150) 60%, oklch(0.32 0.10 150) 100%)",
          boxShadow:
            "inset 0 0 80px oklch(0 0 0 / 0.30), inset 0 -20px 60px oklch(0 0 0 / 0.20)",
        }}
      >
        {/* Center pitch strip */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-32 rounded-sm"
          style={{
            background:
              "linear-gradient(to bottom, oklch(0.78 0.10 75 / 0.35), oklch(0.62 0.10 75 / 0.30))",
          }}
        />
        {/* Crease lines */}
        <div className="absolute left-1/2 top-[calc(50%-3.5rem)] -translate-x-1/2 h-px w-16 bg-white/35" />
        <div className="absolute left-1/2 top-[calc(50%+3.5rem)] -translate-x-1/2 h-px w-16 bg-white/35" />
        {/* Boundary ring */}
        <div className="absolute inset-3 rounded-[42%/30%] border border-white/15 pointer-events-none" />

        {/* Role rows — vertical stack from WK at top to BOWL at bottom. */}
        <div className="absolute inset-0 flex flex-col justify-around py-6 px-4 gap-1">
          {ROLE_ORDER.map((role) => {
            const players = grouped[role]
            if (players.length === 0) return (
              <div key={role} className="text-center">
                <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-white/40">
                  {ROLE_LABELS[role]}
                </p>
              </div>
            )
            return (
              <div key={role} className="flex flex-col items-center gap-1">
                <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-white/55">
                  {ROLE_LABELS[role]}
                </p>
                <div className="flex flex-wrap justify-center gap-2 px-2">
                  {players.map((player) => {
                    const isCaptain = captainId === player.id
                    const isVC = viceCaptainId === player.id
                    return (
                      <PitchPlayerChip
                        key={player.id}
                        player={player}
                        isCaptain={isCaptain}
                        isVC={isVC}
                        onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
                        onRemove={onRemove ? () => onRemove(player.id) : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty slot indicator — outside the oval to keep the pitch visual clean. */}
      {empty > 0 && (
        <button
          type="button"
          onClick={onEmptyClick}
          disabled={!onEmptyClick}
          className={cn(
            "mt-3 w-full text-center text-xs text-muted-foreground rounded-lg border border-dashed border-overlay-border-hover py-2.5 px-3",
            onEmptyClick && "hover:bg-overlay-subtle transition-colors"
          )}
        >
          <span className="font-display font-bold tabular-nums text-foreground">{empty}</span>
          <span className="ml-1.5">slot{empty === 1 ? "" : "s"} open · </span>
          {onEmptyClick ? <span className="text-primary font-semibold">Pick more</span> : <span>switch to List</span>}
        </button>
      )}
    </div>
  )
}

function PitchPlayerChip({
  player,
  isCaptain,
  isVC,
  onClick,
  onRemove,
}: {
  player: PlayerWithTeam
  isCaptain: boolean
  isVC: boolean
  onClick?: () => void
  onRemove?: () => void
}) {
  const lastName =
    player.name.split(" ").length > 1
      ? player.name.split(" ").pop() ?? player.name
      : player.name

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "relative flex flex-col items-center gap-1 transition-transform",
          onClick && "active:scale-95"
        )}
        aria-label={`${player.name}${isCaptain ? " (captain)" : isVC ? " (vice-captain)" : ""}`}
      >
        <span
          className={cn(
            "relative inline-flex rounded-full",
            isCaptain && "ring-captain",
            isVC && "ring-vice"
          )}
        >
          <PlayerHeadshot player={player} size="lg" ring={isCaptain || isVC ? "none" : "team"} shadow />
          {(isCaptain || isVC) && (
            <CaptainOverlay variant={isCaptain ? "captain" : "vice"} size="sm" position="tr" />
          )}
        </span>
        <span
          className="px-1.5 py-0.5 rounded font-display font-bold text-[10px] tracking-wide truncate max-w-[80px] bg-black/60 text-white backdrop-blur-sm"
          style={{ borderBottom: `2px solid ${player.team.color}` }}
        >
          {lastName.length > 9 ? `${lastName.slice(0, 8)}…` : lastName}
        </span>
      </button>

      {/* Quick-remove X — visible on hover/touch, top-right of headshot */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-status-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity shadow-md"
          aria-label={`Remove ${player.name}`}
        >
          <X className="h-3 w-3" strokeWidth={3} />
        </button>
      )}
    </div>
  )
}

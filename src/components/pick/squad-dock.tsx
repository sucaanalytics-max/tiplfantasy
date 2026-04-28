"use client"

import { Crown, Plus, Star } from "lucide-react"
import { PlayerHeadshot } from "@/components/player-headshot"
import { cn } from "@/lib/utils"
import type { PlayerWithTeam, PlayerRole } from "@/lib/types"

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]
const ROLE_TARGET: Record<PlayerRole, number> = { WK: 1, BAT: 4, AR: 2, BOWL: 4 }
const ROLE_LABEL: Record<PlayerRole, string> = {
  WK: "WK",
  BAT: "BAT",
  AR: "AR",
  BOWL: "BOWL",
}

type Props = {
  selectedPlayers: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
  onSlotClick?: (role: PlayerRole) => void
  onPlayerClick?: (player: PlayerWithTeam) => void
  className?: string
}

/**
 * Persistent 88px squad dock. Replaces the desktop left selected-XI
 * panel and the mobile "X / 11 picked" pill with a single broadcast
 * primitive that always shows the user their drafted team.
 *
 * Layout:
 *   - 11 slots in role order: WK · BAT × 4 · AR × 2 · BOWL × 4 (default
 *     composition — filled slots can flex within ROLE_LIMITS, but the
 *     baseline grid uses the standard 1-4-2-4).
 *   - Filled slots show <PlayerHeadshot size="md" ring="team"> with a
 *     C-crown / VC-star corner badge for captain / vice.
 *   - Empty slots are dashed-ring circles labeled with the role short
 *     name (WK / BAT / etc.).
 *   - Tap a filled slot → onPlayerClick (open stats / remove menu).
 *   - Tap an empty slot → onSlotClick(role) — parent jumps role filter.
 *
 * Used at the bottom of /match/[id]/pick on mobile; replaces the desktop
 * selected-team panel.
 */
export function SquadDock({
  selectedPlayers,
  captainId,
  viceCaptainId,
  onSlotClick,
  onPlayerClick,
  className,
}: Props) {
  // Build slot list in role order. Each role gets target slots; if the
  // user has more than the target for a role, those overflow into the
  // dock by reducing slots in another role (visual approximation, not
  // strict enforcement — the pick screen's validation handles rules).
  const byRole: Record<PlayerRole, PlayerWithTeam[]> = {
    WK: [],
    BAT: [],
    AR: [],
    BOWL: [],
  }
  for (const p of selectedPlayers) {
    byRole[p.role as PlayerRole]?.push(p)
  }

  // Build a flat 11-slot array in role order. For each role, fill with
  // selected players (up to 11 total), then pad with empty slots up to
  // the role's target. If we'd exceed 11 total, trim from the end.
  const slots: Array<{ role: PlayerRole; player: PlayerWithTeam | null }> = []
  for (const role of ROLE_ORDER) {
    const players = byRole[role]
    const target = ROLE_TARGET[role]
    const fill = Math.max(target, players.length)
    for (let i = 0; i < fill; i++) {
      slots.push({ role, player: players[i] ?? null })
    }
  }
  // Cap at 11
  while (slots.length > 11) slots.pop()
  // Pad to 11
  while (slots.length < 11) slots.push({ role: "BOWL", player: null })

  return (
    <div
      className={cn(
        "broadcast-tile rounded-xl px-2.5 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide",
        className
      )}
      role="region"
      aria-label="Your selected squad"
    >
      {/* Header label */}
      <div className="shrink-0 flex flex-col items-center justify-center pr-1.5 border-r border-overlay-border min-w-[56px]">
        <span className="text-2xs font-display font-bold tracking-widest text-muted-foreground uppercase leading-none">
          Squad
        </span>
        <span className="text-base font-display font-bold tabular-nums leading-tight mt-0.5">
          {selectedPlayers.length}<span className="text-muted-foreground/60 text-xs">/11</span>
        </span>
      </div>

      {/* Slots */}
      {slots.map((slot, i) => {
        const player = slot.player
        const isCaptain = player ? captainId === player.id : false
        const isVC = player ? viceCaptainId === player.id : false

        if (!player) {
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={onSlotClick ? () => onSlotClick(slot.role) : undefined}
              disabled={!onSlotClick}
              className={cn(
                "shrink-0 h-12 w-12 rounded-full border-2 border-dashed border-overlay-border-hover flex flex-col items-center justify-center transition-all",
                onSlotClick && "hover:border-primary/40 hover:bg-primary/5 active:scale-95"
              )}
              aria-label={`Open ${ROLE_LABEL[slot.role]} picker (slot ${i + 1} of 11)`}
            >
              <Plus className="h-3 w-3 text-muted-foreground/40" aria-hidden />
              <span className="text-[8px] font-display font-bold tracking-widest text-muted-foreground/60 leading-none mt-px">
                {ROLE_LABEL[slot.role]}
              </span>
            </button>
          )
        }

        return (
          <button
            key={player.id}
            type="button"
            onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
            className={cn(
              "shrink-0 relative transition-transform",
              "animate-scale-in",
              onPlayerClick && "active:scale-95"
            )}
            aria-label={`${player.name}${isCaptain ? " (captain)" : isVC ? " (vice-captain)" : ""}`}
            style={{ "--team-color": player.team.color } as React.CSSProperties}
          >
            <span
              className={cn(
                "relative inline-flex rounded-full",
                isCaptain && "ring-captain",
                isVC && "ring-vice"
              )}
            >
              <PlayerHeadshot player={player} size="md" ring={isCaptain || isVC ? "none" : "team"} />
            </span>
            {isCaptain && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--captain-gold)] text-[oklch(0.18_0.02_86)] flex items-center justify-center shadow-md border border-background/40">
                <Crown className="h-2.5 w-2.5 fill-current" aria-hidden />
              </span>
            )}
            {isVC && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--vice-silver)] text-[oklch(0.15_0.01_60)] flex items-center justify-center shadow-md border border-background/40">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

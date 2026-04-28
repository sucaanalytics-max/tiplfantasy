"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { PlayerHeadshot } from "@/components/player-headshot"
import type { PlayerScoreRow, SelectionRow } from "../scores-client"

const ROLE_COLORS: Record<string, string> = {
  WK: "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]",
  BAT: "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]",
  AR: "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]",
  BOWL: "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]",
}

type Owner = {
  user_id: string
  display_name: string
  isC: boolean
  isVC: boolean
  isMe: boolean
}

type Props = {
  playerScores: PlayerScoreRow[]
  myPlayerSet: Set<string>
  /** Selections scoped to the active league filter (or all entries when no filter). */
  scopedSelections: SelectionRow[]
  userNamesById: Map<string, string>
  currentUserId: string
}

/**
 * All players who have scored in the match (fantasy_points > 0), sorted
 * descending. Tap a player → row expands inline to reveal which league
 * users own that player, with C/VC chips per owner.
 */
export function TopScorers({
  playerScores, myPlayerSet, scopedSelections, userNamesById, currentUserId,
}: Props) {
  const scorers = useMemo(
    () => playerScores.filter((ps) => Number(ps.fantasy_points) > 0),
    [playerScores],
  )

  // Build a Map<player_id, Owner[]> once per render — tiny inputs, cheap.
  const ownersByPlayer = useMemo(() => {
    const m = new Map<string, Owner[]>()
    for (const sel of scopedSelections) {
      const uid = sel.user_id
      const display = userNamesById.get(uid) ?? "?"
      for (const pid of sel.player_ids) {
        const owner: Owner = {
          user_id: uid,
          display_name: display,
          isC: sel.captain_id === pid,
          isVC: sel.vice_captain_id === pid,
          isMe: uid === currentUserId,
        }
        const list = m.get(pid)
        if (list) list.push(owner)
        else m.set(pid, [owner])
      }
    }
    // Sort each list: captains first, VCs next, then alphabetical.
    for (const list of m.values()) {
      list.sort((a, b) => {
        const aRank = a.isC ? 0 : a.isVC ? 1 : 2
        const bRank = b.isC ? 0 : b.isVC ? 1 : 2
        if (aRank !== bRank) return aRank - bRank
        return a.display_name.localeCompare(b.display_name)
      })
    }
    return m
  }, [scopedSelections, userNamesById, currentUserId])

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)

  if (scorers.length === 0) return null

  return (
    <section className="px-3 pt-4 pb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Top Scorers
        </span>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {scorers.length}
        </span>
      </div>
      <div className="space-y-1">
        {scorers.map((ps) => {
          const isMine = myPlayerSet.has(ps.player_id)
          const isExpanded = expandedPlayerId === ps.player_id
          const owners = ownersByPlayer.get(ps.player_id) ?? []
          const bowled = Number(ps.overs_bowled) > 0
          const batted = ps.runs > 0 || ps.balls_faced > 0
          return (
            <div
              key={ps.player_id}
              className={cn(
                "rounded-lg overflow-hidden",
                isMine ? "bg-primary/10 border border-primary/20" : "bg-overlay-subtle",
              )}
            >
              <button
                onClick={() => setExpandedPlayerId((prev) => prev === ps.player_id ? null : ps.player_id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center gap-2 py-1.5 px-2.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              >
                <PlayerHeadshot player={ps.player} size="sm" ring="team" />
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[8px] px-1 py-0 h-[14px] shrink-0",
                    ROLE_COLORS[ps.player.role],
                  )}
                >
                  {ps.player.role}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">
                    {ps.player.name}
                    {isMine && <span className="text-[8px] text-primary ml-1">●</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {batted && `${ps.runs}(${ps.balls_faced})`}
                    {batted && bowled && " · "}
                    {bowled && `${ps.wickets}/${ps.runs_conceded}`}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                  {owners.length}/{scopedSelections.length}
                </span>
                <span className="text-sm font-bold font-display tabular-nums shrink-0">
                  {Number(ps.fantasy_points)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground/40 transition-transform shrink-0",
                    isExpanded && "rotate-180 text-muted-foreground",
                  )}
                />
              </button>

              {isExpanded && (
                <div className="px-2.5 pb-2 pt-1 border-t border-overlay-border/60">
                  {owners.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/70 italic px-1 py-1">
                      No one in this league owns this player.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {owners.map((o) => (
                        <OwnerChip key={o.user_id} owner={o} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function OwnerChip({ owner }: { owner: Owner }) {
  const tone =
    owner.isC ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" :
    owner.isVC ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" :
    "bg-background border-overlay-border text-foreground/80"

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border text-[11px] font-medium",
      tone,
    )}>
      <span className={cn(
        "h-4 w-4 rounded-full flex items-center justify-center shrink-0",
        getAvatarColor(owner.display_name),
      )}>
        <span className="text-white text-[8px] font-semibold">{getInitials(owner.display_name)}</span>
      </span>
      <span className="truncate max-w-[100px]">
        {owner.display_name}
        {owner.isMe && <span className="opacity-60 ml-0.5">(you)</span>}
      </span>
      {owner.isC && (
        <span className="text-[9px] font-bold tabular-nums leading-none">C</span>
      )}
      {owner.isVC && (
        <span className="text-[9px] font-bold tabular-nums leading-none">VC</span>
      )}
    </span>
  )
}

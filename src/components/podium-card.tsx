import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { Crown } from "@/components/icons/cricket-icons"

export interface PodiumEntry {
  user_id: string
  display_name: string
  total_points: number
  season_rank: number
}

interface Props {
  entries: PodiumEntry[]
  currentUserId?: string
  className?: string
}

const PEDESTAL: Record<1 | 2 | 3, { h: string; ring: string; rank: string; tone: string }> = {
  1: { h: "h-16", ring: "ring-gold",   rank: "#1", tone: "text-accent" },
  2: { h: "h-12", ring: "ring-silver", rank: "#2", tone: "text-foreground/80" },
  3: { h: "h-9",  ring: "ring-bronze", rank: "#3", tone: "text-foreground/70" },
}

const AVATAR_SIZE: Record<1 | 2 | 3, string> = {
  1: "h-16 w-16 text-base",
  2: "h-12 w-12 text-sm",
  3: "h-12 w-12 text-sm",
}

/**
 * Visual top-3 podium. Center column = #1 (taller, gold), left = #2 (silver),
 * right = #3 (bronze). Pedestal heights stagger to convey rank without numerics.
 * Below the podium, name + points list for the same three entries.
 */
export function PodiumCard({ entries, currentUserId, className }: Props) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  // Map by rank position for clean column placement
  const byRank: Record<1 | 2 | 3, PodiumEntry | undefined> = {
    1: top3.find((e) => e.season_rank === 1),
    2: top3.find((e) => e.season_rank === 2),
    3: top3.find((e) => e.season_rank === 3),
  }

  // Read leader to compute point gaps shown under the pedestal of #2 / #3
  const leader = byRank[1]

  return (
    <div className={cn("glass rounded-2xl overflow-hidden", className)}>
      {/* Podium graphic */}
      <div className="relative px-4 pt-5 pb-3">
        {/* Subtle gold halo behind #1 */}
        <div
          aria-hidden
          className="absolute left-1/2 top-2 -translate-x-1/2 h-24 w-24 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, var(--captain-gold-glow) 0%, transparent 70%)",
            filter: "blur(8px)",
            opacity: 0.6,
          }}
        />
        <div className="relative grid grid-cols-3 items-end gap-2">
          {/* #2 — left */}
          <PodiumColumn
            entry={byRank[2]}
            rank={2}
            isMe={byRank[2]?.user_id === currentUserId}
            gap={byRank[2] && leader ? Number(byRank[2].total_points) - Number(leader.total_points) : null}
          />
          {/* #1 — center */}
          <PodiumColumn
            entry={byRank[1]}
            rank={1}
            isMe={byRank[1]?.user_id === currentUserId}
            crowned
            gap={null}
          />
          {/* #3 — right */}
          <PodiumColumn
            entry={byRank[3]}
            rank={3}
            isMe={byRank[3]?.user_id === currentUserId}
            gap={byRank[3] && leader ? Number(byRank[3].total_points) - Number(leader.total_points) : null}
          />
        </div>
      </div>
    </div>
  )
}

function PodiumColumn({
  entry,
  rank,
  isMe,
  crowned,
  gap,
}: {
  entry: PodiumEntry | undefined
  rank: 1 | 2 | 3
  isMe: boolean
  crowned?: boolean
  gap: number | null
}) {
  const cfg = PEDESTAL[rank]

  if (!entry) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={cn(AVATAR_SIZE[rank], "rounded-full bg-muted/40 ring-1 ring-overlay-border")} />
        <PedestalBlock rank={rank} hCls={cfg.h} muted />
      </div>
    )
  }

  // First name only for compact display under avatar
  const firstName = entry.display_name.split(" ")[0]

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Crown above #1 */}
      {crowned && (
        <Crown className="h-4 w-4 text-accent -mb-0.5" aria-hidden />
      )}

      {/* Avatar */}
      <div
        className={cn(
          AVATAR_SIZE[rank],
          "rounded-full flex items-center justify-center shrink-0 font-display font-bold text-white",
          getAvatarColor(entry.display_name),
          cfg.ring,
          isMe && "outline outline-2 outline-primary outline-offset-2"
        )}
      >
        {getInitials(entry.display_name)}
      </div>

      {/* First name */}
      <span className="text-2xs font-semibold truncate max-w-full px-1">
        {firstName}
        {isMe && <span className="text-muted-foreground"> (you)</span>}
      </span>

      {/* Points (gold-stat for #1, normal for 2/3) */}
      <span
        className={cn(
          "text-sm tabular-nums font-display font-bold leading-none",
          rank === 1 ? "text-gold-stat" : "text-foreground"
        )}
      >
        {entry.total_points.toLocaleString()}
      </span>

      {/* Pedestal block — gap to leader for #2 / #3 */}
      <PedestalBlock rank={rank} hCls={cfg.h} gap={gap} />
    </div>
  )
}

function PedestalBlock({
  rank,
  hCls,
  muted,
  gap,
}: {
  rank: 1 | 2 | 3
  hCls: string
  muted?: boolean
  gap?: number | null
}) {
  const cfg = PEDESTAL[rank]
  return (
    <div
      className={cn(
        "w-full rounded-t-md flex flex-col items-center justify-start pt-1 mt-0.5",
        hCls,
        muted ? "bg-muted/30" : "bg-overlay-muted",
        rank === 1 && !muted && "bg-accent/15"
      )}
    >
      <span className={cn("text-xs font-display font-bold tabular-nums leading-none", cfg.tone)}>
        {cfg.rank}
      </span>
      {gap != null && gap !== 0 && (
        <span className="text-[9px] tabular-nums text-rose-400/80 mt-0.5">
          −{Math.round(Math.abs(gap)).toLocaleString()}
        </span>
      )}
    </div>
  )
}

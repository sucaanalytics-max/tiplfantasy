import { getInitials, getAvatarColor } from "@/lib/avatar"
import { cn } from "@/lib/utils"

interface BubbleEntry {
  displayName: string
  rank: number
  gap: number
}

interface Props {
  target: BubbleEntry | null
  threat: BubbleEntry | null
}

export function OnTheBubble({ target, threat }: Props) {
  if (!target && !threat) return null

  return (
    <div className="space-y-2">
      {target && (
        <BubbleRow
          entry={target}
          variant="target"
          label="TARGET"
          gapLabel={`−${Math.round(Math.abs(target.gap)).toLocaleString()} pts to catch`}
        />
      )}
      {threat && (
        <BubbleRow
          entry={threat}
          variant="threat"
          label="THREAT"
          gapLabel={`${Math.round(Math.abs(threat.gap)).toLocaleString()} pts behind`}
        />
      )}
    </div>
  )
}

function BubbleRow({
  entry,
  variant,
  label,
  gapLabel,
}: {
  entry: BubbleEntry
  variant: "target" | "threat"
  label: string
  gapLabel: string
}) {
  const isTarget = variant === "target"

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm",
        isTarget
          ? "bg-emerald-500/5 border-emerald-500/15"
          : "bg-rose-500/5 border-rose-500/15"
      )}
    >
      {/* Tag */}
      <span
        className={cn(
          "text-[9px] font-bold uppercase tracking-widest shrink-0 w-12",
          isTarget ? "text-emerald-400" : "text-rose-400"
        )}
      >
        {label}
      </span>

      {/* Avatar */}
      <div
        className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] font-semibold",
          getAvatarColor(entry.displayName)
        )}
      >
        {getInitials(entry.displayName)}
      </div>

      {/* Name + rank */}
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium truncate">
          {entry.displayName.split(" ")[0]}
        </span>
        <span className="text-muted-foreground text-xs ml-1.5">#{entry.rank}</span>
      </div>

      {/* Gap */}
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{gapLabel}</span>
    </div>
  )
}

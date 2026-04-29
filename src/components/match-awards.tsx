import { cn } from "@/lib/utils"

export type AwardType = "winner" | "best_captain" | "best_vc" | "biggest_mover" | "hidden_gem"

export interface Award {
  type: AwardType
  winnerName: string
  detail: string
  isYou: boolean
}

interface Props {
  awards: Award[]
  matchLabel: string
  matchId: string
}

const AWARD_META: Record<AwardType, { icon: string; label: string; iconColor: string }> = {
  winner: { icon: "🏆", label: "Match Winner", iconColor: "text-amber-400" },
  best_captain: { icon: "©", label: "Best Captain Pick", iconColor: "text-orange-400" },
  best_vc: { icon: "🎖", label: "Best VC Pick", iconColor: "text-purple-400" },
  biggest_mover: { icon: "↑", label: "Biggest Mover", iconColor: "text-emerald-400" },
  hidden_gem: { icon: "💎", label: "Hidden Gem", iconColor: "text-sky-400" },
}

export function MatchAwards({ awards, matchLabel, matchId }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
      {awards.map((award, i) => {
        const meta = AWARD_META[award.type]
        return (
          <div
            key={award.type}
            className={cn(
              "flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-b-0 transition-colors",
              award.isYou && "bg-primary/[0.06] border-l-2 border-l-primary"
            )}
          >
            {/* Icon */}
            <span className={cn("text-base w-6 text-center shrink-0 font-bold", meta.iconColor)}>
              {meta.icon}
            </span>

            {/* Award info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                {meta.label}
              </p>
              <p className={cn("text-sm font-semibold truncate", award.isYou && "text-primary")}>
                {award.isYou ? "You 🎉" : award.winnerName}
              </p>
              <p className="text-[10px] text-muted-foreground">{award.detail}</p>
            </div>

            {/* You won pill */}
            {award.isYou && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/15 text-primary border border-primary/25">
                You won
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

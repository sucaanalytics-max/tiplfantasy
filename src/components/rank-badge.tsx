import { cn } from "@/lib/utils"

type RankBadgeSize = "sm" | "md" | "lg"

const sizeClasses: Record<RankBadgeSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
}

const rankStyles: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-400 to-yellow-600 text-amber-950 shadow-sm shadow-amber-500/30",
  2: "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900 shadow-sm shadow-gray-400/30",
  3: "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 shadow-sm shadow-amber-700/30",
}

export function RankBadge({
  rank,
  size = "md",
  className,
}: {
  rank: number
  size?: RankBadgeSize
  className?: string
}) {
  const style = rankStyles[rank] ?? "bg-secondary text-muted-foreground"

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold font-display shrink-0",
        sizeClasses[size],
        style,
        className
      )}
    >
      {rank}
    </span>
  )
}

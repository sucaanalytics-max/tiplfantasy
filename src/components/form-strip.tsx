import { Trophy } from "@/components/icons/trophy"
import { Bat } from "@/components/icons/cricket-icons"

interface Props {
  rank: number | null
  points: number
  streak: number
  avgPerMatch: number | null
}

export function FormStrip({ rank, points, streak, avgPerMatch }: Props) {
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4 md:mx-0 md:px-0">
      <Pill icon={<Trophy className="h-4 w-4" />} value={rank ? `#${rank}` : "—"} label="Rank" />
      <Pill icon={<Bat className="h-4 w-4" />} value={points.toLocaleString()} label="Points" />
      {streak > 1 && <Pill icon={<span className="text-base leading-none">🔥</span>} value={streak} label="Streak" />}
      {avgPerMatch != null && (
        <Pill value={avgPerMatch.toFixed(1)} label="Avg / M" />
      )}
    </div>
  )
}

function Pill({
  icon,
  value,
  label,
}: {
  icon?: React.ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2.5 shrink-0 shadow-sm">
      {icon && (
        <span className="text-accent flex items-center justify-center h-7 w-7 rounded-full bg-accent/10 shrink-0">
          {icon}
        </span>
      )}
      <span className="text-gold-stat text-lg leading-none">{value}</span>
      <span className="text-2xs uppercase tracking-wider text-muted-foreground font-medium shrink-0">
        {label}
      </span>
    </div>
  )
}

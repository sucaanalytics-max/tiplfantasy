import { Trophy } from "@/components/icons/trophy"
import { Bat } from "@/components/icons/cricket-icons"

interface Props {
  rank: number | null
  points: number
  streak: number
  avgPerMatch: number | null
}

function formatPoints(pts: number): string {
  if (pts >= 10000) return `${(pts / 1000).toFixed(1)}K`
  return pts.toLocaleString()
}

export function FormStrip({ rank, points, streak, avgPerMatch }: Props) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-overlay-border">
        <StatCell
          icon={<Trophy className="h-3.5 w-3.5" />}
          value={rank ? `#${rank}` : "—"}
          label="Season Rank"
          accent
        />
        <StatCell
          icon={<Bat className="h-3.5 w-3.5" />}
          value={formatPoints(points)}
          label="Points"
          accent
        />
        <StatCell
          icon={streak > 1 ? <span className="text-sm leading-none">🔥</span> : undefined}
          value={streak > 0 ? String(streak) : "—"}
          label="Streak"
        />
        <StatCell
          value={avgPerMatch != null ? avgPerMatch.toFixed(1) : "—"}
          label="Avg / Match"
        />
      </div>
    </div>
  )
}

function StatCell({
  icon,
  value,
  label,
  accent,
}: {
  icon?: React.ReactNode
  value: string
  label: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col items-start px-4 py-3 gap-0.5">
      {icon && (
        <span className={`mb-1 ${accent ? "text-accent" : "text-muted-foreground"} flex items-center`}>
          {icon}
        </span>
      )}
      <span className={`text-2xl font-display tabular-nums leading-tight font-bold ${accent ? "text-gold-stat" : "text-foreground"}`}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </span>
    </div>
  )
}

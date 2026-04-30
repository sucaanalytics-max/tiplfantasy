import { cn } from "@/lib/utils"

interface Props {
  rank: number | null
  totalPlayers: number
  points: number
  avgPerMatch: number | null
  gapToLead: number | null
}

export function RankBlock({ rank, totalPlayers, points, avgPerMatch, gapToLead }: Props) {
  const hasRank = rank != null

  return (
    <div className="space-y-3">
      {/* Rank + points row */}
      <div className="flex items-end justify-between gap-4">
        {/* Left: rank */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-1">
            Season Rank
          </p>
          <div className="flex items-baseline gap-2 leading-none">
            <span
              className="text-[52px] font-display font-black leading-none tracking-[-3px] text-primary tabular-nums"
              style={{ letterSpacing: "-3px" }}
            >
              {hasRank ? `#${rank}` : "—"}
            </span>
            {hasRank && (
              <span className="text-base text-foreground/40 font-medium">of {totalPlayers}</span>
            )}
          </div>
        </div>

        {/* Right: points */}
        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-1 justify-end leading-none">
            <span
              className={cn(
                "text-[26px] font-display font-bold leading-none tabular-nums",
                "text-[oklch(var(--captain-gold)/1)]"
              )}
              style={{ color: "var(--captain-gold)" }}
            >
              {points > 0 ? Math.round(points).toLocaleString() : "—"}
            </span>
          </div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium mt-1">
            Points
          </p>
        </div>
      </div>

      {/* Pills row */}
      {(avgPerMatch != null || gapToLead != null) && (
        <div className="flex flex-wrap gap-2">
          {avgPerMatch != null && (
            <StatPill label={`${avgPerMatch.toFixed(1)} avg / match`} />
          )}
          {gapToLead != null && (
            <StatPill
              label={
                gapToLead === 0
                  ? "Leading the league"
                  : `−${Math.round(Math.abs(gapToLead)).toLocaleString()} to lead`
              }
            />
          )}
        </div>
      )}
    </div>
  )
}

function StatPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium text-muted-foreground bg-overlay-subtle border border-overlay-border">
      {label}
    </span>
  )
}

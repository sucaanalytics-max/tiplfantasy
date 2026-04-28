import Link from "next/link"
import { TeamLogo } from "@/components/team-logo"

type RecapTeam = {
  short_name: string
  name?: string | null
  color: string
  logo_url?: string | null
}

interface Props {
  matchId: string
  matchNumber: number
  resultSummary: string | null
  teamHome: RecapTeam
  teamAway: RecapTeam
  totalPoints: number
  rank: number | null
  captainName: string | null
}

export function RecentMatchRecap({
  matchId,
  matchNumber,
  resultSummary,
  teamHome,
  teamAway,
  totalPoints,
  rank,
  captainName,
}: Props) {
  return (
    <Link href={`/match/${matchId}/scores`} className="block group">
      <div className="relative overflow-hidden rounded-2xl glass glass-hover">
        {/* Team-color gradient wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(115deg, ${teamHome.color}1f 0%, transparent 45%, ${teamAway.color}1f 100%)`,
          }}
          aria-hidden
        />
        {/* Pitch-line texture (very subtle) */}
        <div
          className="absolute inset-y-0 right-0 w-1/2 pointer-events-none pitch-lines-bg text-foreground/[0.04]"
          aria-hidden
        />

        {/* SUMMARY tag */}
        <div className="absolute top-3 right-3 z-10">
          <span className="tag-pill-gold">SUMMARY</span>
        </div>

        <div className="relative p-4 md:p-5 flex items-center justify-between gap-4 min-h-[96px]">
          {/* Left side: teams + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TeamLogo team={teamHome} size="md" />
              <span className="text-2xs text-muted-foreground font-bold">vs</span>
              <TeamLogo team={teamAway} size="md" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Last Match · #{matchNumber}
            </p>
            {resultSummary && (
              <p className="text-sm font-medium truncate mt-0.5">{resultSummary}</p>
            )}
            {captainName && (
              <p className="text-2xs text-muted-foreground mt-0.5">
                <span className="text-accent font-bold">C</span> {captainName}
              </p>
            )}
          </div>

          {/* Right side: oversized gold points */}
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your Score</p>
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-gold-stat text-5xl md:text-6xl leading-none">{totalPoints}</span>
              <span className="text-muted-foreground text-xs font-medium">pts</span>
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              {rank != null ? (
                <>Rank #{rank}{rank === 1 ? " 🥇" : rank === 2 ? " 🥈" : rank === 3 ? " 🥉" : ""}</>
              ) : "—"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

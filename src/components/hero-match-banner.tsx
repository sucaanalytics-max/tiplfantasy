import Link from "next/link"
import { CheckCircle2, ChevronRight, Pencil } from "lucide-react"
import { CountdownTimer } from "@/components/countdown-timer"
import { MatchHeroBand, type HeroBandMatch } from "@/components/match-hero-band"
import { Bat } from "@/components/icons/cricket-icons"
import type { MatchStatus } from "@/lib/types"

type HeroMatch = HeroBandMatch & {
  id: string
}

interface Props {
  match: HeroMatch
  hasSubmitted: boolean
  liveScore?: { total_points: number; rank: number | null }
}

export function HeroMatchBanner({ match, hasSubmitted, liveScore }: Props) {
  return (
    <section className="relative">
      <MatchHeroBand match={match} />

      {/* CTA pill (full-width below hero, fully clear of hero band) */}
      <div className="px-4 md:px-6 mt-3 relative">
        <div className="max-w-2xl lg:max-w-5xl mx-auto">
          <HeroCTA
            matchId={match.id}
            matchStartTime={match.start_time}
            status={match.status}
            hasSubmitted={hasSubmitted}
            liveScore={liveScore}
          />
        </div>
      </div>
    </section>
  )
}

function HeroCTA({
  matchId,
  matchStartTime,
  status,
  hasSubmitted,
  liveScore,
}: {
  matchId: string
  matchStartTime: string
  status: MatchStatus
  hasSubmitted: boolean
  liveScore?: { total_points: number; rank: number | null }
}) {
  if (status === "live") {
    return (
      <Link href={`/match/${matchId}/scores`} className="block">
        <div className="cta-pick-pill w-full h-16 rounded-2xl flex items-center justify-between px-5 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-base leading-tight tracking-wide">LIVE SCORES</p>
              <p className="text-xs text-white/75 leading-tight tabular-nums truncate">
                {liveScore ? `${liveScore.total_points} pts${liveScore.rank ? ` · #${liveScore.rank}` : ""}` : "Tap to follow"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/85" />
        </div>
      </Link>
    )
  }

  if (status === "completed" || status === "no_result") {
    return (
      <Link href={`/match/${matchId}/scores`} className="block">
        <div className="cta-pick-pill-submitted w-full h-16 rounded-2xl flex items-center justify-between px-5">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-base leading-tight tracking-wide">VIEW RESULT</p>
              <p className="text-xs text-muted-foreground leading-tight">See match scorecard</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    )
  }

  if (hasSubmitted) {
    return (
      <Link href={`/match/${matchId}/pick`} className="block">
        <div className="cta-pick-pill-submitted w-full h-16 rounded-2xl flex items-center justify-between px-5">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-status-success shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-base leading-tight tracking-wide text-status-success">TEAM LOCKED IN</p>
              <p className="text-xs text-muted-foreground leading-tight flex items-center gap-1.5">
                <Pencil className="h-3 w-3" />
                Tap to edit · <CountdownTimer targetTime={matchStartTime} variant="compact" className="!text-muted-foreground" />
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    )
  }

  // Default: pick your team — with urgency state
  return (
    <Link href={`/match/${matchId}/pick`} className="block">
      <UrgencyCTA matchStartTime={matchStartTime} />
    </Link>
  )
}

function UrgencyCTA({ matchStartTime }: { matchStartTime: string }) {
  const isUrgent = new Date(matchStartTime).getTime() - Date.now() < 2 * 60 * 60 * 1000
  return (
    <div
      data-urgent={isUrgent || undefined}
      className="cta-pick-pill w-full h-16 rounded-2xl flex items-center justify-between px-5 text-white"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Bat className="h-5 w-5 shrink-0 text-white" />
        <div className="min-w-0">
          <p className="font-display font-bold text-base leading-tight tracking-wide">
            {isUrgent ? "FINAL HOUR — PICK NOW" : "PICK YOUR XI"}
          </p>
          <p className="text-xs text-white/80 leading-tight tabular-nums">
            Locks in <CountdownTimer targetTime={matchStartTime} variant="compact" className="!text-white inline" />
          </p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/90" />
    </div>
  )
}

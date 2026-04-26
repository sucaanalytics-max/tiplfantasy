import Link from "next/link"
import { CheckCircle2, ChevronRight, Pencil, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamLogo } from "@/components/team-logo"
import { CountdownTimer } from "@/components/countdown-timer"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { StadiumSilhouette } from "@/components/decor/stadium-silhouette"
import { formatIST } from "@/lib/utils"
import type { MatchStatus } from "@/lib/types"

type HeroTeam = {
  short_name: string
  name?: string | null
  color: string
  logo_url?: string | null
}

type HeroMatch = {
  id: string
  match_number: number
  start_time: string
  venue: string
  status: MatchStatus
  result_summary?: string | null
  cricapi_match_id?: string | null
  team_home: HeroTeam
  team_away: HeroTeam
}

interface Props {
  match: HeroMatch
  hasSubmitted: boolean
  liveScore?: { total_points: number; rank: number | null }
}

export function HeroMatchBanner({ match, hasSubmitted, liveScore }: Props) {
  const home = match.team_home
  const away = match.team_away
  const isLive = match.status === "live"
  const isCompleted = match.status === "completed" || match.status === "no_result"
  const isUpcoming = match.status === "upcoming"

  const tag = isLive ? "live" : isCompleted ? "summary" : "preview"
  const homeFullName = home.name ?? home.short_name
  const awayFullName = away.name ?? away.short_name

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[320px] md:h-[380px] w-full">
        {/* ── Diagonal team-color halves ─────────────────── */}
        <div
          className="absolute inset-0 diagonal-half-home"
          style={{
            background: `linear-gradient(135deg, ${home.color} 0%, ${home.color}cc 100%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 diagonal-half-away"
          style={{
            background: `linear-gradient(135deg, ${away.color}cc 0%, ${away.color} 100%)`,
          }}
          aria-hidden
        />

        {/* ── Stadium silhouette backdrop ────────────────── */}
        <StadiumSilhouette
          className="absolute inset-x-0 bottom-12 w-full h-[40%] text-black/20 dark:text-white/15 pointer-events-none"
        />

        {/* ── Subtle dark vignette for text legibility ───── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,0,0,0.45) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        {/* ── Status tag pill (top-right) ────────────────── */}
        <div className="absolute top-4 right-4 z-10">
          {tag === "live" && (
            <span className="tag-pill-gold !bg-status-live !text-white">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              LIVE
            </span>
          )}
          {tag === "preview" && <span className="tag-pill-gold">PREVIEW</span>}
          {tag === "summary" && <span className="tag-pill-gold">SUMMARY</span>}
        </div>

        {/* ── Match number (top-left) ───────────────────── */}
        <div className="absolute top-4 left-4 z-10">
          <span className="font-display font-bold text-sm text-white/80 tracking-wider">
            MATCH {match.match_number}
          </span>
        </div>

        {/* ── Team identity blocks ───────────────────────── */}
        <div className="absolute inset-0 grid grid-cols-2 z-[5]">
          {/* Home side */}
          <div className="flex flex-col items-center justify-center gap-3 px-4 pb-12 pt-12 md:pt-14">
            <TeamLogo team={home} size="xl" className="md:hidden drop-shadow-2xl" />
            <TeamLogo team={home} size="2xl" className="hidden md:block drop-shadow-2xl" />
            <div className="text-center">
              <span className="inline-block px-2 py-0.5 rounded-sm bg-black/40 text-white font-display font-bold text-[11px] tracking-widest mb-1.5">
                {home.short_name}
              </span>
              <p className="font-display font-bold text-white text-base md:text-2xl tracking-tight leading-tight uppercase max-w-[140px] md:max-w-[200px] mx-auto drop-shadow-lg">
                {homeFullName}
              </p>
            </div>
          </div>

          {/* Away side */}
          <div className="flex flex-col items-center justify-center gap-3 px-4 pb-12 pt-12 md:pt-14">
            <TeamLogo team={away} size="xl" className="md:hidden drop-shadow-2xl" />
            <TeamLogo team={away} size="2xl" className="hidden md:block drop-shadow-2xl" />
            <div className="text-center">
              <span className="inline-block px-2 py-0.5 rounded-sm bg-black/40 text-white font-display font-bold text-[11px] tracking-widest mb-1.5">
                {away.short_name}
              </span>
              <p className="font-display font-bold text-white text-base md:text-2xl tracking-tight leading-tight uppercase max-w-[140px] md:max-w-[200px] mx-auto drop-shadow-lg">
                {awayFullName}
              </p>
            </div>
          </div>
        </div>

        {/* ── Floating VS badge (centered) ───────────────── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 -translate-y-4 md:-translate-y-6">
          <span className="vs-badge-hero">VS</span>
        </div>

        {/* ── Bottom band: venue + countdown/score ───────── */}
        <div className="absolute bottom-0 inset-x-0 bg-black/55 backdrop-blur-sm z-10 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-1.5 text-white/85 text-xs">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{match.venue}</span>
            <span className="text-white/40">·</span>
            <span className="shrink-0">{formatIST(match.start_time, "EEE, MMM d")}</span>
          </div>
          <div className="shrink-0">
            {isLive ? (
              <LiveScoreWidget
                cricapiMatchId={match.cricapi_match_id ?? null}
                startTime={match.start_time}
              />
            ) : isUpcoming ? (
              <CountdownTimer targetTime={match.start_time} variant="compact" className="text-accent font-display font-bold text-sm" />
            ) : (
              <span className="text-white/85 text-xs">{match.result_summary ?? "Result"}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── CTA pill (full-width below hero) ─────────────── */}
      <div className="px-4 md:px-6 -mt-4 relative z-20">
        <div className="max-w-2xl lg:max-w-5xl mx-auto">
          <HeroCTA matchId={match.id} status={match.status} hasSubmitted={hasSubmitted} liveScore={liveScore} />
        </div>
      </div>
    </section>
  )
}

function HeroCTA({
  matchId,
  status,
  hasSubmitted,
  liveScore,
}: {
  matchId: string
  status: MatchStatus
  hasSubmitted: boolean
  liveScore?: { total_points: number; rank: number | null }
}) {
  if (status === "live") {
    return (
      <Link href={`/match/${matchId}/scores`} className="block">
        <Button size="lg" className="w-full bg-status-live hover:bg-status-live/90 text-white font-display font-bold text-base h-12 rounded-full gap-2 shadow-lg shadow-red-900/20">
          {liveScore ? (
            <>
              Live · {liveScore.total_points} pts {liveScore.rank ? `· #${liveScore.rank}` : ""}
              <ChevronRight className="h-5 w-5" />
            </>
          ) : (
            <>
              View Live Scores <ChevronRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </Link>
    )
  }

  if (status === "completed" || status === "no_result") {
    return (
      <Link href={`/match/${matchId}/scores`} className="block">
        <Button
          size="lg"
          variant="outline"
          className="w-full bg-card font-display font-bold text-base h-12 rounded-full gap-2"
        >
          View Result <ChevronRight className="h-5 w-5" />
        </Button>
      </Link>
    )
  }

  if (hasSubmitted) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-status-success/10 border border-status-success/30 text-status-success font-display font-bold">
          <CheckCircle2 className="h-5 w-5" />
          Team Submitted
        </div>
        <Link href={`/match/${matchId}/pick`}>
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full font-display font-bold gap-1.5 border-primary/40 text-primary px-5"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <Link href={`/match/${matchId}/pick`} className="block">
      <Button
        size="lg"
        className="w-full bg-primary hover:bg-primary/90 text-white font-display font-bold text-base h-12 rounded-full gap-2 glow-card"
      >
        Pick Your Team <ChevronRight className="h-5 w-5" />
      </Button>
    </Link>
  )
}

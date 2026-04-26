import Link from "next/link"
import { CheckCircle2, ChevronRight, Pencil, MapPin } from "lucide-react"
import { TeamLogo } from "@/components/team-logo"
import { CountdownTimer } from "@/components/countdown-timer"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { StadiumSilhouette } from "@/components/decor/stadium-silhouette"
import { Bat } from "@/components/icons/cricket-icons"
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

        {/* ── Bottom band: venue + date (countdown moved into CTA) ─── */}
        <div className="absolute bottom-0 inset-x-0 bg-black/55 backdrop-blur-sm z-10 px-4 py-2.5 flex items-center gap-2 text-white/85 text-xs">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{match.venue}</span>
          <span className="text-white/40 shrink-0">·</span>
          <span className="shrink-0">{formatIST(match.start_time, "EEE, MMM d · h:mm a")}</span>
          {isLive && (
            <span className="ml-auto shrink-0">
              <LiveScoreWidget
                cricapiMatchId={match.cricapi_match_id ?? null}
                startTime={match.start_time}
              />
            </span>
          )}
        </div>
      </div>

      {/* ── CTA pill (full-width below hero, fully clear of hero band) ── */}
      <div className="px-4 md:px-6 mt-3 relative">
        <div className="max-w-2xl lg:max-w-5xl mx-auto">
          <HeroCTA matchId={match.id} matchStartTime={match.start_time} status={match.status} hasSubmitted={hasSubmitted} liveScore={liveScore} />
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
      <UrgencyCTA matchId={matchId} matchStartTime={matchStartTime} />
    </Link>
  )
}

function UrgencyCTA({ matchId: _matchId, matchStartTime }: { matchId: string; matchStartTime: string }) {
  // Note: urgency state via CSS data attribute toggled by CountdownTimer onExpire is complex.
  // Simpler pattern: server-derived urgency via time-since-now at render. For SSR pages,
  // the urgency just animates uniformly via CSS; the timer text update is client-side.
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

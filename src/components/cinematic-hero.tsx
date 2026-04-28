import Link from "next/link"
import { CheckCircle2, ChevronRight, Pencil } from "lucide-react"
import { CountdownTimer } from "@/components/countdown-timer"
import { TeamLogo } from "@/components/team-logo"
import { StadiumSilhouette } from "@/components/decor/stadium-silhouette"
import { CameoFan } from "@/components/decor/cameo-fan"
import { Bat } from "@/components/icons/cricket-icons"
import type { HeroBandMatch } from "@/components/match-hero-band"
import type { HeadshotPlayer } from "@/components/player-headshot"
import type { MatchStatus } from "@/lib/types"
import { cn, formatIST } from "@/lib/utils"

type HeroMatch = HeroBandMatch & { id: string }

type Props = {
  match: HeroMatch
  hasSubmitted: boolean
  liveScore?: { total_points: number; rank: number | null }
  /** 0–3 home-team players whose headshots compose the home cameo fan. */
  featuredHomePlayers: HeadshotPlayer[]
  /** 0–3 away-team players for the away cameo fan. */
  featuredAwayPlayers: HeadshotPlayer[]
}

/**
 * 70vh cinematic hero cover for the dashboard. Replaces HeroMatchBanner
 * on /dashboard.
 *
 * Layer stack (back to front):
 *   1. .cinema-bg — team-color flank gradient + radial spotlights +
 *      film grain, with gradient-pan 18s loop ("broadcast breathing")
 *   2. Doubled <StadiumSilhouette/> for depth
 *   3. Two giant team logos in opposite corners (team-art-zoom on mount)
 *   4. <CameoFan/> headshot composition per side (the photography
 *      substitute — we have no team / stadium / crowd imagery)
 *   5. Theatre typography: match-number eyebrow, team short_names in
 *      text-display-xl flanking a 96px gold VS disc with vs-clash
 *   6. Bottom info ribbon: venue + date + countdown
 *
 * The CTA pill (existing UrgencyCTA / submitted / live / completed
 * branches) floats over the hero's bottom edge with -28px margin so
 * it visually anchors to the cover.
 *
 * All entry motion is one-shot (CSS animations defined in globals.css).
 * The only always-on loop is gradient-pan, per the motion budget.
 * Respects prefers-reduced-motion via the universal guard at the
 * bottom of globals.css.
 */
export function CinematicHero({
  match,
  hasSubmitted,
  liveScore,
  featuredHomePlayers,
  featuredAwayPlayers,
}: Props) {
  const home = match.team_home
  const away = match.team_away
  const isLive = match.status === "live"
  const isCompleted = match.status === "completed" || match.status === "no_result"
  const tag = isLive ? "LIVE" : isCompleted ? "RESULT" : "PREVIEW"

  return (
    <section className="relative">
      {/* ── 70vh cinematic cover ───────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={
          {
            "--team-home-color": home.color,
            "--team-away-color": away.color,
            // 480px mobile (~70vh on iPhone 12), 560px desktop.
            // Plain CSS so we don't need framer-motion for layout sizing.
            height: "min(70vh, 480px)",
          } as React.CSSProperties
        }
      >
        {/* Layer 1 — cinema-bg (deep ink + team-color flanks + grain).
            gradient-pan loop runs here. */}
        <div className="absolute inset-0 cinema-bg" aria-hidden />

        {/* Layer 2 — stadium silhouette doubled for depth */}
        <StadiumSilhouette
          className="absolute inset-x-0 bottom-12 w-full h-[40%] text-white/20 pointer-events-none"
          style={{ animation: "team-art-zoom 800ms cubic-bezier(0.16, 1, 0.3, 1) 120ms backwards" }}
        />
        <StadiumSilhouette
          className="absolute inset-x-0 bottom-8 w-full h-[36%] text-white/8 pointer-events-none"
          style={{ animation: "team-art-zoom 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms backwards", transform: "scaleX(-1)" }}
        />

        {/* Layer 3 — giant team crests, opposite corners. team-art-zoom on mount. */}
        <div
          className="absolute -top-6 -left-4 md:-top-12 md:-left-12 w-44 h-44 md:w-72 md:h-72 opacity-25 pointer-events-none"
          style={{ animation: "team-art-zoom 800ms cubic-bezier(0.16, 1, 0.3, 1) 280ms backwards" }}
          aria-hidden
        >
          <TeamLogo team={home} size="2xl" className="w-full h-full" />
        </div>
        <div
          className="absolute -bottom-8 -right-4 md:-bottom-16 md:-right-12 w-44 h-44 md:w-72 md:h-72 opacity-25 pointer-events-none"
          style={{ animation: "team-art-zoom 800ms cubic-bezier(0.16, 1, 0.3, 1) 400ms backwards" }}
          aria-hidden
        >
          <TeamLogo team={away} size="2xl" className="w-full h-full" />
        </div>

        {/* Layer 3.5 — bottom vignette for info-ribbon readability */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none z-[2]"
          style={{ background: "linear-gradient(to top, oklch(0 0 0 / 0.65) 0%, transparent 100%)" }}
          aria-hidden
        />

        {/* Layer 4 — cameo headshot fans (the photography substitute) */}
        {featuredHomePlayers.length > 0 && (
          <div className="absolute left-3 md:left-8 bottom-16 md:bottom-24 z-[2] pointer-events-none">
            <CameoFan players={featuredHomePlayers} side="home" />
          </div>
        )}
        {featuredAwayPlayers.length > 0 && (
          <div className="absolute right-3 md:right-8 bottom-16 md:bottom-24 z-[2] pointer-events-none">
            <CameoFan players={featuredAwayPlayers} side="away" />
          </div>
        )}

        {/* Layer 5 — typography: eyebrow + team names flanking VS */}
        <div className="absolute inset-x-0 top-0 z-[3] flex items-start justify-between px-4 pt-4 md:px-8 md:pt-8 pointer-events-none">
          <span
            className="text-cinema-eyebrow text-white/95"
            style={{ animation: "slide-up 0.4s ease-out 700ms backwards" }}
          >
            Match · {match.match_number} · {tag}
          </span>
          {/* Status corner — LIVE badge or empty */}
          {isLive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-live text-white text-[10px] font-display font-bold uppercase tracking-widest live-ring">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              Live
            </span>
          )}
        </div>

        {/* Centered seam: TEAM_HOME · VS · TEAM_AWAY in display-xl */}
        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6 px-4 w-full max-w-3xl">
            <div
              className="text-display-xl text-white text-right truncate drop-shadow-[0_4px_24px_oklch(0_0_0_/_0.7)]"
              style={{ animation: "slide-up 0.45s ease-out 760ms backwards" }}
            >
              {home.short_name}
            </div>
            <div
              className="relative inline-flex items-center justify-center h-16 w-16 md:h-24 md:w-24 rounded-full bg-[var(--captain-gold)] text-[oklch(0.18_0.02_86)] font-display font-bold text-lg md:text-2xl shrink-0 ring-2 ring-white/30 shadow-[0_8px_24px_oklch(0_0_0_/_0.5)]"
              style={{ animation: "vs-clash 0.48s cubic-bezier(0.16, 1, 0.3, 1) 540ms backwards" }}
              aria-hidden
            >
              VS
            </div>
            <div
              className="text-display-xl text-white text-left truncate drop-shadow-[0_4px_24px_oklch(0_0_0_/_0.7)]"
              style={{ animation: "slide-up 0.45s ease-out 800ms backwards" }}
            >
              {away.short_name}
            </div>
          </div>
        </div>

        {/* Layer 6 — bottom ribbon (venue + date + countdown / live score) */}
        <div className="absolute inset-x-0 bottom-0 z-[3] px-4 md:px-8 pb-4 pointer-events-none">
          <div className="flex items-center justify-between gap-3 text-white/95 text-xs">
            <div className="min-w-0 flex items-center gap-2">
              <span className="truncate">📍 {match.venue}</span>
              <span className="text-white/40">·</span>
              <span className="shrink-0">{formatIST(match.start_time, "EEE, MMM d · h:mm a")}</span>
            </div>
            {!isLive && !isCompleted && (
              <div className="shrink-0 text-right">
                <CountdownTimer targetTime={match.start_time} variant="compact" className="!text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CTA pill — floats over the hero's bottom edge ─────────── */}
      <div className="px-4 md:px-8 -mt-7 relative z-[4]">
        <div className="max-w-2xl lg:max-w-5xl mx-auto">
          <CinematicCTA
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

// ─── CTA pill ─────────────────────────────────────────────────────────
// Same state machine as HeroMatchBanner's HeroCTA, with cinematic styling
// (taller, gold ring on urgent state, anchored to the hero edge).

function CinematicCTA({
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
        <div className="cta-pick-pill w-full h-16 rounded-2xl flex items-center justify-between px-5 text-white"
          style={{ animation: "slide-up 0.4s ease-out 1000ms backwards" }}>
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
        <div className="cta-pick-pill-submitted w-full h-16 rounded-2xl flex items-center justify-between px-5"
          style={{ animation: "slide-up 0.4s ease-out 1000ms backwards" }}>
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
        <div className="cta-pick-pill-submitted w-full h-16 rounded-2xl flex items-center justify-between px-5"
          style={{ animation: "slide-up 0.4s ease-out 1000ms backwards" }}>
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
  const isUrgent = new Date(matchStartTime).getTime() - Date.now() < 2 * 60 * 60 * 1000
  return (
    <Link href={`/match/${matchId}/pick`} className="block">
      <div
        data-urgent={isUrgent || undefined}
        className={cn(
          "cta-pick-pill w-full h-16 rounded-2xl flex items-center justify-between px-5 text-white"
        )}
        style={{ animation: "slide-up 0.4s ease-out 1000ms backwards" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Bat className="h-5 w-5 shrink-0 text-white" />
          <div className="min-w-0">
            <p className="font-display font-bold text-base leading-tight tracking-wide">
              {isUrgent ? "FINAL HOUR — PICK NOW" : "PICK YOUR XI"}
            </p>
            <p className="text-xs text-white/80 leading-tight tabular-nums">
              Locks in{" "}
              {isUrgent ? (
                <span className="shimmer-stroke inline">
                  <CountdownTimer targetTime={matchStartTime} variant="compact" className="!text-current inline" />
                </span>
              ) : (
                <CountdownTimer targetTime={matchStartTime} variant="compact" className="!text-white inline" />
              )}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/90" />
      </div>
    </Link>
  )
}

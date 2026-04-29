import Link from "next/link"
import { CheckCircle2, ChevronRight, Pencil } from "lucide-react"
import { CountdownTimer } from "@/components/countdown-timer"
import { TeamLogo } from "@/components/team-logo"
import { StadiumSilhouette } from "@/components/decor/stadium-silhouette"
import { PlayerHeadshot } from "@/components/player-headshot"
import { Bat } from "@/components/icons/cricket-icons"
import type { HeroBandMatch } from "@/components/match-hero-band"
import type { HeadshotPlayer } from "@/components/player-headshot"
import type { MatchStatus } from "@/lib/types"
import { formatIST } from "@/lib/utils"

type HeroMatch = HeroBandMatch & { id: string }

type Props = {
  match: HeroMatch
  hasSubmitted: boolean
  liveScore?: { total_points: number; rank: number | null }
  /** Top 2 home-team players for the player medallions */
  featuredHomePlayers: HeadshotPlayer[]
  /** Top 2 away-team players for the player medallions */
  featuredAwayPlayers: HeadshotPlayer[]
}

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

  return (
    <section
      className="relative overflow-hidden"
      style={
        {
          height: 296,
          "--team-home-color": home.color,
          "--team-away-color": away.color,
        } as React.CSSProperties
      }
    >
      {/* Layer 1 — color territories */}
      <div className="absolute inset-0 cinema-bg-territories" aria-hidden />

      {/* Layer 2 — stadium silhouettes for depth */}
      <StadiumSilhouette
        className="absolute inset-x-0 bottom-14 w-full h-[38%] text-white/15 pointer-events-none"
        style={{ animation: "team-art-zoom 800ms cubic-bezier(0.16, 1, 0.3, 1) 120ms backwards" }}
      />
      <StadiumSilhouette
        className="absolute inset-x-0 bottom-10 w-full h-[30%] text-white/6 pointer-events-none"
        style={{
          animation: "team-art-zoom 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms backwards",
          transform: "scaleX(-1)",
        }}
      />

      {/* Layer 3 — bottom vignette */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none z-[2]"
        style={{ background: "linear-gradient(to top, oklch(0 0 0 / 0.72) 0%, transparent 100%)" }}
        aria-hidden
      />

      {/* Layer 4 — player medallions */}
      {featuredHomePlayers.length > 0 && (
        <PlayerMedallions players={featuredHomePlayers} side="home" teamColor={home.color} />
      )}
      {featuredAwayPlayers.length > 0 && (
        <PlayerMedallions players={featuredAwayPlayers} side="away" teamColor={away.color} />
      )}

      {/* Layer 5 — eyebrow + live badge */}
      <div className="absolute inset-x-0 top-0 z-[3] flex items-start justify-between px-4 pt-3 pointer-events-none">
        <span
          className="text-cinema-eyebrow text-white/80"
          style={{ animation: "slide-up 0.4s ease-out 700ms backwards" }}
        >
          IPL 2026 · Match {match.match_number}
          {match.venue ? ` · ${match.venue.split(",")[0]}` : ""}
        </span>
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

      {/* Layer 5b — match identity (teams + VS) — vertically centered in upper half */}
      <div
        className="absolute inset-x-0 z-[3] flex items-center justify-center pointer-events-none"
        style={{ top: 36, bottom: 120 }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full">
          {/* Home team */}
          <div
            className="flex flex-col items-center gap-1.5 px-3"
            style={{ animation: "slide-up 0.45s ease-out 700ms backwards" }}
          >
            <div style={{ filter: `drop-shadow(0 0 20px ${home.color}cc)` }}>
              <TeamLogo team={home} size="xl" />
            </div>
            <span className="text-lg font-display font-black text-white tracking-tight drop-shadow-[0_2px_10px_oklch(0_0_0_/_0.9)]">
              {home.short_name}
            </span>
          </div>

          {/* VS disc */}
          <div
            className="relative inline-flex items-center justify-center h-11 w-11 rounded-full bg-[var(--captain-gold)] text-[oklch(0.18_0.02_86)] font-display font-black text-xs shrink-0 ring-2 ring-white/20 shadow-[0_6px_20px_oklch(0_0_0_/_0.6)]"
            style={{ animation: "vs-clash 0.48s cubic-bezier(0.16, 1, 0.3, 1) 540ms backwards" }}
            aria-hidden
          >
            VS
          </div>

          {/* Away team */}
          <div
            className="flex flex-col items-center gap-1.5 px-3"
            style={{ animation: "slide-up 0.45s ease-out 760ms backwards" }}
          >
            <div style={{ filter: `drop-shadow(0 0 20px ${away.color}cc)` }}>
              <TeamLogo team={away} size="xl" />
            </div>
            <span className="text-lg font-display font-black text-white tracking-tight drop-shadow-[0_2px_10px_oklch(0_0_0_/_0.9)]">
              {away.short_name}
            </span>
          </div>
        </div>
      </div>

      {/* Layer 6 — bottom info strip */}
      <div className="absolute inset-x-0 z-[4] px-4" style={{ bottom: 60 }}>
        <div className="flex items-center justify-between gap-2 text-white/80">
          <span className="text-[10px] truncate">{match.venue}</span>
          {!isLive && !isCompleted && (
            <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--captain-gold)" }}>
              ⏱{" "}
              <CountdownTimer targetTime={match.start_time} variant="compact" className="!text-current inline" />
              {" "}to lock
            </span>
          )}
        </div>
      </div>

      {/* Layer 7 — state CTA strip pinned to hero bottom */}
      <div className="absolute inset-x-0 bottom-0 z-[5]">
        <CinematicCTAStrip
          matchId={match.id}
          matchStartTime={match.start_time}
          status={match.status}
          hasSubmitted={hasSubmitted}
          liveScore={liveScore}
        />
      </div>
    </section>
  )
}

// ─── Player medallions ──────────────────────────────────────────────────────
// Spec: captain 84px (front), #2 62px (behind + above). Team-color ring + glow.

function PlayerMedallions({
  players,
  side,
  teamColor,
}: {
  players: HeadshotPlayer[]
  side: "home" | "away"
  teamColor: string
}) {
  const captain = players[0]
  const second = players[1] ?? null

  const isHome = side === "home"
  // Home: left third, Away: right third
  const positionClass = isHome ? "left-3 md:left-6" : "right-3 md:right-6"
  const alignClass = isHome ? "items-start" : "items-end"

  return (
    <div
      className={`absolute z-[3] pointer-events-none ${positionClass} flex ${alignClass} flex-col`}
      style={{ bottom: 56, animation: "team-art-zoom 700ms cubic-bezier(0.16, 1, 0.3, 1) 300ms backwards" } as React.CSSProperties}
    >
      {/* Medallion cluster */}
      <div className="relative" style={{ width: 96, height: 96 }}>
        {/* Second player: 64px, behind and offset */}
        {second && (
          <div
            className="absolute"
            style={{
              ...(isHome ? { right: -16 } : { left: -16 }),
              bottom: 6,
              zIndex: 1,
              opacity: 0.82,
            }}
          >
            <PlayerHeadshot
              player={second}
              size="lg"
              ring="team"
            />
          </div>
        )}

        {/* Captain: 96px, front */}
        <div className="relative" style={{ zIndex: 2 }}>
          <PlayerHeadshot
            player={captain}
            size="xl"
            ring="team"
            shadow
          />
          {/* Gold © crown badge */}
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-black shadow-md z-10"
            style={{ background: "var(--captain-gold)", color: "oklch(0.18 0.02 86)" }}
            aria-label="Captain"
          >
            ©
          </span>
        </div>
      </div>

      {/* Captain name */}
      <p className="mt-1 text-[9px] font-bold text-white/90 leading-tight truncate drop-shadow-[0_1px_4px_oklch(0_0_0_/_0.9)]"
        style={{ maxWidth: 96 }}>
        {captain.name.split(" ").slice(-1)[0]}
      </p>
    </div>
  )
}

// ─── State CTA strip ────────────────────────────────────────────────────────

function CinematicCTAStrip({
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
        <div className="cta-pick-pill h-14 flex items-center justify-between px-5 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative inline-flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-[15px] leading-tight tracking-wide">
                LIVE ·{" "}
                {liveScore ? (
                  <span className="tabular-nums">
                    {liveScore.total_points} pts{liveScore.rank ? ` · #${liveScore.rank}` : ""}
                  </span>
                ) : (
                  "Scores updating"
                )}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/80" />
        </div>
      </Link>
    )
  }

  if (status === "completed" || status === "no_result") {
    return (
      <Link href={`/match/${matchId}/scores`} className="block">
        <div className="cta-pick-pill-submitted h-14 flex items-center justify-between px-5">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
            <p className="font-display font-bold text-[15px] leading-tight tracking-wide">VIEW RESULT</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    )
  }

  if (hasSubmitted) {
    return (
      <Link href={`/match/${matchId}/pick`} className="block">
        <div className="cta-pick-pill-submitted h-14 flex items-center justify-between px-5">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-status-success shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-[15px] text-status-success leading-tight tracking-wide">
                SQUAD LOCKED
              </p>
              <p className="text-xs text-muted-foreground leading-tight flex items-center gap-1.5">
                <Pencil className="h-3 w-3" />
                Edit ·{" "}
                <CountdownTimer targetTime={matchStartTime} variant="compact" className="!text-muted-foreground inline" />
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    )
  }

  const isUrgent = new Date(matchStartTime).getTime() - Date.now() < 2 * 60 * 60 * 1000
  return (
    <Link href={`/match/${matchId}/pick`} className="block">
      <div
        data-urgent={isUrgent || undefined}
        className="cta-pick-pill h-14 flex items-center justify-between px-5 text-white"
        style={
          !isUrgent
            ? { boxShadow: "0 4px 22px oklch(from var(--primary) l c h / 0.38)" }
            : undefined
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <Bat className="h-5 w-5 shrink-0 text-white" />
          <div className="min-w-0">
            <p className="font-display font-bold text-[15px] leading-tight tracking-wide">
              {isUrgent ? "FINAL HOUR — PICK NOW" : "PICK YOUR XI"}
            </p>
            <p className="text-xs text-white/75 leading-tight tabular-nums">
              Locks in{" "}
              <CountdownTimer
                targetTime={matchStartTime}
                variant="compact"
                className={isUrgent ? "!text-current inline shimmer-stroke" : "!text-white/75 inline"}
              />
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/90" />
      </div>
    </Link>
  )
}

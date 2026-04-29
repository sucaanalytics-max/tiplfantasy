import { MapPin } from "lucide-react"
import { TeamLogo } from "@/components/team-logo"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { StadiumSilhouette } from "@/components/decor/stadium-silhouette"
import { formatIST } from "@/lib/utils"
import type { MatchStatus } from "@/lib/types"

export type HeroBandTeam = {
  short_name: string
  name?: string | null
  color: string
  logo_url?: string | null
}

export type HeroBandMatch = {
  match_number: number
  start_time: string
  venue: string
  status: MatchStatus
  result_summary?: string | null
  cricapi_match_id?: string | null
  team_home: HeroBandTeam
  team_away: HeroBandTeam
}

interface Props {
  match: HeroBandMatch
  compact?: boolean
  /** Cinematic backdrop variant — replaces the diagonal team-color halves
   *  with the .cinema-bg gradient + grain + spotlight composition.
   *  Used on /scores live + recap surfaces. Pure presentation; touches
   *  no live data hooks. */
  cinematic?: boolean
  /** Territory split variant — team color halves + stadium silhouette,
   *  matches CinematicHero design language. 240px height. */
  variant?: "cinema" | "territories"
}

export function MatchHeroBand({ match, compact = false, cinematic = false, variant }: Props) {
  const home = match.team_home
  const away = match.team_away
  const isLive = match.status === "live"
  const isCompleted = match.status === "completed" || match.status === "no_result"

  const tag = isLive ? "live" : isCompleted ? "summary" : "preview"
  const homeFullName = home.name ?? home.short_name
  const awayFullName = away.name ?? away.short_name

  if (variant === "territories") {
    return (
      <section
        className="relative overflow-hidden"
        style={
          {
            height: 240,
            "--team-home-color": home.color,
            "--team-away-color": away.color,
          } as React.CSSProperties
        }
      >
        {/* Layer 1 — color territories */}
        <div className="absolute inset-0 cinema-bg-territories" aria-hidden />

        {/* Layer 2 — stadium silhouettes */}
        <StadiumSilhouette
          className="absolute inset-x-0 bottom-10 w-full h-[38%] text-white/15 pointer-events-none"
          style={{ animation: "team-art-zoom 800ms cubic-bezier(0.16, 1, 0.3, 1) 120ms backwards" }}
        />
        <StadiumSilhouette
          className="absolute inset-x-0 bottom-6 w-full h-[28%] text-white/6 pointer-events-none"
          style={{ animation: "team-art-zoom 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms backwards", transform: "scaleX(-1)" }}
        />

        {/* Layer 3 — bottom vignette */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none z-[2]"
          style={{ background: "linear-gradient(to top, oklch(0 0 0 / 0.72) 0%, transparent 100%)" }}
          aria-hidden
        />

        {/* Eyebrow */}
        <div className="absolute inset-x-0 top-0 z-[3] flex items-start justify-between px-4 pt-3 pointer-events-none">
          <span className="text-cinema-eyebrow text-white/80">
            IPL 2026 · Match {match.match_number}
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

        {/* Team identities — grid: home | VS | away */}
        <div
          className="absolute inset-x-0 z-[3] flex items-center justify-center pointer-events-none"
          style={{ top: 32, bottom: 44 }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full">
            <div className="flex flex-col items-center gap-1.5 px-3" style={{ animation: "slide-up 0.45s ease-out 700ms backwards" }}>
              <div style={{ filter: `drop-shadow(0 0 16px ${home.color}cc)` }}>
                <TeamLogo team={home} size="xl" />
              </div>
              <span className="text-lg font-display font-black text-white tracking-tight drop-shadow-[0_2px_10px_oklch(0_0_0_/_0.9)]">
                {home.short_name}
              </span>
            </div>
            <div
              className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-[var(--captain-gold)] text-[oklch(0.18_0.02_86)] font-display font-black text-xs shrink-0 ring-2 ring-white/20 shadow-[0_6px_20px_oklch(0_0_0_/_0.6)]"
              style={{ animation: "vs-clash 0.48s cubic-bezier(0.16, 1, 0.3, 1) 540ms backwards" }}
              aria-hidden
            >
              VS
            </div>
            <div className="flex flex-col items-center gap-1.5 px-3" style={{ animation: "slide-up 0.45s ease-out 760ms backwards" }}>
              <div style={{ filter: `drop-shadow(0 0 16px ${away.color}cc)` }}>
                <TeamLogo team={away} size="xl" />
              </div>
              <span className="text-lg font-display font-black text-white tracking-tight drop-shadow-[0_2px_10px_oklch(0_0_0_/_0.9)]">
                {away.short_name}
              </span>
            </div>
          </div>
        </div>

        {/* Status band */}
        <div className="absolute inset-x-0 bottom-0 z-[4] h-11 flex items-center gap-2.5 px-4 bg-black/60 backdrop-blur-sm">
          {isLive ? (
            <>
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-status-live opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-live" />
              </span>
              <span className="text-[11px] font-bold text-white/90 tracking-wide">LIVE</span>
              {match.result_summary && (
                <span className="text-[11px] text-white/60 truncate">{match.result_summary}</span>
              )}
            </>
          ) : isCompleted ? (
            <>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest" style={{ background: "var(--captain-gold)", color: "oklch(0.18 0.02 86)" }}>FINAL</span>
              {match.result_summary && (
                <span className="text-[11px] text-white/70 truncate">{match.result_summary}</span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-white/60 truncate">{match.venue}</span>
          )}
        </div>
      </section>
    )
  }

  if (compact) {
    return (
      <div className="relative h-[140px] md:h-[160px] w-full overflow-hidden">
        {/* Diagonal team-color halves */}
        <div
          className="absolute inset-0 diagonal-half-home"
          style={{ background: `linear-gradient(135deg, ${home.color} 0%, ${home.color}cc 100%)` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 diagonal-half-away"
          style={{ background: `linear-gradient(135deg, ${away.color}cc 0%, ${away.color} 100%)` }}
          aria-hidden
        />

        {/* Subtle dark vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(0,0,0,0.4) 0%, transparent 70%)" }}
          aria-hidden
        />

        {/* Status tag pill (top-right) */}
        <div className="absolute top-3 right-3 z-10">
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

        {/* Match number (top-left) */}
        <div className="absolute top-3 left-3 z-10">
          <span className="font-display font-bold text-2xs text-white/85 tracking-widest uppercase">
            Match {match.match_number}
          </span>
        </div>

        {/* Team identity blocks — logo + short_name nameplate */}
        <div className="absolute inset-0 grid grid-cols-2 z-[5]">
          <div className="flex items-center justify-center gap-2 px-3 pt-4">
            <TeamLogo team={home} size="lg" className="drop-shadow-2xl" />
            <span className="font-display font-bold text-white text-xl tracking-wider drop-shadow">
              {home.short_name}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 px-3 pt-4">
            <span className="font-display font-bold text-white text-xl tracking-wider drop-shadow">
              {away.short_name}
            </span>
            <TeamLogo team={away} size="lg" className="drop-shadow-2xl" />
          </div>
        </div>

        {/* Centered VS badge (smaller) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 pt-4">
          <span className="vs-badge-hero !w-11 !h-11 !text-sm">VS</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative h-[320px] md:h-[380px] w-full overflow-hidden"
      style={
        cinematic
          ? ({ "--team-home-color": home.color, "--team-away-color": away.color } as React.CSSProperties)
          : undefined
      }
    >
      {cinematic ? (
        <>
          {/* Cinematic backdrop — cinema-bg gradient + grain + spotlights,
              gradient-pan loop. Replaces the diagonal halves entirely on
              this variant. */}
          <div className="absolute inset-0 cinema-bg" aria-hidden />
        </>
      ) : (
        <>
          {/* ── Diagonal team-color halves ─────────────────── */}
          <div
            className="absolute inset-0 diagonal-half-home"
            style={{ background: `linear-gradient(135deg, ${home.color} 0%, ${home.color}cc 100%)` }}
            aria-hidden
          />
          <div
            className="absolute inset-0 diagonal-half-away"
            style={{ background: `linear-gradient(135deg, ${away.color}cc 0%, ${away.color} 100%)` }}
            aria-hidden
          />
        </>
      )}

      {/* ── Stadium silhouette backdrop ────────────────── */}
      <StadiumSilhouette className="absolute inset-x-0 bottom-12 w-full h-[40%] text-black/20 dark:text-white/15 pointer-events-none" />

      {/* ── Subtle dark vignette for text legibility ───── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,0,0,0.45) 0%, transparent 70%)" }}
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

      {/* ── Bottom band: venue + date (countdown lives in CTA where present) ─── */}
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
  )
}

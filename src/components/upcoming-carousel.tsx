import Link from "next/link"
import { formatIST } from "@/lib/utils"
import { TeamLogo } from "@/components/team-logo"
import { CountdownTimer } from "@/components/countdown-timer"
import type { MatchStatus } from "@/lib/types"

interface CarouselMatch {
  id: string
  match_number: number
  start_time: string
  status: MatchStatus
  team_home: { short_name: string; name?: string | null; color: string; logo_url?: string | null }
  team_away: { short_name: string; name?: string | null; color: string; logo_url?: string | null }
}

interface Props {
  matches: CarouselMatch[]
  pickedMatchIds: Set<string>
}

export function UpcomingCarousel({ matches, pickedMatchIds }: Props) {
  if (matches.length === 0) return null

  return (
    <div
      className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
      style={{ scrollSnapType: "x mandatory" }}
    >
      {matches.map((match) => (
        <CarouselCard
          key={match.id}
          match={match}
          isPicked={pickedMatchIds.has(match.id)}
        />
      ))}
    </div>
  )
}

function CarouselCard({
  match,
  isPicked,
}: {
  match: CarouselMatch
  isPicked: boolean
}) {
  const isLive = match.status === "live"
  const isLocked = match.status !== "upcoming"
  const href = isLive || match.status === "completed" || match.status === "no_result"
    ? `/match/${match.id}/scores`
    : `/match/${match.id}/pick`

  return (
    <Link
      href={href}
      className="shrink-0"
      style={{ scrollSnapAlign: "start" }}
    >
      <div
        className="relative overflow-hidden rounded-2xl border bg-card dark:bg-[oklch(0_0_0/0.35)] dark:backdrop-blur-sm"
        style={{
          width: 155,
          minHeight: 110,
          borderColor: isLive ? "var(--status-live)" : "var(--border)",
          boxShadow: isLive ? "0 0 0 1px var(--status-live), 0 0 16px oklch(from var(--status-live) l c h / 0.25)" : undefined,
        }}
      >
        {/* Color wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${match.team_home.color}18 0%, transparent 50%, ${match.team_away.color}18 100%)`,
          }}
          aria-hidden
        />

        <div className="relative p-3 flex flex-col gap-2.5">
          {/* Header: match num + status badge */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground">M{match.match_number}</span>
            <StatusBadge status={match.status} />
          </div>

          {/* Teams */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5 flex-1">
              <TeamLogo team={match.team_home} size="sm" />
              <span className="text-[9px] font-bold text-muted-foreground">{match.team_home.short_name}</span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/50">VS</span>
            <div className="flex flex-col items-center gap-0.5 flex-1">
              <TeamLogo team={match.team_away} size="sm" />
              <span className="text-[9px] font-bold text-muted-foreground">{match.team_away.short_name}</span>
            </div>
          </div>

          {/* Time */}
          {!isLocked && (
            <p className="text-[9px] text-muted-foreground/70 text-center leading-tight">
              {formatIST(match.start_time, "EEE · h:mm a")}
            </p>
          )}

          {/* Pick status */}
          <PickStatus isLocked={isLocked} isPicked={isPicked} matchStartTime={match.start_time} />
        </div>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30"
        style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}>
        <span className="h-1 w-1 rounded-full bg-red-400 animate-ping inline-block" />
        Live
      </span>
    )
  }
  if (status === "completed" || status === "no_result") {
    return (
      <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-white/5 text-muted-foreground border border-white/8">
        Done
      </span>
    )
  }
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/25">
      Open
    </span>
  )
}

function PickStatus({
  isLocked,
  isPicked,
  matchStartTime,
}: {
  isLocked: boolean
  isPicked: boolean
  matchStartTime: string
}) {
  if (isPicked && !isLocked) {
    return (
      <p className="text-[9px] font-bold text-emerald-400 text-center">✓ Picked</p>
    )
  }
  if (!isPicked && isLocked) {
    return (
      <p className="text-[9px] font-bold text-primary/70 text-center">Not picked</p>
    )
  }
  if (!isPicked && !isLocked) {
    return (
      <p className="text-[9px] font-bold text-primary text-center">
        Pick XI →
      </p>
    )
  }
  return null
}

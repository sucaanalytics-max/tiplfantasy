import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isPast } from "date-fns"
import { formatIST } from "@/lib/utils"
import { MapPin, CheckCircle2, ChevronRight, Pencil } from "lucide-react"
import { TeamLogo } from "@/components/team-logo"
import { CountdownTimer } from "@/components/countdown-timer"
import { TeamPreviewSheet } from "@/components/team-preview-sheet"
import type { MatchStatus } from "@/lib/types"

type PartialTeam = {
  short_name: string
  color: string
  name?: string | null
}

type MatchCardMatch = {
  id: string
  match_number: number
  start_time: string
  venue: string
  status: MatchStatus
  result_summary?: string | null
  team_home: PartialTeam
  team_away: PartialTeam
}

interface MatchCardProps {
  match: MatchCardMatch
  userPoints?: number | null
  userRank?: number | null
  hasSubmitted?: boolean
  compact?: boolean
}

export function MatchCard({ match, userPoints, userRank, hasSubmitted, compact = false }: MatchCardProps) {
  const home = match.team_home
  const away = match.team_away
  const isUpcoming = match.status === "upcoming"
  const isLive = match.status === "live"
  const isCompleted = match.status === "completed" || match.status === "no_result"
  const matchStarted = isPast(new Date(match.start_time))

  const href = isCompleted || isLive
    ? `/match/${match.id}/scores`
    : `/match/${match.id}/pick`

  if (compact) {
    const tagLabel = isLive ? "LIVE" : isCompleted ? "SUMMARY" : "PREVIEW"
    return (
      <Link href={href} className="snap-start">
        <Card
          className={`glass min-w-[180px] w-[180px] glass-hover transition-all relative overflow-hidden rounded-2xl ${isLive ? "live-glow" : ""}`}
        >
          {/* Team-color gradient wash */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${home.color}24 0%, transparent 45%, ${away.color}24 100%)`,
            }}
          />
          <CardContent className="p-3 pt-3 space-y-3 relative">
            {/* Tag pill */}
            <div className="flex items-center justify-between">
              <span
                className={
                  isLive
                    ? "tag-pill-gold !bg-status-live !text-white"
                    : "tag-pill-gold"
                }
              >
                {isLive && (
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                )}
                {tagLabel}
              </span>
              {hasSubmitted && !isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
            </div>

            {/* Teams */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <TeamLogo team={home} size="md" />
                <span className="text-[10px] font-display font-bold tracking-wider" style={{ color: home.color }}>
                  {home.short_name}
                </span>
              </div>
              <span className="text-[10px] font-display font-bold text-muted-foreground/60">VS</span>
              <div className="flex flex-col items-center gap-1">
                <TeamLogo team={away} size="md" />
                <span className="text-[10px] font-display font-bold tracking-wider" style={{ color: away.color }}>
                  {away.short_name}
                </span>
              </div>
            </div>

            {/* Time / score */}
            <div className="text-center pt-1 border-t border-overlay-border">
              {isCompleted && userPoints != null ? (
                <p className="text-gold-stat text-lg leading-none pt-1">{userPoints} <span className="text-muted-foreground text-2xs font-normal">pts</span></p>
              ) : isLive ? (
                <p className="text-2xs text-status-live font-bold uppercase tracking-wider pt-1">In Play</p>
              ) : (
                <p className="text-2xs text-muted-foreground pt-1">
                  {formatIST(match.start_time, "MMM d · h:mma")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Full card
  const startDate = new Date(match.start_time)
  return (
    <Card className={`glass overflow-hidden relative ${isLive ? "live-glow" : ""}`}>
      {/* Team color gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${home.color}18 0%, transparent 45%, ${away.color}18 100%)`,
        }}
      />
      {/* Top color bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(to right, ${home.color}, transparent 40%, transparent 60%, ${away.color})` }}
      />

      <CardContent className="pt-5 pb-5 space-y-4 relative">
        {/* Header row: match # + status badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Match #{match.match_number}
          </span>
          {isLive ? (
            <Badge variant="destructive" className="text-[10px] gap-1 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              LIVE
            </Badge>
          ) : isCompleted ? (
            <Badge variant="completed" className="text-[10px]">
              {match.status === "no_result" ? "No Result" : "Completed"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
          )}
        </div>

        {/* Team logos + VS */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo team={home} size="lg" />
            <span className="text-sm font-bold font-display" style={{ color: home.color }}>
              {home.short_name}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold font-display h-7 w-7 ring-1 ring-primary/20">
              VS
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <TeamLogo team={away} size="lg" />
            <span className="text-sm font-bold font-display" style={{ color: away.color }}>
              {away.short_name}
            </span>
          </div>
        </div>

        {/* Venue + time / countdown */}
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {match.venue}
          </p>
          {isCompleted ? (
            <p className="text-sm text-muted-foreground">
              {match.result_summary ?? formatIST(match.start_time, "EEE, MMM d")}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                {formatIST(match.start_time, "EEE, MMM d · h:mm a")}
              </p>
              {!matchStarted && (
                <div className="pt-1">
                  <CountdownTimer targetTime={match.start_time} variant="full" />
                </div>
              )}
            </>
          )}
        </div>

        {/* User points (completed) or CTA (upcoming) */}
        {isCompleted && userPoints != null ? (
          <div className="flex items-center justify-between bg-overlay-subtle rounded-xl px-4 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Your points</p>
              <p className="text-2xl font-bold font-display">{userPoints}</p>
            </div>
            {userRank != null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Rank</p>
                <p className="text-2xl font-bold font-display">#{userRank}</p>
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={href}>
                Scores <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ) : isLive ? (
          <div className="flex justify-center gap-2">
            {hasSubmitted && (
              <TeamPreviewSheet
                matchId={match.id}
                matchLabel={`${home.short_name} vs ${away.short_name} · Match #${match.match_number}`}
                status={match.status}
              />
            )}
            <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-1" asChild>
              <Link href={href}>
                View Live Scores <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ) : isUpcoming ? (
          <div className="flex flex-col items-center gap-2">
            {hasSubmitted ? (
              <>
                <div className="flex items-center gap-2 bg-status-success-bg border border-status-success/20 rounded-full px-4 py-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success" />
                  <span className="text-sm font-semibold text-status-success">Team Submitted</span>
                </div>
                <div className="flex gap-2">
                  <TeamPreviewSheet
                    matchId={match.id}
                    matchLabel={`${home.short_name} vs ${away.short_name} · Match #${match.match_number}`}
                    status={match.status}
                  />
                  <Button size="sm" variant="outline" className="gap-1 border-primary/40 text-primary hover:bg-primary/10" asChild>
                    <Link href={`/match/${match.id}/pick`}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold glow-card" asChild>
                <Link href={href}>Pick Your Team</Link>
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

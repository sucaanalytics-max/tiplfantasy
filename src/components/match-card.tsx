import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format, isPast } from "date-fns"
import { MapPin, CheckCircle2, ChevronRight } from "lucide-react"
import { TeamLogo } from "@/components/team-logo"
import { CountdownTimer } from "@/components/countdown-timer"
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
    return (
      <Link href={href} className="snap-start">
        <Card
          className={`border border-border min-w-[160px] w-[160px] hover:border-primary/30 transition-colors relative overflow-hidden ${isLive ? "live-glow" : ""}`}
        >
          {/* Top color bar */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: `linear-gradient(to right, ${home.color}, ${away.color})` }}
          />
          <CardContent className="p-3 pt-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">#{match.match_number}</span>
              <div className="flex items-center gap-1">
                {isLive && (
                  <span className="flex items-center gap-1">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                  </span>
                )}
                {hasSubmitted && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <TeamLogo team={home} size="sm" />
              <span className="text-[10px] font-bold text-muted-foreground">VS</span>
              <TeamLogo team={away} size="sm" />
            </div>
            <div className="text-center">
              {isCompleted && userPoints != null ? (
                <p className="text-sm font-bold font-display">{userPoints} pts</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(match.start_time), "MMM d, h:mm a")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Full card
  return (
    <Card className={`border border-border overflow-hidden relative ${isLive ? "live-glow" : ""}`}>
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
              {match.result_summary ?? format(new Date(match.start_time), "EEE, MMM d")}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                {format(new Date(match.start_time), "EEE, MMM d · h:mm a")}
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
          <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-2.5">
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
            <Link href={href}>
              <Button variant="outline" size="sm" className="gap-1">
                Scores <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : isLive ? (
          <div className="flex justify-center">
            <Link href={href}>
              <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-1">
                View Live Scores <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : isUpcoming ? (
          <div className="flex justify-center">
            {hasSubmitted ? (
              <div className="flex items-center gap-2 bg-status-success-bg border border-status-success/20 rounded-full px-4 py-2">
                <CheckCircle2 className="h-4 w-4 text-status-success" />
                <span className="text-sm font-semibold text-status-success">Team Submitted</span>
              </div>
            ) : (
              <Link href={href}>
                <Button size="sm" className="bg-gradient-to-r from-primary to-blue-400 hover:from-primary/90 hover:to-blue-400/90 text-black font-semibold">
                  Pick Your Team
                </Button>
              </Link>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, isToday, isTomorrow } from "date-fns"
import { formatIST, toIST } from "@/lib/utils"
import { CountdownTimer } from "@/components/countdown-timer"
import { TeamLogo } from "@/components/team-logo"
import { Swords, CheckCircle2 } from "lucide-react"
import { TeamPreviewSheet } from "@/components/team-preview-sheet"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { LiveScoreWidget } from "@/components/live-score-widget"

type Match = {
  id: string
  match_number: number
  start_time: string
  venue: string
  status: string
  result_summary: string | null
  cricapi_match_id: string | null
  team_home: { short_name: string; color: string; logo_url: string | null }
  team_away: { short_name: string; color: string; logo_url: string | null }
}

type FilterKey = "all" | "live" | "upcoming" | "completed"

function isUpcoming(s: string) {
  return s === "upcoming"
}
function isLive(s: string) {
  return s === "live"
}
function isCompleted(s: string) {
  return s === "completed" || s === "no_result" || s === "abandoned"
}

function groupByDate(matches: Match[]) {
  const grouped = new Map<string, Match[]>()
  for (const match of matches) {
    const dateKey = format(toIST(match.start_time), "yyyy-MM-dd")
    if (!grouped.has(dateKey)) grouped.set(dateKey, [])
    grouped.get(dateKey)!.push(match)
  }
  return grouped
}

export function MatchList({
  matches,
  submittedMatchIds,
}: {
  matches: Match[]
  submittedMatchIds: string[]
}) {
  const submittedMatches = useMemo(() => new Set(submittedMatchIds), [submittedMatchIds])

  const counts = useMemo(() => ({
    all: matches.length,
    live: matches.filter((m) => isLive(m.status)).length,
    upcoming: matches.filter((m) => isUpcoming(m.status)).length,
    completed: matches.filter((m) => isCompleted(m.status)).length,
  }), [matches])

  // Default: live > upcoming > completed > all
  const defaultFilter: FilterKey =
    counts.live > 0 ? "live" : counts.upcoming > 0 ? "upcoming" : counts.completed > 0 ? "completed" : "all"
  const [filter, setFilter] = useState<FilterKey>(defaultFilter)

  // When "all" — show Live group, then Upcoming (chrono), then Completed (reverse-chrono).
  // Otherwise — show only the matching status group.
  const filtered = useMemo(() => {
    if (filter === "live") return matches.filter((m) => isLive(m.status))
    if (filter === "upcoming") {
      return matches
        .filter((m) => isUpcoming(m.status))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    }
    if (filter === "completed") {
      return matches
        .filter((m) => isCompleted(m.status))
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    }
    // all — Live first (most urgent), then Upcoming chrono, then Completed reverse-chrono
    const live = matches.filter((m) => isLive(m.status))
    const upcoming = matches
      .filter((m) => isUpcoming(m.status))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const completed = matches
      .filter((m) => isCompleted(m.status))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    return [...live, ...upcoming, ...completed]
  }, [matches, filter])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  return (
    <div className="space-y-4">
      {/* Sticky filter chip strip */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/85 backdrop-blur border-b border-overlay-border">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All <Counter>{counts.all}</Counter>
          </FilterChip>
          <FilterChip
            active={filter === "live"}
            onClick={() => setFilter("live")}
            tone="live"
            disabled={counts.live === 0}
          >
            {counts.live > 0 && (
              <span className="relative inline-flex h-1.5 w-1.5 mr-0.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-status-live opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-live" />
              </span>
            )}
            Live <Counter>{counts.live}</Counter>
          </FilterChip>
          <FilterChip active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
            Upcoming <Counter>{counts.upcoming}</Counter>
          </FilterChip>
          <FilterChip active={filter === "completed"} onClick={() => setFilter("completed")}>
            Completed <Counter>{counts.completed}</Counter>
          </FilterChip>
        </div>
      </div>

      {/* Match cards */}
      {grouped.size === 0 ? (
        <div className="flex flex-col items-center text-center py-16 gap-3">
          <Swords className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-muted-foreground">No {filter === "all" ? "" : filter + " "}matches</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Check back later for updates</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pt-2">
          {Array.from(grouped.entries()).map(([dateKey, dayMatches]) => (
            <div key={dateKey} className="space-y-3">
              <h2 className="flex items-center gap-3 text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                {(() => {
                  const d = new Date(dateKey)
                  if (isToday(d)) return <><span className="text-primary">Today</span> <span className="text-muted-foreground/60">·</span> {format(d, "MMM d")}</>
                  if (isTomorrow(d)) return <><span className="text-status-warning">Tomorrow</span> <span className="text-muted-foreground/60">·</span> {format(d, "MMM d")}</>
                  return format(d, "EEEE, MMMM d")
                })()}
                <div className="flex-1 h-px bg-overlay-muted" />
              </h2>
              <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
                {dayMatches.map((match) => (
                  <MatchListCard
                    key={match.id}
                    match={match}
                    hasSubmitted={submittedMatches.has(match.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────

function MatchListCard({ match, hasSubmitted }: { match: Match; hasSubmitted: boolean }) {
  const home = match.team_home
  const away = match.team_away
  const live = isLive(match.status)
  const completed = isCompleted(match.status)
  const upcoming = isUpcoming(match.status)

  const tag = live ? "live" : completed ? "summary" : "preview"

  return (
    <Card
      className={cn(
        "glass overflow-hidden relative rounded-2xl",
        live && "live-glow",
      )}
    >
      {/* Team-color gradient wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${home.color}14 0%, transparent 50%, ${away.color}14 100%)` }}
        aria-hidden
      />
      {/* Top color bar */}
      <div
        className="h-1 relative"
        style={{ background: `linear-gradient(to right, ${home.color}, ${away.color})` }}
      />

      <CardContent className="py-4 px-4 relative">
        {/* Header: match # + tag pill */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xs uppercase tracking-widest text-muted-foreground font-semibold">
            Match {match.match_number}
          </span>
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
          {tag === "summary" && <span className="tag-pill-gold">{match.status === "no_result" ? "NO RESULT" : "FINAL"}</span>}
        </div>

        {/* Teams + meta */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <TeamLogo team={home} size="lg" />
              <span className="text-xs font-display font-bold tracking-wider" style={{ color: home.color }}>
                {home.short_name}
              </span>
            </div>
            <span className="inline-flex items-center justify-center rounded-full bg-accent/10 text-accent text-2xs font-display font-bold h-7 w-7 ring-1 ring-accent/30">
              VS
            </span>
            <div className="flex flex-col items-center gap-1">
              <TeamLogo team={away} size="lg" />
              <span className="text-xs font-display font-bold tracking-wider" style={{ color: away.color }}>
                {away.short_name}
              </span>
            </div>
          </div>

          <div className="text-right text-2xs text-muted-foreground">
            <p className="font-display font-semibold text-sm text-foreground tabular-nums">
              {formatIST(match.start_time, "h:mm a")}
            </p>
            <p className="truncate max-w-[160px]">{match.venue}</p>
            {upcoming && (
              <CountdownTimer targetTime={match.start_time} variant="compact" className="mt-0.5" />
            )}
          </div>
        </div>

        {match.cricapi_match_id && (live || upcoming) && (
          <div className="mt-2">
            <LiveScoreWidget
              cricapiMatchId={match.cricapi_match_id}
              startTime={match.start_time}
            />
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-3 pt-3 border-t border-overlay-border flex items-center justify-between gap-2">
          {upcoming && (
            <>
              {hasSubmitted ? (
                <span className="inline-flex items-center gap-1.5 text-2xs text-status-success font-semibold">
                  <CheckCircle2 className="h-3 w-3" />
                  Team submitted
                </span>
              ) : (
                <span className="text-2xs text-status-warning font-semibold uppercase tracking-wider">
                  No pick yet
                </span>
              )}
              <div className="flex gap-2">
                {hasSubmitted && (
                  <TeamPreviewSheet
                    matchId={match.id}
                    matchLabel={`${home.short_name} vs ${away.short_name} · Match #${match.match_number}`}
                    status={match.status}
                  />
                )}
                {hasSubmitted ? (
                  <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10" asChild>
                    <Link href={`/match/${match.id}/pick`}>Edit</Link>
                  </Button>
                ) : (
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-full" asChild>
                    <Link href={`/match/${match.id}/pick`}>Pick Team</Link>
                  </Button>
                )}
              </div>
            </>
          )}
          {live && (
            <>
              {hasSubmitted ? (
                <span className="inline-flex items-center gap-1.5 text-2xs text-status-success font-semibold">
                  <CheckCircle2 className="h-3 w-3" />
                  Locked in
                </span>
              ) : (
                <span className="text-2xs text-status-danger font-semibold uppercase tracking-wider">
                  Missed pick
                </span>
              )}
              <div className="flex items-center gap-2">
                {hasSubmitted && (
                  <TeamPreviewSheet
                    matchId={match.id}
                    matchLabel={`${home.short_name} vs ${away.short_name} · Match #${match.match_number}`}
                    status={match.status}
                  />
                )}
                <Button size="sm" className="bg-status-live hover:bg-status-live/90 text-white font-semibold rounded-full" asChild>
                  <Link href={`/match/${match.id}/scores`}>Live Scores</Link>
                </Button>
              </div>
            </>
          )}
          {completed && (
            <>
              {match.result_summary ? (
                <span className="text-2xs text-muted-foreground truncate max-w-[180px]">
                  {match.result_summary}
                </span>
              ) : (
                <span />
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/match/${match.id}/scores`}>View Result</Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  disabled,
  tone,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  tone?: "live"
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 border",
        active
          ? tone === "live"
            ? "bg-status-live/15 border-status-live/40 text-status-live"
            : "bg-primary/15 border-primary/40 text-primary"
          : "border-overlay-border text-muted-foreground hover:bg-overlay-subtle",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  )
}

function Counter({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full bg-overlay-muted text-[10px] font-bold tabular-nums">
      {children}
    </span>
  )
}

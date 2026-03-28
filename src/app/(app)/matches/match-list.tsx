"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { format } from "date-fns"
import { CountdownTimer } from "@/components/countdown-timer"
import { TeamLogo } from "@/components/team-logo"
import { Swords, Eye } from "lucide-react"
import { useMemo } from "react"
import { STATUS_CONFIG } from "@/lib/badges"
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

type TabKey = "upcoming" | "live" | "completed"

function getTabForStatus(status: string): TabKey {
  if (status === "live") return "live"
  if (status === "completed" || status === "no_result" || status === "abandoned") return "completed"
  return "upcoming"
}

function groupByDate(matches: Match[]) {
  const grouped = new Map<string, Match[]>()
  for (const match of matches) {
    const dateKey = format(new Date(match.start_time), "yyyy-MM-dd")
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

  const tabMatches = useMemo(() => {
    const result: Record<TabKey, Match[]> = { upcoming: [], live: [], completed: [] }
    for (const match of matches) {
      result[getTabForStatus(match.status)].push(match)
    }
    return result
  }, [matches])

  const counts: Record<TabKey, number> = {
    upcoming: tabMatches.upcoming.length,
    live: tabMatches.live.length,
    completed: tabMatches.completed.length,
  }

  const defaultTab: TabKey =
    counts.live > 0 ? "live" : counts.upcoming > 0 ? "upcoming" : "completed"

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="upcoming" className="gap-1.5">
          Upcoming
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold">
            {counts.upcoming}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="live" className="gap-1.5">
          Live
          {counts.live > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold bg-status-live-bg text-status-live">
              {counts.live}
            </Badge>
          )}
          {counts.live === 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold">
              {counts.live}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="completed" className="gap-1.5">
          Completed
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold">
            {counts.completed}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {(["upcoming", "live", "completed"] as TabKey[]).map((tab) => {
        const grouped = groupByDate(tabMatches[tab])
        return (
          <TabsContent key={tab} value={tab} className="space-y-6 mt-4">
            {grouped.size === 0 && (
              <div className="flex flex-col items-center text-center py-16 gap-3">
                <Swords className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <p className="font-medium text-muted-foreground">No {tab} matches</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Check back later for updates</p>
                </div>
              </div>
            )}
            {Array.from(grouped.entries()).map(([dateKey, dayMatches]) => (
              <div key={dateKey} className="space-y-3">
                <h2 className="flex items-center gap-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(new Date(dateKey), "EEEE, MMMM d")}
                  <div className="flex-1 h-px bg-border" />
                </h2>
                <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
                {dayMatches.map((match) => {
                  const home = match.team_home
                  const away = match.team_away
                  const status = STATUS_CONFIG[match.status] ?? STATUS_CONFIG.upcoming
                  const hasSubmitted = submittedMatches.has(match.id)

                  return (
                    <Card key={match.id} className={`border border-border overflow-hidden ${match.status === "live" ? "border-status-live/20 live-glow" : ""}`}>
                      {/* Team color gradient bar */}
                      <div
                        className="h-1"
                        style={{
                          background: `linear-gradient(to right, ${home.color}, ${away.color})`,
                        }}
                      />
                      <CardContent className="py-4 px-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            Match #{match.match_number}
                          </span>
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center gap-0.5">
                              <TeamLogo team={home} size="md" />
                              <span className="text-[10px] font-bold font-display" style={{ color: home.color }}>
                                {home.short_name}
                              </span>
                            </div>
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold font-display h-6 w-6 ring-1 ring-primary/20">
                              VS
                            </span>
                            <div className="flex flex-col items-center gap-0.5">
                              <TeamLogo team={away} size="md" />
                              <span className="text-[10px] font-bold font-display" style={{ color: away.color }}>
                                {away.short_name}
                              </span>
                            </div>
                          </div>

                          <div className="text-right text-xs text-muted-foreground">
                            <p>{format(new Date(match.start_time), "h:mm a")}</p>
                            <p className="truncate max-w-[160px]">{match.venue}</p>
                            {match.status === "upcoming" && (
                              <CountdownTimer targetTime={match.start_time} variant="compact" />
                            )}
                          </div>
                        </div>

                        {match.cricapi_match_id && (match.status === "live" || match.status === "upcoming") && (
                          <div className="mt-2">
                            <LiveScoreWidget
                              cricapiMatchId={match.cricapi_match_id}
                              startTime={match.start_time}
                            />
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          {match.status === "upcoming" && (
                            <>
                              {hasSubmitted ? (
                                <Badge variant="success">
                                  Submitted
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">No pick yet</span>
                              )}
                              <div className="flex gap-2">
                                {hasSubmitted && (
                                  <Link href={`/match/${match.id}/my-team`}>
                                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                                      <Eye className="h-3.5 w-3.5" />
                                      Preview
                                    </Button>
                                  </Link>
                                )}
                                <Link href={`/match/${match.id}/pick`}>
                                  {hasSubmitted ? (
                                    <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
                                      Edit Pick
                                    </Button>
                                  ) : (
                                    <Button size="sm" className="bg-gradient-to-r from-primary to-blue-400 text-black font-semibold hover:opacity-90">
                                      Pick Team
                                    </Button>
                                  )}
                                </Link>
                              </div>
                            </>
                          )}
                          {match.status === "live" && (
                            <>
                              {hasSubmitted ? (
                                <Badge variant="success">
                                  Submitted
                                </Badge>
                              ) : (
                                <Badge variant="danger">
                                  Missed
                                </Badge>
                              )}
                              <div className="flex items-center gap-2">
                                {hasSubmitted && (
                                  <Link href={`/match/${match.id}/my-team`}>
                                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs">
                                      <Eye className="h-3.5 w-3.5" />
                                      Preview
                                    </Button>
                                  </Link>
                                )}
                                <span className="inline-flex items-center gap-1.5 text-xs text-status-live">
                                  <span className="w-2 h-2 rounded-full bg-status-live animate-pulse" /> Live
                                </span>
                              </div>
                            </>
                          )}
                          {(match.status === "completed" || match.status === "no_result" || match.status === "abandoned") && (
                            <>
                              {match.result_summary ? (
                                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                  {match.result_summary}
                                </span>
                              ) : (
                                <span />
                              )}
                              <Link href={`/match/${match.id}/scores`}>
                                <Button variant="ghost" size="sm">View Scores</Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                </div>{/* end desktop grid */}
              </div>
            ))}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

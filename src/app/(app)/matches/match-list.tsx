"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { format } from "date-fns"
import { useMemo } from "react"

type Match = {
  id: string
  match_number: number
  start_time: string
  venue: string
  status: string
  result_summary: string | null
  team_home: { short_name: string; color: string }
  team_away: { short_name: string; color: string }
}

type TabKey = "upcoming" | "live" | "completed"

const statusConfig: Record<string, { label: string; class: string }> = {
  upcoming: { label: "Upcoming", class: "bg-primary/10 text-primary" },
  live: { label: "Live", class: "bg-red-500/15 text-red-400 animate-pulse" },
  completed: { label: "Completed", class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  no_result: { label: "No Result", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  abandoned: { label: "Abandoned", class: "bg-red-500/10 text-red-400 border-red-500/20" },
}

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
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold bg-red-500/15 text-red-400">
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
              <div className="text-center py-12 text-muted-foreground text-sm">
                No {tab} matches
              </div>
            )}
            {Array.from(grouped.entries()).map(([dateKey, dayMatches]) => (
              <div key={dateKey} className="space-y-3">
                <h2 className="flex items-center gap-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(new Date(dateKey), "EEEE, MMMM d")}
                  <div className="flex-1 h-px bg-border" />
                </h2>
                {dayMatches.map((match) => {
                  const home = match.team_home
                  const away = match.team_away
                  const status = statusConfig[match.status] ?? statusConfig.upcoming
                  const hasSubmitted = submittedMatches.has(match.id)

                  return (
                    <Card key={match.id} className="border border-border overflow-hidden">
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
                          <Badge variant="outline" className={status.class}>
                            {status.label}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="text-xl font-bold min-w-[48px] text-center"
                              style={{ color: home.color }}
                            >
                              {home.short_name}
                            </div>
                            <span className="text-muted-foreground text-sm">vs</span>
                            <div
                              className="text-xl font-bold min-w-[48px] text-center"
                              style={{ color: away.color }}
                            >
                              {away.short_name}
                            </div>
                          </div>

                          <div className="text-right text-xs text-muted-foreground">
                            <p>{format(new Date(match.start_time), "h:mm a")}</p>
                            <p className="truncate max-w-[160px]">{match.venue}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          {match.status === "upcoming" && (
                            <>
                              {hasSubmitted ? (
                                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                                  Submitted
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">No pick yet</span>
                              )}
                              <Link href={`/match/${match.id}/pick`}>
                                {hasSubmitted ? (
                                  <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
                                    Edit Pick
                                  </Button>
                                ) : (
                                  <Button size="sm" className="bg-gradient-to-r from-primary to-emerald-400 text-black font-semibold hover:opacity-90">
                                    Pick Team
                                  </Button>
                                )}
                              </Link>
                            </>
                          )}
                          {match.status === "live" && (
                            <>
                              {hasSubmitted ? (
                                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                                  Submitted
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                  Missed
                                </Badge>
                              )}
                              <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live
                              </span>
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
              </div>
            ))}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

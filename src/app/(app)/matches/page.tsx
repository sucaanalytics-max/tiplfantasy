import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

const statusConfig: Record<string, { label: string; class: string }> = {
  upcoming: { label: "Upcoming", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  live: { label: "Live", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  completed: { label: "Completed", class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  no_result: { label: "No Result", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  abandoned: { label: "Abandoned", class: "bg-red-500/10 text-red-400 border-red-500/20" },
}

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: matches } = await supabase
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color), team_away:teams!matches_team_away_id_fkey(short_name, color)")
    .order("start_time", { ascending: true })

  // Get user's selections
  const { data: selections } = await supabase
    .from("selections")
    .select("match_id")
    .eq("user_id", user.id)

  const submittedMatches = new Set(selections?.map((s) => s.match_id) ?? [])

  // Group matches by date
  const grouped = new Map<string, NonNullable<typeof matches>>()
  for (const match of matches ?? []) {
    const dateKey = format(new Date(match.start_time), "yyyy-MM-dd")
    if (!grouped.has(dateKey)) grouped.set(dateKey, [])
    grouped.get(dateKey)!.push(match)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <p className="text-muted-foreground mt-0.5">IPL 2026 Schedule</p>
      </div>

      {Array.from(grouped.entries()).map(([dateKey, dayMatches]) => (
        <div key={dateKey} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {format(new Date(dateKey), "EEEE, MMMM d")}
          </h2>
          {dayMatches.map((match) => {
            const home = match.team_home as unknown as { short_name: string; color: string }
            const away = match.team_away as unknown as { short_name: string; color: string }
            const status = statusConfig[match.status] ?? statusConfig.upcoming
            const hasSubmitted = submittedMatches.has(match.id)

            return (
              <Card key={match.id}>
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
                        className="text-lg font-bold min-w-[48px] text-center"
                        style={{ color: home.color }}
                      >
                        {home.short_name}
                      </div>
                      <span className="text-muted-foreground text-sm">vs</span>
                      <div
                        className="text-lg font-bold min-w-[48px] text-center"
                        style={{ color: away.color }}
                      >
                        {away.short_name}
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <p>{format(new Date(match.start_time), "h:mm a")}</p>
                      <p className="truncate max-w-[120px]">{match.venue}</p>
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
                          <Button variant="outline" size="sm">
                            {hasSubmitted ? "Edit Pick" : "Pick Team"}
                          </Button>
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
                        <span className="text-xs text-amber-400 animate-pulse">In Progress</span>
                      </>
                    )}
                    {(match.status === "completed" || match.status === "no_result") && (
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
    </div>
  )
}

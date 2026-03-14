import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format, formatDistanceToNow, isPast } from "date-fns"
import { Trophy, Target, TrendingUp, Clock } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single()

  // Fetch user's season stats from leaderboard
  const { data: myRank } = await supabase
    .from("season_leaderboard")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Fetch next upcoming match
  const { data: nextMatch } = await supabase
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color), team_away:teams!matches_team_away_id_fkey(short_name, color)")
    .eq("status", "upcoming")
    .order("start_time", { ascending: true })
    .limit(1)
    .single()

  // Check if user has submitted for next match
  let hasSubmitted = false
  if (nextMatch) {
    const { count } = await supabase
      .from("selections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("match_id", nextMatch.id)
    hasSubmitted = (count ?? 0) > 0
  }

  // Fetch last completed match result
  const { data: lastMatch } = await supabase
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color), team_away:teams!matches_team_away_id_fkey(short_name, color)")
    .eq("status", "completed")
    .order("start_time", { ascending: false })
    .limit(1)
    .single()

  let lastMatchScore: { total_points: number; rank: number | null } | null = null
  if (lastMatch) {
    const { data } = await supabase
      .from("user_match_scores")
      .select("total_points, rank")
      .eq("user_id", user.id)
      .eq("match_id", lastMatch.id)
      .single()
    lastMatchScore = data
  }

  // Top 5 leaderboard
  const { data: top5 } = await supabase
    .from("season_leaderboard")
    .select("*")
    .order("season_rank", { ascending: true })
    .limit(5)

  const firstName = profile?.display_name?.split(" ")[0] ?? "Player"

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hey, {firstName}</h1>
        <p className="text-muted-foreground mt-0.5">TIPL Fantasy 2026</p>
      </div>

      {/* Season rank + points */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500/10 p-2.5">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {myRank ? `#${myRank.season_rank}` : "\u2014"}
                </p>
                <p className="text-xs text-muted-foreground">Season Rank</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/10 p-2.5">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {myRank?.total_points ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next match card */}
      {nextMatch && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Next Match
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                #{nextMatch.match_number}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-4 text-lg font-semibold">
              <span style={{ color: (nextMatch.team_home as unknown as { color: string }).color }}>
                {(nextMatch.team_home as unknown as { short_name: string }).short_name}
              </span>
              <span className="text-muted-foreground text-sm">vs</span>
              <span style={{ color: (nextMatch.team_away as unknown as { color: string }).color }}>
                {(nextMatch.team_away as unknown as { short_name: string }).short_name}
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{nextMatch.venue}</p>
              <p className="text-sm font-medium mt-1">
                {format(new Date(nextMatch.start_time), "EEE, MMM d \u00b7 h:mm a")}
              </p>
              {!isPast(new Date(nextMatch.start_time)) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(nextMatch.start_time), { addSuffix: true })}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              {hasSubmitted ? (
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                  Submitted
                </Badge>
              ) : (
                <Link href={`/match/${nextMatch.id}/pick`}>
                  <Button size="sm">Pick Your Team</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last match result */}
      {lastMatch && lastMatchScore && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Last Match</CardTitle>
              <Link href={`/match/${lastMatch.id}/scores`}>
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                  View Scores
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {(lastMatch.team_home as unknown as { short_name: string }).short_name} vs{" "}
                  {(lastMatch.team_away as unknown as { short_name: string }).short_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Match #{lastMatch.match_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{lastMatchScore.total_points}</p>
                <p className="text-xs text-muted-foreground">
                  Rank #{lastMatchScore.rank ?? "\u2014"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mini leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Season Standings
            </CardTitle>
            <Link href="/leaderboard">
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                Full Table
              </Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(top5 ?? []).map((entry, i) => {
              const e = entry as unknown as { user_id: string; display_name: string; total_points: number; season_rank: number }
              const isMe = e.user_id === user.id
              const medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"]
              return (
                <div
                  key={e.user_id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    isMe ? "bg-primary/10 border border-primary/20" : "bg-accent/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm">
                      {i < 3 ? medals[i] : `${e.season_rank}`}
                    </span>
                    <span className={`text-sm ${isMe ? "font-semibold" : ""}`}>
                      {e.display_name}
                      {isMe && " (you)"}
                    </span>
                  </div>
                  <span className="font-semibold text-sm">{e.total_points} pts</span>
                </div>
              )
            })}

            {/* Show user's row if not in top 5 */}
            {myRank && myRank.season_rank > 5 && (
              <>
                <div className="text-center text-xs text-muted-foreground py-1">&middot;&middot;&middot;</div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm">{myRank.season_rank}</span>
                    <span className="text-sm font-semibold">
                      {myRank.display_name} (you)
                    </span>
                  </div>
                  <span className="font-semibold text-sm">{myRank.total_points} pts</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

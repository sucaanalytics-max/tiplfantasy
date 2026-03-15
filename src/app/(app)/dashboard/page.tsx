import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format, formatDistanceToNow, isPast, differenceInHours } from "date-fns"
import { Trophy, Target, TrendingUp, Clock, CheckCircle2, Users } from "lucide-react"
import { getMyLeagues } from "@/actions/leagues"
import { getInitials, getAvatarColor } from "@/lib/avatar"

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

  // Fetch user's leagues
  const myLeagues = await getMyLeagues()

  const firstName = profile?.display_name?.split(" ")[0] ?? "Player"
  const hoursUntilMatch = nextMatch ? differenceInHours(new Date(nextMatch.start_time), new Date()) : null

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-5xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hey, {firstName} <span className="inline-block">&#127951;</span></h1>
        <p className="text-primary/60 mt-0.5">TIPL Fantasy 2026</p>
      </div>

      {/* Desktop 2-column layout */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6">
      {/* Left column — main content */}
      <div className="lg:col-span-3 space-y-6">

      {/* Season rank + points */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-border overflow-hidden relative bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/15 p-2.5">
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
        <Card className="border border-border overflow-hidden relative bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/15 p-2.5">
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

      {/* Next match card — hero element */}
      {nextMatch && (
        <Card className="bg-gradient-to-br from-primary/5 via-card to-accent/5 border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Next Match
                {!isPast(new Date(nextMatch.start_time)) && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hoursUntilMatch !== null && hoursUntilMatch < 24 ? 'bg-orange-400' : 'bg-emerald-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hoursUntilMatch !== null && hoursUntilMatch < 24 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                  </span>
                )}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                #{nextMatch.match_number}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-6 text-2xl font-bold">
              <span style={{ color: (nextMatch.team_home as unknown as { color: string }).color }}>
                {(nextMatch.team_home as unknown as { short_name: string }).short_name}
              </span>
              <span className="text-muted-foreground text-base font-normal">vs</span>
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
                <p className={`text-xs mt-1 font-medium ${hoursUntilMatch !== null && hoursUntilMatch < 24 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  {formatDistanceToNow(new Date(nextMatch.start_time), { addSuffix: true })}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              {hasSubmitted ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Team Submitted</span>
                </div>
              ) : (
                <Link href={`/match/${nextMatch.id}/pick`}>
                  <Button size="sm" className="bg-gradient-to-r from-primary to-emerald-400 hover:from-primary/90 hover:to-emerald-400/90 text-black font-semibold">
                    Pick Your Team
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last match result */}
      {lastMatch && lastMatchScore && (
        <Card className="border border-border">
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

      </div>{/* end left column */}
      {/* Right column — standings & leagues */}
      <div className="lg:col-span-2 space-y-6 mt-6 lg:mt-0">

      {/* Mini leaderboard */}
      <Card className="border border-border">
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
              const medalBorders = ["border-l-2 border-l-amber-400", "border-l-2 border-l-gray-300", "border-l-2 border-l-amber-700"]
              return (
                <div
                  key={e.user_id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    isMe ? "bg-primary/10 border border-primary/20" : i < 3 ? `bg-secondary/50 ${medalBorders[i]}` : "bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm">
                      {i < 3 ? medals[i] : `${e.season_rank}`}
                    </span>
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(e.display_name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-semibold">{getInitials(e.display_name)}</span>
                    </div>
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
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(myRank.display_name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-semibold">{getInitials(myRank.display_name)}</span>
                    </div>
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

      {/* My Leagues */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              My Leagues
            </CardTitle>
            <Link href="/leagues">
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                {myLeagues.length > 0 ? "View All" : "Create / Join"}
              </Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {myLeagues.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No leagues yet. Create one or join with an invite code.
            </p>
          ) : (
            <div className="space-y-2">
              {myLeagues.slice(0, 3).map((league) => (
                <Link key={league.id} href={`/leagues/${league.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{league.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {league.member_count} members
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>{/* end right column */}
      </div>{/* end desktop grid */}
    </div>
  )
}

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { TeamBadge } from "@/components/team-badge"
import { MatchCard } from "@/components/match-card"
import { Target, Users, ChevronRight } from "lucide-react"
import { Trophy } from "@/components/icons/trophy"
import { getMyLeagues } from "@/actions/leagues"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { RankBadge } from "@/components/rank-badge"
import { PageTransition } from "@/components/page-transition"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Phase 1: all independent queries in parallel
  const [
    profileRes,
    myRankRes,
    upcomingRes,
    lastMatchRes,
    top5Res,
    myLeagues,
    completedRes,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("season_leaderboard").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("matches")
      .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
      .eq("status", "upcoming")
      .order("start_time", { ascending: true })
      .limit(5),
    supabase
      .from("matches")
      .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
      .eq("status", "completed")
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("season_leaderboard").select("*").order("season_rank", { ascending: true }).limit(5),
    getMyLeagues(),
    supabase.from("matches").select("id").eq("status", "completed").order("start_time", { ascending: false }).limit(20),
  ])

  const profile = profileRes.data
  const myRank = myRankRes.data
  const upcomingMatches = upcomingRes.data
  const lastMatch = lastMatchRes.data
  const top5 = top5Res.data
  const completedMatches = completedRes.data

  const nextMatch = upcomingMatches?.[0] ?? null
  const moreMatches = upcomingMatches?.slice(1) ?? []

  // Phase 2: queries that depend on Phase 1 results, in parallel
  const [subsRes, lastScoreRes, streakRes] = await Promise.all([
    upcomingMatches && upcomingMatches.length > 0
      ? supabase.from("selections").select("match_id").eq("user_id", user.id).in("match_id", upcomingMatches.map((m) => m.id))
      : Promise.resolve({ data: [] as { match_id: string }[] }),
    lastMatch
      ? supabase.from("user_match_scores").select("total_points, rank").eq("user_id", user.id).eq("match_id", lastMatch.id).single()
      : Promise.resolve({ data: null as { total_points: number; rank: number | null } | null }),
    completedMatches && completedMatches.length > 0
      ? supabase.from("selections").select("match_id").eq("user_id", user.id).in("match_id", completedMatches.map((m) => m.id))
      : Promise.resolve({ data: [] as { match_id: string }[] }),
  ])

  const submittedMatchIds = new Set<string>()
  for (const s of subsRes.data ?? []) submittedMatchIds.add(s.match_id)
  const hasSubmitted = nextMatch ? submittedMatchIds.has(nextMatch.id) : false

  const lastMatchScore: { total_points: number; rank: number | null } | null = lastScoreRes.data

  let streak = 0
  if (completedMatches && completedMatches.length > 0) {
    const selectionSet = new Set((streakRes.data ?? []).map((s) => s.match_id))
    for (const m of completedMatches) {
      if (selectionSet.has(m.id)) streak++
      else break
    }
  }

  const firstName = profile?.display_name?.split(" ")[0] ?? "Player"

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-5xl">
      {/* Greeting */}
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <Image src="/icons/icon-192.png" alt="TIPL" width={28} height={28} />
          <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">TIPL Fantasy 2026</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-display">
          Hey, {firstName} &#127951;
          {streak > 1 && (
            <span className="ml-2 text-base font-semibold text-status-warning">
              &#128293; {streak} match streak
            </span>
          )}
        </h1>
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
                <p className="text-2xl font-bold font-display">
                  {myRank ? `#${myRank.season_rank}` : "\u2014"}
                </p>
                <p className="text-xs text-muted-foreground">Season Rank</p>
                {(myRank as unknown as { matches_played?: number })?.matches_played != null && (
                  <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                    {(myRank as unknown as { matches_played: number }).matches_played} MP
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border overflow-hidden relative bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/15 p-2.5">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">
                  {myRank?.total_points ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Points</p>
                {(myRank as unknown as { avg_points?: number })?.avg_points != null && (
                  <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                    avg {(myRank as unknown as { avg_points: number }).avg_points.toFixed(1)}/match
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hero match card */}
      {nextMatch && (
        <MatchCard
          match={nextMatch as unknown as Parameters<typeof MatchCard>[0]["match"]}
          hasSubmitted={hasSubmitted}
        />
      )}

      {/* Upcoming matches — horizontal carousel */}
      {moreMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Upcoming Matches</p>
            <Link href="/matches" className="text-xs text-primary flex items-center gap-0.5 hover:underline">
              See All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x-mandatory pb-1">
            {moreMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match as unknown as Parameters<typeof MatchCard>[0]["match"]}
                hasSubmitted={submittedMatchIds.has(match.id)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Last match result */}
      {lastMatch && lastMatchScore && (() => {
        const home = lastMatch.team_home as unknown as { short_name: string; color: string; logo_url: string | null }
        const away = lastMatch.team_away as unknown as { short_name: string; color: string; logo_url: string | null }
        return (
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <TeamBadge shortName={home.short_name} color={home.color} logoUrl={home.logo_url} size="sm" />
                    <span className="text-xs text-muted-foreground">vs</span>
                    <TeamBadge shortName={away.short_name} color={away.color} logoUrl={away.logo_url} size="sm" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    #{lastMatch.match_number}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-display">{lastMatchScore.total_points}</p>
                  <p className="text-xs text-muted-foreground">
                    Rank #{lastMatchScore.rank ?? "\u2014"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      </div>{/* end left column */}
      {/* Right column — standings & leagues */}
      <div className="lg:col-span-2 space-y-6 mt-6 lg:mt-0">

      {/* Mini leaderboard */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
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
              return (
                <div
                  key={e.user_id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg border-b border-border/30 last:border-b-0 ${
                    isMe ? "bg-primary/10 border border-primary/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <RankBadge rank={e.season_rank} size="sm" />
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(e.display_name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-semibold">{getInitials(e.display_name)}</span>
                    </div>
                    <span className={`text-sm ${isMe ? "font-semibold" : ""}`}>
                      {e.display_name}
                      {isMe && " (you)"}
                    </span>
                  </div>
                  <span className="font-bold text-sm font-display">{e.total_points} pts</span>
                </div>
              )
            })}

            {/* Show user's row if not in top 5 */}
            {myRank && myRank.season_rank > 5 && (
              <>
                <div className="text-center text-xs text-muted-foreground py-1">&middot;&middot;&middot;</div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2.5">
                    <RankBadge rank={myRank.season_rank} size="sm" />
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(myRank.display_name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-semibold">{getInitials(myRank.display_name)}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {myRank.display_name} (you)
                    </span>
                  </div>
                  <span className="font-bold text-sm font-display">{myRank.total_points} pts</span>
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
            <div className="flex flex-col items-center py-6 gap-2">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground text-center">
                No leagues yet. Create one or join with an invite code.
              </p>
            </div>
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
    </PageTransition>
  )
}

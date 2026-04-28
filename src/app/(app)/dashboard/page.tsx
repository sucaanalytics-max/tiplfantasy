import { createClient, getAuthUser } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { MatchCard } from "@/components/match-card"
import { Users, ChevronRight } from "lucide-react"
import { Trophy } from "@/components/icons/trophy"
import { getMyLeagues } from "@/actions/leagues"
import { PageTransition } from "@/components/page-transition"
import { CinematicHero } from "@/components/cinematic-hero"
import { FormStrip } from "@/components/form-strip"
import { RecentMatchRecap } from "@/components/recent-match-recap"
import { StandingsTable } from "@/components/standings-table"
import { PodiumCard } from "@/components/podium-card"

export default async function DashboardPage() {
  const [user, supabase] = await Promise.all([getAuthUser(), createClient()])
  if (!user) redirect("/login")

  // Phase 1: independent queries in parallel
  const [profileRes, myRankRes, allMatchesRes, top6Res, myLeagues] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("season_leaderboard").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("matches")
      .select(
        "*, team_home:teams!matches_team_home_id_fkey(name, short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(name, short_name, color, logo_url)"
      )
      .order("start_time", { ascending: false })
      .limit(80),
    supabase.from("season_leaderboard").select("*").order("season_rank", { ascending: true }).limit(6),
    getMyLeagues(),
  ])

  const profile = profileRes.data
  const myRank = myRankRes.data
  const top6 = top6Res.data

  const allMatches = allMatchesRes.data ?? []
  const liveMatches = allMatches.filter((m) => m.status === "live")
  const upcomingMatches = allMatches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5)
  const lastMatch = allMatches.find((m) => m.status === "completed" || m.status === "no_result") ?? null
  const completedMatches = allMatches.filter((m) => m.status === "completed" || m.status === "no_result")

  const nextMatch = upcomingMatches[0] ?? null
  const moreMatches = upcomingMatches.slice(1)

  // Phase 2: queries that depend on Phase 1 IDs
  const allRelevantMatchIds = [...upcomingMatches, ...liveMatches].map((m) => m.id)
  const completedMatchIds = completedMatches.map((m) => m.id)
  const [subsRes, lastScoreRes, streakRes, lastSelectionRes, liveScoresRes] = await Promise.all([
    allRelevantMatchIds.length > 0
      ? supabase.from("selections").select("match_id").eq("user_id", user.id).in("match_id", allRelevantMatchIds).limit(10)
      : Promise.resolve({ data: [] as { match_id: string }[] }),
    lastMatch
      ? supabase.from("user_match_scores").select("total_points, rank").eq("user_id", user.id).eq("match_id", lastMatch.id).single()
      : Promise.resolve({ data: null as { total_points: number; rank: number | null } | null }),
    completedMatchIds.length > 0
      ? supabase.from("selections").select("match_id").eq("user_id", user.id).in("match_id", completedMatchIds).limit(25)
      : Promise.resolve({ data: [] as { match_id: string }[] }),
    lastMatch
      ? supabase
          .from("selections")
          .select(
            "captain_id, vice_captain_id, captain:players!selections_captain_id_fkey(name), vc:players!selections_vice_captain_id_fkey(name)"
          )
          .eq("user_id", user.id)
          .eq("match_id", lastMatch.id)
          .maybeSingle()
      : Promise.resolve({ data: null as null }),
    liveMatches.length > 0
      ? supabase
          .from("user_match_scores")
          .select("match_id, total_points, rank")
          .eq("user_id", user.id)
          .in("match_id", liveMatches.map((m) => m.id))
          .limit(2)
      : Promise.resolve({ data: [] as { match_id: string; total_points: number; rank: number | null }[] }),
  ])

  const lastSelection = lastSelectionRes.data
  const liveScoreMap = new Map<string, { total_points: number; rank: number | null }>()
  for (const s of liveScoresRes.data ?? []) liveScoreMap.set(s.match_id, { total_points: s.total_points, rank: s.rank })
  const lastCaptainName = (lastSelection?.captain as unknown as { name: string })?.name ?? null

  // Hero featured players for the cinematic cameo fans (3 per side, only
  // those with image_urls so the fan reads as photography rather than
  // initials). Picks the 3 highest-credit players per team — proxy for
  // "marquee" without needing a separate "is_star" column.
  const heroMatchTmp = liveMatches[0] ?? upcomingMatches[0] ?? lastMatch
  const emptyPlayers = { data: [] as Array<{ name: string; role: string; image_url: string | null; team: { short_name: string; color: string } }> }
  const [featuredHomePlayersRes, featuredAwayPlayersRes] = await Promise.all([
    heroMatchTmp
      ? supabase
          .from("players")
          .select("name, role, image_url, team_id, team:teams!players_team_id_fkey(short_name, color)")
          .eq("team_id", heroMatchTmp.team_home_id)
          .not("image_url", "is", null)
          .order("credit_cost", { ascending: false })
          .limit(3)
      : Promise.resolve(emptyPlayers),
    heroMatchTmp
      ? supabase
          .from("players")
          .select("name, role, image_url, team_id, team:teams!players_team_id_fkey(short_name, color)")
          .eq("team_id", heroMatchTmp.team_away_id)
          .not("image_url", "is", null)
          .order("credit_cost", { ascending: false })
          .limit(3)
      : Promise.resolve(emptyPlayers),
  ])

  const featuredHomePlayers = (featuredHomePlayersRes.data ?? []).map((p) => ({
    name: p.name,
    role: p.role,
    image_url: p.image_url,
    team: p.team as unknown as { short_name: string; color: string },
  }))
  const featuredAwayPlayers = (featuredAwayPlayersRes.data ?? []).map((p) => ({
    name: p.name,
    role: p.role,
    image_url: p.image_url,
    team: p.team as unknown as { short_name: string; color: string },
  }))

  const submittedMatchIds = new Set<string>()
  for (const s of subsRes.data ?? []) submittedMatchIds.add(s.match_id)

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

  // Hero match: live takes priority, then next upcoming, then most recent completed
  const heroMatch = liveMatches[0] ?? nextMatch ?? lastMatch
  const heroSubmitted = heroMatch ? submittedMatchIds.has(heroMatch.id) : false
  const heroLiveScore = heroMatch ? liveScoreMap.get(heroMatch.id) : undefined

  // Remaining upcoming matches for the carousel (exclude one already used as hero)
  const isHeroLive = liveMatches.length > 0
  const remainingMatches = [
    ...liveMatches.slice(isHeroLive ? 1 : 0),
    ...(isHeroLive ? upcomingMatches : moreMatches),
  ]

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* ── Cinematic Hero (70vh cover) ────────────────── */}
        {heroMatch ? (
          <CinematicHero
            match={heroMatch as Parameters<typeof CinematicHero>[0]["match"]}
            hasSubmitted={heroSubmitted}
            liveScore={heroLiveScore}
            featuredHomePlayers={featuredHomePlayers}
            featuredAwayPlayers={featuredAwayPlayers}
          />
        ) : (
          <section className="px-4 md:px-6 pt-8 pb-2">
            <div className="max-w-2xl lg:max-w-5xl mx-auto flex items-center gap-3">
              <Image src="/icons/icon-192.png" alt="TIPL" width={40} height={40} />
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight">Hey, {firstName} 🏏</h1>
                <p className="text-sm text-muted-foreground">TIPL Fantasy 2026</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Padded content ────────────────────────────── */}
        <div className="px-4 md:px-6 max-w-2xl lg:max-w-5xl mx-auto space-y-6">
          {/* Form Strip */}
          <FormStrip
            rank={myRank?.season_rank ?? null}
            points={myRank?.total_points ?? 0}
            streak={streak}
            avgPerMatch={(myRank as unknown as { avg_points?: number })?.avg_points ?? null}
          />

          {/* Two-column desktop grid */}
          <div className="lg:grid lg:grid-cols-5 lg:gap-6">
            {/* Left column */}
            <div className="lg:col-span-3 space-y-6">
              {/* Recent Match Recap */}
              {lastMatch && lastMatchScore && (() => {
                const home = lastMatch.team_home as unknown as { short_name: string; name?: string | null; color: string; logo_url?: string | null }
                const away = lastMatch.team_away as unknown as { short_name: string; name?: string | null; color: string; logo_url?: string | null }
                return (
                  <RecentMatchRecap
                    matchId={lastMatch.id}
                    matchNumber={lastMatch.match_number}
                    resultSummary={lastMatch.result_summary ?? format(new Date(lastMatch.start_time), "MMM d")}
                    teamHome={home}
                    teamAway={away}
                    totalPoints={lastMatchScore.total_points}
                    rank={lastMatchScore.rank}
                    captainName={lastCaptainName}
                  />
                )
              })()}

              {/* Upcoming Matches Carousel */}
              {remainingMatches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-display font-bold tracking-wide uppercase">Upcoming</h2>
                    <Link href="/matches" className="text-xs text-primary flex items-center gap-0.5 font-semibold">
                      See all <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x-mandatory pb-2 -mx-4 px-4">
                    {remainingMatches.map((match) => (
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
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 space-y-6 mt-6 lg:mt-0">
              {/* Season Standings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-display font-bold tracking-wide uppercase flex items-center gap-2">
                    <Trophy className="h-5 w-5" /> Season Standings
                  </h2>
                  <Link href="/leaderboard" className="text-xs text-primary flex items-center gap-0.5 font-semibold">
                    Full Table <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* Top-3 visual podium (hero) */}
                {(top6?.length ?? 0) > 0 && (
                  <PodiumCard
                    entries={(top6 ?? []) as unknown as Parameters<typeof PodiumCard>[0]["entries"]}
                    currentUserId={user.id}
                  />
                )}

                {/* Full top-6 table (data) */}
                <StandingsTable
                  entries={(top6 ?? []) as unknown as Parameters<typeof StandingsTable>[0]["entries"]}
                  currentUserId={user.id}
                  myRank={myRank as unknown as Parameters<typeof StandingsTable>[0]["myRank"]}
                />
              </div>

              {/* My Leagues */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-display font-bold tracking-wide uppercase flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" /> My Leagues
                  </h2>
                  <Link href="/leagues" className="text-xs text-primary flex items-center gap-0.5 font-semibold">
                    {myLeagues.length > 0 ? "View All" : "Join"} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* end standings: my leagues follows */}
                {myLeagues.length === 0 ? (
                  <div className="glass rounded-2xl flex flex-col items-center py-8 gap-2">
                    <Users className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground text-center">No leagues yet. Create or join one.</p>
                  </div>
                ) : (
                  <div className="glass rounded-2xl overflow-hidden divide-y divide-overlay-border">
                    {myLeagues.slice(0, 3).map((league) => (
                      <Link key={league.id} href={`/leagues/${league.id}`}>
                        <div className="flex items-center justify-between px-4 py-3 glass-hover transition-colors">
                          <div className="flex items-center gap-2.5">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{league.name}</span>
                          </div>
                          <span className="text-2xs text-muted-foreground">{league.member_count} members</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}


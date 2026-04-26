export const dynamic = "force-dynamic"

import { createClient, getAuthUser } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { MatchCard } from "@/components/match-card"
import { Users, ChevronRight } from "lucide-react"
import { Trophy } from "@/components/icons/trophy"
import { getMyLeagues } from "@/actions/leagues"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { RankBadge } from "@/components/rank-badge"
import { PageTransition } from "@/components/page-transition"
import { HeroMatchBanner } from "@/components/hero-match-banner"
import { FormStrip } from "@/components/form-strip"
import { RecentMatchRecap } from "@/components/recent-match-recap"
import { cn } from "@/lib/utils"

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
  const [subsRes, lastScoreRes, streakRes, lastSelectionRes, liveScoresRes, userAboveRes] = await Promise.all([
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
    myRank && myRank.season_rank > 6
      ? supabase.from("season_leaderboard").select("total_points").eq("season_rank", myRank.season_rank - 1).maybeSingle()
      : Promise.resolve({ data: null as { total_points: number } | null }),
  ])

  const lastSelection = lastSelectionRes.data
  const liveScoreMap = new Map<string, { total_points: number; rank: number | null }>()
  for (const s of liveScoresRes.data ?? []) liveScoreMap.set(s.match_id, { total_points: s.total_points, rank: s.rank })
  const lastCaptainName = (lastSelection?.captain as unknown as { name: string })?.name ?? null

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
        {/* ── Hero Match Banner ─────────────────────────── */}
        {heroMatch ? (
          <HeroMatchBanner
            match={heroMatch as Parameters<typeof HeroMatchBanner>[0]["match"]}
            hasSubmitted={heroSubmitted}
            liveScore={heroLiveScore}
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

                <div className="glass rounded-2xl overflow-hidden divide-y divide-overlay-border stagger-children">
                  <div className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium bg-overlay-subtle">
                    <span className="pl-[3.25rem]">Player</span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="w-7 text-right">W</span>
                      <span className="w-12 text-right">Δ1st</span>
                      <span className="w-12 text-right">ΔNext</span>
                      <span className="w-16 text-right">Pts</span>
                    </div>
                  </div>

                  {(top6 ?? []).map((entry, idx) => {
                    const e = entry as unknown as {
                      user_id: string
                      display_name: string
                      total_points: number
                      season_rank: number
                      first_place_count: number
                    }
                    const isMe = e.user_id === user.id
                    const rank = e.season_rank
                    const leader = (top6 ?? [])[0] as unknown as { total_points: number } | undefined
                    const prev = idx > 0 ? ((top6 ?? [])[idx - 1] as unknown as { total_points: number }) : null
                    const diffFirst = idx === 0 || !leader ? null : Number(e.total_points) - Number(leader.total_points)
                    const diffNext = prev ? Number(e.total_points) - Number(prev.total_points) : null
                    const wins = e.first_place_count ?? 0
                    const ringClass = rank === 1 ? "ring-gold" : rank === 2 ? "ring-silver" : rank === 3 ? "ring-bronze" : ""

                    return (
                      <div
                        key={e.user_id}
                        className={cn(
                          "px-4 py-3 transition-colors",
                          isMe && "row-highlight-you"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(ringClass, "rounded-full")}>
                              <RankBadge rank={rank} size="sm" />
                            </div>
                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", getAvatarColor(e.display_name))}>
                              <span className="text-white text-xs font-semibold">{getInitials(e.display_name)}</span>
                            </div>
                            <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                              {e.display_name}
                              {isMe && " (you)"}
                            </span>
                          </div>
                          <span className="text-gold-stat text-base shrink-0">
                            {e.total_points}
                            <span className="text-muted-foreground font-normal text-2xs ml-0.5">pts</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 pl-[3.25rem]">
                          <span />
                          <div className="flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
                            <span className="w-7 text-right font-semibold text-foreground/80">{wins}</span>
                            <span className={cn("w-12 text-right", diffFirst !== null && diffFirst < 0 && "text-rose-400/80")}>
                              {diffFirst === null ? "—" : `−${Math.round(Math.abs(diffFirst))}`}
                            </span>
                            <span className={cn("w-12 text-right", diffNext !== null && diffNext < 0 && "text-amber-400/80")}>
                              {diffNext === null ? "—" : `−${Math.round(Math.abs(diffNext))}`}
                            </span>
                            <span className="w-16" />
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {myRank && myRank.season_rank > 6 && (() => {
                    const leader = (top6 ?? [])[0] as unknown as { total_points: number } | undefined
                    const prevAbove = userAboveRes.data
                    const diffFirst = leader ? Number(myRank.total_points) - Number(leader.total_points) : null
                    const diffNext = prevAbove ? Number(myRank.total_points) - Number(prevAbove.total_points) : null
                    const wins = (myRank as unknown as { first_place_count: number }).first_place_count ?? 0
                    return (
                      <>
                        <div className="text-center py-1.5 text-muted-foreground text-xs">···</div>
                        <div className="px-4 py-3 row-highlight-you">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <RankBadge rank={myRank.season_rank} size="sm" />
                              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", getAvatarColor(myRank.display_name))}>
                                <span className="text-white text-xs font-semibold">{getInitials(myRank.display_name)}</span>
                              </div>
                              <span className="text-sm font-semibold truncate">{myRank.display_name} (you)</span>
                            </div>
                            <span className="text-gold-stat text-base shrink-0">
                              {myRank.total_points}
                              <span className="text-muted-foreground font-normal text-2xs ml-0.5">pts</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 pl-[3.25rem]">
                            <span />
                            <div className="flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
                              <span className="w-7 text-right font-semibold text-foreground/80">{wins}</span>
                              <span className={cn("w-12 text-right", diffFirst !== null && diffFirst < 0 && "text-rose-400/80")}>
                                {diffFirst === null ? "—" : `−${Math.round(Math.abs(diffFirst))}`}
                              </span>
                              <span className={cn("w-12 text-right", diffNext !== null && diffNext < 0 && "text-amber-400/80")}>
                                {diffNext === null ? "—" : `−${Math.round(Math.abs(diffNext))}`}
                              </span>
                              <span className="w-16" />
                            </div>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
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

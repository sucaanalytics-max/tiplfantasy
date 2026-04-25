export const dynamic = "force-dynamic"

import { createClient, getAuthUser } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { TeamLogo } from "@/components/team-logo"
import { MatchCard } from "@/components/match-card"
import { Target, Users, ChevronRight, CheckCircle2, Pencil } from "lucide-react"
import { Trophy } from "@/components/icons/trophy"
import { getMyLeagues } from "@/actions/leagues"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { RankBadge } from "@/components/rank-badge"
import { PageTransition } from "@/components/page-transition"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { CountdownTimer } from "@/components/countdown-timer"
import { cn, formatIST } from "@/lib/utils"

export default async function DashboardPage() {
  const [user, supabase] = await Promise.all([getAuthUser(), createClient()])
  if (!user) redirect("/login")

  // Phase 1: all independent queries in parallel (5 queries, was 8)
  const [
    profileRes,
    myRankRes,
    allMatchesRes,
    top6Res,
    myLeagues,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("season_leaderboard").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("matches")
      .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
      .order("start_time", { ascending: false })
      .limit(80),
    supabase.from("season_leaderboard").select("*").order("season_rank", { ascending: true }).limit(6),
    getMyLeagues(),
  ])

  const profile = profileRes.data
  const myRank = myRankRes.data
  const top6 = top6Res.data

  // Split single query result by status (was 3 separate queries + 1 IDs query)
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

  // Phase 2: queries that depend on Phase 1 results (4 queries, was 5)
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
          .select("captain_id, vice_captain_id, captain:players!selections_captain_id_fkey(name), vc:players!selections_vice_captain_id_fkey(name)")
          .eq("user_id", user.id)
          .eq("match_id", lastMatch.id)
          .maybeSingle()
      : Promise.resolve({ data: null as null }),
    liveMatches.length > 0
      ? supabase.from("user_match_scores").select("match_id, total_points, rank").eq("user_id", user.id).in("match_id", liveMatches.map((m) => m.id)).limit(2)
      : Promise.resolve({ data: [] as { match_id: string; total_points: number; rank: number | null }[] }),
    myRank && myRank.season_rank > 6
      ? supabase.from("season_leaderboard").select("total_points").eq("season_rank", myRank.season_rank - 1).maybeSingle()
      : Promise.resolve({ data: null as { total_points: number } | null }),
  ])

  const lastSelection = lastSelectionRes.data
  const liveScoreMap = new Map<string, { total_points: number; rank: number | null }>()
  for (const s of liveScoresRes.data ?? []) liveScoreMap.set(s.match_id, { total_points: s.total_points, rank: s.rank })
  const lastCaptainName = (lastSelection?.captain as unknown as { name: string })?.name ?? null
  const lastVcName = (lastSelection?.vc as unknown as { name: string })?.name ?? null

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

  // Hero match: live takes priority, then next upcoming
  const heroMatch = liveMatches[0] ?? nextMatch
  const heroIsLive = liveMatches.length > 0
  const heroHome = heroMatch ? (heroMatch.team_home as unknown as { short_name: string; color: string; logo_url: string | null }) : null
  const heroAway = heroMatch ? (heroMatch.team_away as unknown as { short_name: string; color: string; logo_url: string | null }) : null
  const heroSubmitted = heroMatch ? submittedMatchIds.has(heroMatch.id) : false
  const heroLiveScore = heroMatch ? liveScoreMap.get(heroMatch.id) : undefined

  // Remaining matches for carousel (exclude hero)
  const remainingMatches = [
    ...liveMatches.slice(heroIsLive ? 1 : 0),
    ...(heroIsLive ? (upcomingMatches ?? []) : moreMatches),
  ]

  return (
    <PageTransition>
    <div className="space-y-5 pb-8">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1: Hero Match Banner — full bleed
          ═══════════════════════════════════════════════════════ */}
      {heroMatch && heroHome && heroAway ? (
        <section className="relative overflow-hidden min-h-[300px] md:min-h-[340px] flex flex-col justify-end px-4 md:px-6 pb-6 pt-16">
          {/* Team color gradient background — 50% opacity for energy */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${heroHome.color}50 0%, transparent 35%, transparent 65%, ${heroAway.color}50 100%)`,
            }}
          />
          {/* Subtle diagonal stripe texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, white 10px, white 11px)`,
            }}
          />
          {/* Dark fade overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20 pointer-events-none" />

          <div className="relative z-10 max-w-2xl lg:max-w-5xl mx-auto w-full">
            {/* Live badge or match info */}
            {heroIsLive ? (
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-status-live animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-status-live">LIVE</span>
                <span className="text-xs text-muted-foreground">Match #{heroMatch.match_number}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground">
                  Match #{heroMatch.match_number} &middot; {formatIST(heroMatch.start_time, "EEE, MMM d")}
                </span>
              </div>
            )}

            {/* Teams row: Logo + Name ... VS ... Name + Logo */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <TeamLogo team={heroHome} size="lg" />
                <div>
                  <p className="text-2xl font-bold font-display tracking-tight" style={{ color: heroHome.color }}>
                    {heroHome.short_name}
                  </p>
                  {heroIsLive && heroLiveScore && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {heroLiveScore.total_points} pts · #{heroLiveScore.rank}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="inline-flex items-center justify-center rounded-full bg-white/5 text-muted-foreground/60 text-xs font-bold font-display h-8 w-8 ring-1 ring-white/10">
                  VS
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold font-display tracking-tight" style={{ color: heroAway.color }}>
                    {heroAway.short_name}
                  </p>
                </div>
                <TeamLogo team={heroAway} size="lg" />
              </div>
            </div>

            {/* Venue */}
            <p className="text-center text-2xs text-muted-foreground mt-3">{heroMatch.venue}</p>

            {/* Countdown / Live score + CTA */}
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                {heroIsLive ? (
                  <LiveScoreWidget
                    cricapiMatchId={(heroMatch as unknown as { cricapi_match_id: string | null }).cricapi_match_id}
                    startTime={heroMatch.start_time}
                  />
                ) : (
                  <CountdownTimer targetTime={heroMatch.start_time} variant="full" className="text-stat text-primary" />
                )}
              </div>

              <div className="flex items-center gap-2">
                {heroIsLive ? (
                  <Link href={`/match/${heroMatch.id}/scores`}>
                    <Button size="sm" className="bg-status-live hover:bg-status-live/90 text-white font-semibold gap-1.5 rounded-xl">
                      Live Scores <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : heroSubmitted ? (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-status-success/10 border border-status-success/20">
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                      <span className="text-xs font-semibold text-status-success">Picked</span>
                    </div>
                    <Link href={`/match/${heroMatch.id}/pick`}>
                      <Button size="sm" variant="outline" className="gap-1 border-primary/40 text-primary rounded-xl">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Link href={`/match/${heroMatch.id}/pick`}>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 glow-card">
                      Pick Your Team
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* No match — greeting hero */
        <section className="px-4 md:px-6 pt-8 pb-4">
          <div className="max-w-2xl lg:max-w-5xl mx-auto flex items-center gap-3">
            <Image src="/icons/icon-192.png" alt="TIPL" width={40} height={40} />
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight">
                Hey, {firstName} &#127951;
              </h1>
              <p className="text-sm text-muted-foreground">TIPL Fantasy 2026</p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTIONS 2-7: Padded content
          ═══════════════════════════════════════════════════════ */}
      <div className="px-4 md:px-6 max-w-2xl lg:max-w-5xl mx-auto space-y-6">

        {/* ── SECTION 2: Quick Stats Strip ──────────────────── */}
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1 animate-slide-up">
          <div className="glass-panel rounded-full px-4 py-2.5 flex items-center gap-2.5 shrink-0">
            <div className="rounded-full bg-amber-500/15 p-1.5">
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-base font-bold font-display tabular-nums">{myRank ? `#${myRank.season_rank}` : "\u2014"}</span>
            <span className="text-2xs text-muted-foreground uppercase tracking-wider">Rank</span>
          </div>

          <div className="glass-panel rounded-full px-4 py-2.5 flex items-center gap-2.5 shrink-0">
            <div className="rounded-full bg-primary/15 p-1.5">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <span className="text-base font-bold font-display tabular-nums">{myRank?.total_points ?? 0}</span>
            <span className="text-2xs text-muted-foreground uppercase tracking-wider">Pts</span>
          </div>

          {streak > 1 && (
            <div className="glass-panel rounded-full px-4 py-2.5 flex items-center gap-2 shrink-0">
              <span className="text-sm">&#128293;</span>
              <span className="text-base font-bold font-display">{streak}</span>
              <span className="text-2xs text-muted-foreground uppercase tracking-wider">Streak</span>
            </div>
          )}

          {(myRank as unknown as { avg_points?: number })?.avg_points != null && (
            <div className="glass-panel rounded-full px-4 py-2.5 flex items-center gap-2 shrink-0">
              <span className="text-base font-bold font-display tabular-nums">
                {(myRank as unknown as { avg_points: number }).avg_points.toFixed(1)}
              </span>
              <span className="text-2xs text-muted-foreground uppercase tracking-wider">Avg/M</span>
            </div>
          )}

        </div>

        {/* ── Desktop 2-column grid ─────────────────────────── */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-6">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-6">

            {/* ── SECTION 3: Additional live matches ──────────── */}
            {liveMatches.length > 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-live animate-pulse" />
                  <p className="text-sm font-bold text-status-live">Also Live</p>
                </div>
                {liveMatches.slice(1).map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match as unknown as Parameters<typeof MatchCard>[0]["match"]}
                    hasSubmitted={submittedMatchIds.has(match.id)}
                  />
                ))}
              </div>
            )}

            {/* ── SECTION 4: Upcoming Matches Carousel ────────── */}
            {remainingMatches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold font-display">Upcoming</h2>
                  <Link href="/matches" className="text-xs text-primary flex items-center gap-0.5">
                    See All <ChevronRight className="h-3 w-3" />
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

            {/* ── SECTION 5: Last Match Result ────────────────── */}
            {lastMatch && lastMatchScore && (() => {
              const home = lastMatch.team_home as unknown as { short_name: string; color: string; logo_url: string | null }
              const away = lastMatch.team_away as unknown as { short_name: string; color: string; logo_url: string | null }
              return (
                <Link href={`/match/${lastMatch.id}/scores`}>
                  <div className="glass glass-hover rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={home} size="sm" />
                        <span className="text-2xs text-muted-foreground font-bold">vs</span>
                        <TeamLogo team={away} size="sm" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Match #{lastMatch.match_number}</p>
                        {lastCaptainName && (
                          <p className="text-2xs text-muted-foreground">C: {lastCaptainName}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-display tabular-nums">{lastMatchScore.total_points}</p>
                      <p className="text-2xs text-muted-foreground">Rank #{lastMatchScore.rank ?? "\u2014"}</p>
                    </div>
                  </div>
                </Link>
              )
            })()}

          </div>{/* end left column */}

          {/* Right column — standings & leagues */}
          <div className="lg:col-span-2 space-y-6 mt-6 lg:mt-0">

            {/* ── SECTION 6: Season Leaderboard ─────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold font-display flex items-center gap-2">
                  <Trophy className="h-5 w-5" /> Season Standings
                </h2>
                <Link href="/leaderboard" className="text-xs text-primary flex items-center gap-0.5">
                  Full Table <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="glass rounded-xl overflow-hidden divide-y divide-overlay-border stagger-children">
                <div className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <span className="pl-[3.25rem]">Player</span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="w-7 text-right">W</span>
                    <span className="w-12 text-right">Δ1st</span>
                    <span className="w-12 text-right">ΔNext</span>
                    <span className="w-16 text-right">Pts</span>
                  </div>
                </div>

                {(top6 ?? []).map((entry, idx) => {
                  const e = entry as unknown as { user_id: string; display_name: string; total_points: number; season_rank: number; first_place_count: number }
                  const isMe = e.user_id === user.id
                  const rank = e.season_rank
                  const leader = (top6 ?? [])[0] as unknown as { total_points: number } | undefined
                  const prev = idx > 0 ? ((top6 ?? [])[idx - 1] as unknown as { total_points: number }) : null
                  const diffFirst = idx === 0 || !leader ? null : Number(e.total_points) - Number(leader.total_points)
                  const diffNext = prev ? Number(e.total_points) - Number(prev.total_points) : null
                  const wins = e.first_place_count ?? 0

                  return (
                    <div
                      key={e.user_id}
                      className={cn(
                        "px-4 py-3 transition-colors",
                        rank === 1 && "bg-amber-500/[0.08] shadow-[inset_0_0_20px_oklch(0.78_0.17_86/0.06)]",
                        rank === 2 && "bg-gray-400/[0.05]",
                        rank === 3 && "bg-amber-700/[0.05]",
                        isMe && "bg-primary/10 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <RankBadge rank={rank} size="sm" />
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", getAvatarColor(e.display_name))}>
                            <span className="text-white text-xs font-semibold">{getInitials(e.display_name)}</span>
                          </div>
                          <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                            {e.display_name}{isMe && " (you)"}
                          </span>
                        </div>
                        <span className="font-bold text-sm font-display tabular-nums shrink-0">
                          {e.total_points} <span className="text-muted-foreground font-normal text-xs">pts</span>
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
                      <div className="text-center py-1.5 text-muted-foreground text-xs">&middot;&middot;&middot;</div>
                      <div className="px-4 py-3 bg-primary/10 border-l-2 border-l-primary">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <RankBadge rank={myRank.season_rank} size="sm" />
                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", getAvatarColor(myRank.display_name))}>
                              <span className="text-white text-xs font-semibold">{getInitials(myRank.display_name)}</span>
                            </div>
                            <span className="text-sm font-semibold truncate">{myRank.display_name} (you)</span>
                          </div>
                          <span className="font-bold text-sm font-display tabular-nums shrink-0">
                            {myRank.total_points} <span className="text-muted-foreground font-normal text-xs">pts</span>
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

            {/* ── SECTION 7: My Leagues ─────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold font-display flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" /> My Leagues
                </h2>
                <Link href="/leagues" className="text-xs text-primary flex items-center gap-0.5">
                  {myLeagues.length > 0 ? "View All" : "Join"} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {myLeagues.length === 0 ? (
                <div className="glass rounded-xl flex flex-col items-center py-8 gap-2">
                  <Users className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">
                    No leagues yet. Create or join one.
                  </p>
                </div>
              ) : (
                <div className="glass rounded-xl overflow-hidden divide-y divide-overlay-border">
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

          </div>{/* end right column */}
        </div>{/* end desktop grid */}
      </div>{/* end padded content */}
    </div>
    </PageTransition>
  )
}

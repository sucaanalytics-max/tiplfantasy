export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Target, TrendingUp, TrendingDown, BookOpen, ChevronRight } from "lucide-react"
import { ProfileNameForm } from "./name-form"
import { SignOutButton } from "./sign-out-button"
import { ThemeCard } from "./theme-card"
import { AutoPickToggle } from "./auto-pick-toggle"
import { StatCard } from "@/components/stat-card"
import { RankBadge } from "@/components/rank-badge"
import { TeamBadge } from "@/components/team-badge"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { PageTransition } from "@/components/page-transition"
import { cn } from "@/lib/utils"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Phase 1: all independent queries in parallel
  const [
    profileRes,
    myRankRes,
    matchScoresRes,
    teamsRes,
    captainRes,
    selectionsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("season_leaderboard").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_match_scores").select("*, match:matches(match_number, team_home_id, team_away_id, start_time)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("teams").select("id, short_name, color, logo_url").limit(20),
    supabase.from("selections").select("match_id, captain_id, vice_captain_id, captain:players!selections_captain_id_fkey(name), vc:players!selections_vice_captain_id_fkey(name)").eq("user_id", user.id).limit(200),
    supabase.from("selections").select("id").eq("user_id", user.id).limit(200),
  ])

  const profile = profileRes.data
  const myRank = myRankRes.data
  const matchScores = matchScoresRes.data
  const teamMap = new Map(teamsRes.data?.map((t) => [t.id, t]) ?? [])
  const captainData = captainRes.data
  const selectionIds = (selectionsRes.data ?? []).map((s) => s.id)

  // Phase 2: role counts — depends on selectionIds
  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  if (selectionIds.length > 0) {
    const { data: selPlayers } = await supabase
      .from("selection_players")
      .select("player:players(role)")
      .in("selection_id", selectionIds)
      .limit(900)
    for (const sp of selPlayers ?? []) {
      const role = (sp.player as unknown as { role: string })?.role
      if (role && role in roleCounts) roleCounts[role as keyof typeof roleCounts]++
    }
  }

  // Best and worst match
  const sorted = [...(matchScores ?? [])].sort((a, b) => b.total_points - a.total_points)
  const bestMatch = sorted[0] ?? null
  const worstMatch = sorted.length > 1 ? sorted[sorted.length - 1] : null
  const totalPicks = Object.values(roleCounts).reduce((a, b) => a + b, 0)

  const captainCounts = new Map<string, { name: string; count: number }>()
  for (const s of captainData ?? []) {
    const name = (s.captain as unknown as { name: string })?.name ?? "Unknown"
    const id = s.captain_id!
    const existing = captainCounts.get(id)
    if (existing) existing.count++
    else captainCounts.set(id, { name, count: 1 })
  }
  const favCaptain = captainCounts.size > 0
    ? Array.from(captainCounts.values()).sort((a, b) => b.count - a.count)[0]
    : null

  const matchCaptainMap = new Map<string, { captainName: string; vcName: string }>()
  for (const s of captainData ?? []) {
    const captainName = (s.captain as unknown as { name: string })?.name
    const vcName = (s.vc as unknown as { name: string })?.name
    if (s.match_id && (captainName || vcName)) {
      matchCaptainMap.set(s.match_id, {
        captainName: captainName ?? "—",
        vcName: vcName ?? "—",
      })
    }
  }

  const rankEntry = myRank as unknown as {
    season_rank: number; total_points: number
    matches_played: number; avg_points: number
    first_place_count: number; podium_count: number
  } | null

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      {/* ── Hero: avatar + name + rank + pts ──────────────────── */}
      <div className="relative flex items-center gap-5 py-4 px-4 -mx-4 md:-mx-6 md:px-6 mesh-gradient-bg-strong rounded-3xl">
        <div className={cn(
          "h-24 w-24 rounded-full flex items-center justify-center shrink-0 ring-2 shadow-lg",
          getAvatarColor(profile?.display_name ?? "U"),
          rankEntry?.season_rank === 1 ? "ring-accent shadow-[0_0_24px_oklch(0.78_0.17_86/0.4)]"
            : rankEntry?.season_rank === 2 ? "ring-[oklch(0.72_0.01_260)]"
            : rankEntry?.season_rank === 3 ? "ring-[oklch(0.63_0.10_55)]"
            : "ring-overlay-border-hover"
        )}>
          <span className="text-white text-3xl font-bold font-display">
            {getInitials(profile?.display_name ?? "U")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <ProfileNameForm currentName={profile?.display_name ?? ""} />
          <p className="text-2xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
          {rankEntry && (
            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              <div className="flex items-baseline gap-1">
                <span className="text-gold-stat text-3xl leading-none">#{rankEntry.season_rank}</span>
                <span className="text-2xs text-muted-foreground uppercase tracking-wider">Rank</span>
              </div>
              <span className="text-muted-foreground/40">·</span>
              <div className="flex items-baseline gap-1">
                <span className="text-gold-stat text-2xl leading-none">{rankEntry.total_points.toLocaleString()}</span>
                <span className="text-2xs text-muted-foreground uppercase tracking-wider">Pts</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Form strip: best / worst / avg / matches ──────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          value={bestMatch ? bestMatch.total_points : "\u2014"}
          label="Best Match"
          gradient="from-green-500/10"
          iconColor="bg-green-500/15 text-[var(--tw-green-text)]"
        />
        <StatCard
          icon={TrendingDown}
          value={worstMatch ? worstMatch.total_points : "\u2014"}
          label="Worst Match"
          gradient="from-red-500/10"
          iconColor="bg-red-500/15 text-red-500"
        />
        <StatCard
          icon={Target}
          value={rankEntry?.avg_points?.toFixed(1) ?? "\u2014"}
          label="Avg / Match"
          gradient="from-primary/10"
          iconColor="bg-primary/15 text-primary"
        />
        <StatCard
          icon={Trophy}
          value={String(rankEntry?.matches_played ?? 0)}
          label="Matches"
          gradient="from-amber-500/10"
          iconColor="bg-accent/15 text-accent"
        />
      </div>

      {/* Auto-pick backup */}
      <AutoPickToggle enabled={profile?.auto_pick_enabled ?? false} />

      {/* Desktop 2-column layout for detail cards */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
      <div className="space-y-6">
      {/* Extra stats */}
      <Card className="glass">
        <CardContent className="pt-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Matches Played</span>
            <span className="font-medium">{rankEntry?.matches_played ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg Points / Match</span>
            <span className="font-medium">{rankEntry?.avg_points?.toFixed(1) ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">1st Place Finishes</span>
            <span className="font-medium">{rankEntry?.first_place_count ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Podium Finishes</span>
            <span className="font-medium">{rankEntry?.podium_count ?? 0}</span>
          </div>
          {favCaptain && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Favorite Captain</span>
              <span className="font-medium">{favCaptain.name} ({favCaptain.count}x)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Sparkline */}
      {matchScores && matchScores.length >= 2 && (() => {
        const sparkMatches = [...matchScores].reverse().slice(-10)
        const points = sparkMatches.map((ms) => ms.total_points)
        const maxPts = Math.max(...points, 1)
        const avg = points.reduce((a, b) => a + b, 0) / points.length
        const stdDev = Math.sqrt(points.reduce((sum, p) => sum + (p - avg) ** 2, 0) / points.length)
        const cv = avg > 0 ? stdDev / avg : 0
        const consistencyLabel = cv < 0.15 ? "Very Consistent" : cv < 0.3 ? "Consistent" : cv < 0.5 ? "Variable" : "Unpredictable"
        const consistencyColor = cv < 0.15 ? "text-[var(--tw-green-text)]" : cv < 0.3 ? "text-[var(--tw-blue-text)]" : cv < 0.5 ? "text-[var(--tw-amber-text)]" : "text-[var(--tw-red-text)]"

        // Streaks
        const ranks = [...matchScores].reverse().map((ms) => ms.rank ?? 999)
        let currentStreak = 0
        let longestStreak = 0
        let streak = 0
        for (const r of ranks) {
          if (r <= 3) { streak++; longestStreak = Math.max(longestStreak, streak) }
          else streak = 0
        }
        currentStreak = streak

        return (
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sparkline */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Last {points.length} matches</p>
                <div className="flex items-end gap-1 h-24">
                  {sparkMatches.map((ms) => (
                    <div key={ms.match_id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] text-muted-foreground">{ms.total_points}</span>
                      <div
                        className="w-full rounded-t-sm bg-gradient-to-t from-primary/50 to-primary min-h-[2px]"
                        style={{ height: `${(ms.total_points / maxPts) * 80}px` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Consistency + Streaks */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Consistency</span>
                  <span className={`font-semibold ${consistencyColor}`}>{consistencyLabel}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Avg Points</span>
                  <span className="font-semibold">{avg.toFixed(1)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Current Top-3 Streak</span>
                  <span className="font-semibold">{currentStreak} {currentStreak === 1 ? "match" : "matches"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Best Top-3 Streak</span>
                  <span className="font-semibold">{longestStreak} {longestStreak === 1 ? "match" : "matches"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Rank Progression */}
      {matchScores && matchScores.length >= 2 && (() => {
        const sorted = [...matchScores].reverse().filter((ms) => (ms.rank ?? 999) < 999)
        const ranks = sorted.map((ms) => ms.rank!)
        if (ranks.length < 2) return null

        // Match number helper
        const matchNum = (i: number) =>
          (sorted[i]?.match as unknown as { match_number: number })?.match_number ?? (i + 1)

        // Current streak — count consecutive same-rank matches from the end
        const currentRank = ranks[ranks.length - 1]
        let currentStreak = 1
        for (let i = ranks.length - 2; i >= 0; i--) {
          if (ranks[i] === currentRank) currentStreak++
          else break
        }

        // Helper: longest consecutive run matching a predicate, with bounds
        const longestRun = (pred: (r: number) => boolean) => {
          let best = 0, bestStart = -1, bestEnd = -1
          let cur = 0, curStart = 0
          for (let i = 0; i < ranks.length; i++) {
            if (pred(ranks[i])) {
              if (cur === 0) curStart = i
              cur++
              if (cur > best) { best = cur; bestStart = curStart; bestEnd = i }
            } else {
              cur = 0
            }
          }
          return { length: best, startIdx: bestStart, endIdx: bestEnd }
        }

        const winRun = longestRun((r) => r === 1)
        const podiumRun = longestRun((r) => r <= 3)
        const worstRun = longestRun((r) => r >= 4)

        // Last-5 average with trend direction
        const last5 = ranks.slice(-5)
        const last5Avg = last5.reduce((a, b) => a + b, 0) / last5.length
        const seasonAvg = ranks.reduce((a, b) => a + b, 0) / ranks.length
        const last5Delta = last5Avg - seasonAvg

        // Rank distribution: count how often each rank was achieved
        const distribution = new Map<number, number>()
        for (const r of ranks) distribution.set(r, (distribution.get(r) ?? 0) + 1)
        const distRows = Array.from(distribution.entries())
          .map(([rank, count]) => ({ rank, count, pct: (count / ranks.length) * 100 }))
          .sort((a, b) => a.rank - b.rank)
        const maxCount = Math.max(...distRows.map((d) => d.count))

        // Summary stats
        const avgRank = seasonAvg.toFixed(1)
        const bestRank = Math.min(...ranks)
        const latestRank = ranks[ranks.length - 1]
        const podiumCount = ranks.filter((r) => r <= 3).length
        const podiumPct = ((podiumCount / ranks.length) * 100).toFixed(0)
        const winCount = ranks.filter((r) => r === 1).length

        // Color coding for rank buckets
        const rankRowColor = (r: number) =>
          r === 1 ? "bg-emerald-500"
          : r <= 3 ? "bg-blue-500"
          : r <= 5 ? "bg-amber-500"
          : "bg-red-500"

        return (
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rank Progression</CardTitle>
              <p className="text-xs text-muted-foreground">{ranks.length} matches · {winCount} win{winCount !== 1 ? "s" : ""} · {podiumPct}% podium rate</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Match History Tiles */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Match History
                </p>
                <div className="flex flex-wrap gap-1">
                  {ranks.map((r, i) => {
                    const mNum = matchNum(i)
                    const isLatest = i === ranks.length - 1
                    return (
                      <div
                        key={`${sorted[i].match_id}-${i}`}
                        title={`M${mNum} · #${r}`}
                        className={cn(
                          "text-[10px] font-bold font-mono w-8 h-8 rounded flex items-center justify-center text-white shrink-0",
                          rankRowColor(r),
                          isLatest && "ring-2 ring-foreground/40"
                        )}
                      >
                        #{r}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Streaks & Trends */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Streaks & Trends
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current streak</span>
                    <span className="font-mono tabular-nums">
                      {currentStreak}× at #{currentRank}
                    </span>
                  </div>
                  {winRun.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Longest win streak</span>
                      <span className="font-mono tabular-nums">
                        {winRun.length}× #1{" "}
                        <span className="text-muted-foreground">
                          (M{matchNum(winRun.startIdx)}{winRun.length > 1 ? `–M${matchNum(winRun.endIdx)}` : ""})
                        </span>
                      </span>
                    </div>
                  )}
                  {podiumRun.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Longest podium run</span>
                      <span className="font-mono tabular-nums">
                        {podiumRun.length}× top-3{" "}
                        <span className="text-muted-foreground">
                          (M{matchNum(podiumRun.startIdx)}{podiumRun.length > 1 ? `–M${matchNum(podiumRun.endIdx)}` : ""})
                        </span>
                      </span>
                    </div>
                  )}
                  {worstRun.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Worst run</span>
                      <span className="font-mono tabular-nums">
                        {worstRun.length}× #4+{" "}
                        <span className="text-muted-foreground">
                          (M{matchNum(worstRun.startIdx)}{worstRun.length > 1 ? `–M${matchNum(worstRun.endIdx)}` : ""})
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last 5 avg</span>
                    <span className="font-mono tabular-nums">
                      #{last5Avg.toFixed(1)}
                      <span className={cn(
                        "ml-2",
                        last5Delta < -0.05 ? "text-emerald-500"
                          : last5Delta > 0.05 ? "text-red-500"
                          : "text-muted-foreground"
                      )}>
                        {last5Delta < -0.05 ? "↑" : last5Delta > 0.05 ? "↓" : "="} {Math.abs(last5Delta).toFixed(1)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Rank Distribution Table */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Distribution</p>
                <div className="space-y-1">
                  {distRows.map((d) => (
                    <div key={d.rank} className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold w-8 tabular-nums">#{d.rank}</span>
                      <span className="font-mono w-10 text-muted-foreground tabular-nums">{d.count}×</span>
                      <div className="flex-1 h-4 bg-muted/40 rounded-sm overflow-hidden">
                        <div
                          className={cn("h-full rounded-sm transition-all", rankRowColor(d.rank))}
                          style={{ width: `${(d.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono w-10 text-right text-muted-foreground tabular-nums">{d.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-overlay-border">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Best</span>
                  <span className="font-semibold text-sm">#{bestRank}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Latest</span>
                  <span className="font-semibold text-sm">#{latestRank}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Avg</span>
                  <span className="font-semibold text-sm">#{avgRank}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Podium</span>
                  <span className="font-semibold text-sm">{podiumPct}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      </div>{/* end left detail column */}
      <div className="space-y-6">
      {/* Role Preferences */}
      {totalPicks > 0 && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Role Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(["WK", "BAT", "AR", "BOWL"] as const).map((role) => {
              const count = roleCounts[role]
              const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0
              const labels = { WK: "Wicket-Keepers", BAT: "Batters", AR: "All-Rounders", BOWL: "Bowlers" }
              return (
                <div key={role} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{labels[role]}</span>
                    <span className="font-medium">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Theme */}
      <ThemeCard />
      </div>{/* end right detail column */}
      </div>{/* end desktop detail grid */}

      {/* Match history */}
      {matchScores && matchScores.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Match History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matchScores.map((ms) => {
              const m = ms.match as unknown as {
                match_number: number; team_home_id: string
                team_away_id: string; start_time: string
              }
              const homeTeam = teamMap.get(m.team_home_id)
              const awayTeam = teamMap.get(m.team_away_id)
              const rank = ms.rank ?? 999

              return (
                <div
                  key={ms.id}
                  className="py-2.5 px-3 rounded-lg border-b border-overlay-border last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <RankBadge rank={rank} size="sm" />
                      <span className="text-[10px] text-muted-foreground font-mono">
                        #{m.match_number}
                      </span>
                      <div className="flex items-center gap-1">
                        {homeTeam && (
                          <TeamBadge shortName={homeTeam.short_name} color={homeTeam.color} logoUrl={homeTeam.logo_url} size="sm" />
                        )}
                        <span className="text-[10px] text-muted-foreground">vs</span>
                        {awayTeam && (
                          <TeamBadge shortName={awayTeam.short_name} color={awayTeam.color} logoUrl={awayTeam.logo_url} size="sm" />
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-sm font-display">{ms.total_points} pts</span>
                  </div>
                  {matchCaptainMap.has(ms.match_id) && (() => {
                    const { captainName, vcName } = matchCaptainMap.get(ms.match_id)!
                    return (
                      <div className="flex items-center gap-3 mt-1 ml-1 text-[10px] text-muted-foreground">
                        <span>👑 {captainName}</span>
                        <span>🥈 {vcName}</span>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Link href="/rules">
        <Card className="glass hover:bg-accent/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Rules & Scoring Guide</p>
                <p className="text-xs text-muted-foreground">How to play and points reference</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <SignOutButton />
    </div>
    </PageTransition>
  )
}

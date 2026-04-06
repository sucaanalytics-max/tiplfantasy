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
      .limit(600)
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
      {/* Hero section — rank-focused */}
      <div className="flex items-center gap-5 py-4">
        <div className={cn(
          "h-20 w-20 rounded-full flex items-center justify-center shrink-0 ring-2",
          getAvatarColor(profile?.display_name ?? "U"),
          rankEntry?.season_rank === 1 ? "ring-amber-400 glow-accent"
            : rankEntry?.season_rank === 2 ? "ring-gray-400"
            : rankEntry?.season_rank === 3 ? "ring-amber-600"
            : "ring-white/10"
        )}>
          <span className="text-white text-2xl font-bold font-display">
            {getInitials(profile?.display_name ?? "U")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <ProfileNameForm currentName={profile?.display_name ?? ""} />
          <p className="text-2xs text-muted-foreground mt-0.5">{user.email}</p>
          {rankEntry && (
            <div className="flex items-center gap-3 mt-2">
              <div>
                <span className="text-3xl font-bold font-display tabular-nums">#{rankEntry.season_rank}</span>
                <span className="text-2xs text-muted-foreground ml-1">Rank</span>
              </div>
              <div className="h-6 w-px bg-overlay-muted" />
              <div>
                <span className="text-xl font-bold font-display tabular-nums">{rankEntry.total_points}</span>
                <span className="text-2xs text-muted-foreground ml-1">Pts</span>
              </div>
              <div className="h-6 w-px bg-overlay-muted" />
              <div>
                <span className="text-xl font-bold font-display tabular-nums">{rankEntry.matches_played}</span>
                <span className="text-2xs text-muted-foreground ml-1">MP</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats — secondary tier */}
      <div className="grid grid-cols-3 gap-3">
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
        const maxRank = Math.max(...ranks)
        const displayMax = Math.max(maxRank + 1, 5)
        const width = 320
        const height = 140
        const padX = 28
        const padY = 16
        const padBottom = 24
        const chartW = width - padX * 2
        const chartH = height - padY - padBottom
        const points = ranks.map((r, i) => {
          const x = padX + (i / (ranks.length - 1)) * chartW
          const y = padY + ((r - 1) / (displayMax - 1)) * chartH
          return `${x},${y}`
        }).join(" ")
        const avgRank = (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)
        const bestRank = Math.min(...ranks)
        const latestRank = ranks[ranks.length - 1]

        // Gradient fill area points
        const firstPt = points.split(" ")[0]
        const lastPt = points.split(" ").at(-1)!
        const areaPoints = `${padX},${padY + chartH} ${points} ${lastPt.split(",")[0]},${padY + chartH}`

        // Color based on rank value (lower = better = greener)
        const rankColor = (r: number) => {
          if (r === 1) return "#22c55e"
          if (r <= 3) return "#3b82f6"
          return "#f59e0b"
        }

        return (
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rank Progression</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block w-full h-auto">
                  <defs>
                    <linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[1, Math.ceil(displayMax / 2), displayMax].map((r) => {
                    const y = padY + ((r - 1) / (displayMax - 1)) * chartH
                    return (
                      <g key={r}>
                        <line x1={padX} y1={y} x2={width - padX} y2={y}
                          stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="4 4" />
                        <text x={4} y={y + 4} fontSize={10} fill="currentColor" fillOpacity={0.5} fontFamily="monospace">#{r}</text>
                      </g>
                    )
                  })}
                  {/* Match labels on x-axis */}
                  {sorted.map((ms, i) => {
                    const x = padX + (i / (ranks.length - 1)) * chartW
                    const matchNum = (ms.match as unknown as { match_number: number })?.match_number
                    return matchNum ? (
                      <text key={ms.match_id} x={x} y={height - 4} fontSize={9} fill="currentColor" fillOpacity={0.4} textAnchor="middle">
                        M{matchNum}
                      </text>
                    ) : null
                  })}
                  {/* Area fill */}
                  <polygon points={areaPoints} fill="url(#rankFill)" />
                  {/* Line */}
                  <polyline
                    points={points}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* Dots */}
                  {ranks.map((r, i) => {
                    const x = padX + (i / (ranks.length - 1)) * chartW
                    const y = padY + ((r - 1) / (displayMax - 1)) * chartH
                    const isLatest = i === ranks.length - 1
                    const color = rankColor(r)
                    return (
                      <g key={sorted[i].match_id}>
                        <circle cx={x} cy={y} r={isLatest ? 6 : 4.5}
                          fill={color} stroke="hsl(var(--background))" strokeWidth={2} />
                        <text x={x} y={y - 8} fontSize={9} fill="currentColor" fillOpacity={0.7} textAnchor="middle" fontWeight="600">
                          #{r}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Best</span>
                  <span className="font-semibold">#{bestRank}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Latest</span>
                  <span className="font-semibold">#{latestRank}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Avg Rank</span>
                  <span className="font-semibold">#{avgRank}</span>
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

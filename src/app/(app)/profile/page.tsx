import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Target, TrendingUp, TrendingDown } from "lucide-react"
import { ProfileNameForm } from "./name-form"
import { SignOutButton } from "./sign-out-button"
import { ThemeCard } from "./theme-card"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Season stats
  const { data: myRank } = await supabase
    .from("season_leaderboard")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Match history
  const { data: matchScores } = await supabase
    .from("user_match_scores")
    .select("*, match:matches(match_number, team_home_id, team_away_id, start_time)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Get teams for display
  const { data: teams } = await supabase.from("teams").select("id, short_name, color")
  const teamMap = new Map(teams?.map((t) => [t.id, t]) ?? [])

  // Best and worst match
  const sorted = [...(matchScores ?? [])].sort((a, b) => b.total_points - a.total_points)
  const bestMatch = sorted[0] ?? null
  const worstMatch = sorted.length > 1 ? sorted[sorted.length - 1] : null

  // Favorite captain (most used)
  const { data: captainData } = await supabase
    .from("selections")
    .select("captain_id, captain:players!selections_captain_id_fkey(name)")
    .eq("user_id", user.id)
    .not("captain_id", "is", null)

  // Role preferences
  const { data: selections } = await supabase
    .from("selections")
    .select("id")
    .eq("user_id", user.id)
  const selectionIds = (selections ?? []).map((s) => s.id)
  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  if (selectionIds.length > 0) {
    const { data: selPlayers } = await supabase
      .from("selection_players")
      .select("player:players(role)")
      .in("selection_id", selectionIds)
    for (const sp of selPlayers ?? []) {
      const role = (sp.player as unknown as { role: string })?.role
      if (role && role in roleCounts) roleCounts[role as keyof typeof roleCounts]++
    }
  }
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

  const rankEntry = myRank as unknown as {
    season_rank: number; total_points: number
    matches_played: number; avg_points: number
    first_place_count: number; podium_count: number
  } | null

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-0.5">Your account & stats</p>
      </div>

      {/* Name editor */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Display Name</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileNameForm currentName={profile?.display_name ?? ""} />
          <p className="text-xs text-muted-foreground mt-2">{user.email}</p>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xl font-bold">{rankEntry ? `#${rankEntry.season_rank}` : "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Season Rank</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <Target className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{rankEntry?.total_points ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xl font-bold">
                  {bestMatch ? bestMatch.total_points : "\u2014"}
                </p>
                <p className="text-xs text-muted-foreground">Best Match</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xl font-bold">
                  {worstMatch ? worstMatch.total_points : "\u2014"}
                </p>
                <p className="text-xs text-muted-foreground">Worst Match</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop 2-column layout for detail cards */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
      <div className="space-y-6">
      {/* Extra stats */}
      <Card className="border border-border">
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
        const points = [...matchScores].reverse().slice(-10).map((ms) => ms.total_points)
        const maxPts = Math.max(...points, 1)
        const avg = points.reduce((a, b) => a + b, 0) / points.length
        const stdDev = Math.sqrt(points.reduce((sum, p) => sum + (p - avg) ** 2, 0) / points.length)
        const cv = avg > 0 ? stdDev / avg : 0
        const consistencyLabel = cv < 0.15 ? "Very Consistent" : cv < 0.3 ? "Consistent" : cv < 0.5 ? "Variable" : "Unpredictable"
        const consistencyColor = cv < 0.15 ? "text-green-500" : cv < 0.3 ? "text-emerald-400" : cv < 0.5 ? "text-amber-400" : "text-red-400"

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
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sparkline */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Last {points.length} matches</p>
                <div className="flex items-end gap-1 h-16">
                  {points.map((p, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] text-muted-foreground">{p}</span>
                      <div
                        className="w-full rounded-t-sm bg-primary/70 min-h-[2px]"
                        style={{ height: `${(p / maxPts) * 48}px` }}
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

      </div>{/* end left detail column */}
      <div className="space-y-6">
      {/* Role Preferences */}
      {totalPicks > 0 && (
        <Card className="border border-border">
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
        <Card className="border border-border">
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

              return (
                <div
                  key={ms.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      #{m.match_number}
                    </span>
                    <span className="text-sm">
                      <span style={{ color: homeTeam?.color }}>{homeTeam?.short_name}</span>
                      {" vs "}
                      <span style={{ color: awayTeam?.color }}>{awayTeam?.short_name}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{ms.rank ?? "\u2014"}
                    </Badge>
                    <span className="font-semibold text-sm w-10 text-right">{ms.total_points}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <SignOutButton />
    </div>
  )
}

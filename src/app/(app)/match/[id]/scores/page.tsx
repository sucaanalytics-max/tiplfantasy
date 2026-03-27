import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trophy } from "lucide-react"
import { RankBadge } from "@/components/rank-badge"
import { Podium } from "@/components/podium"
import { TeamLogo } from "@/components/team-logo"
import { EmptyState } from "@/components/empty-state"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { PageTransition } from "@/components/page-transition"
import { CricketBall } from "@/components/icons/cricket-ball"

export default async function ScoresPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()

  // Match with teams
  const { data: match } = await admin
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(short_name, color, logo_url)")
    .eq("id", id)
    .single()

  if (!match) redirect("/matches")

  const home = match.team_home as unknown as { short_name: string; color: string; logo_url: string | null }
  const away = match.team_away as unknown as { short_name: string; color: string; logo_url: string | null }

  // Player scores with player + team info
  const { data: playerScores } = await admin
    .from("match_player_scores")
    .select("*, player:players(name, role, team_id, team:teams(short_name, color))")
    .eq("match_id", id)
    .order("fantasy_points", { ascending: false })
    .limit(50)

  // User scores with profiles
  const { data: userScores } = await admin
    .from("user_match_scores")
    .select("*, profile:profiles(display_name)")
    .eq("match_id", id)
    .order("rank", { ascending: true })
    .limit(200)

  const myScore = userScores?.find((s) => s.user_id === user.id) ?? null

  // Get user's own selection for this match
  const { data: mySelection } = await supabase
    .from("selections")
    .select("captain_id, vice_captain_id")
    .eq("user_id", user.id)
    .eq("match_id", id)
    .single()

  // Fetch all users' captain picks for this match (for leaderboard)
  const { data: captainPicksData } = await admin
    .from("selections")
    .select("user_id, captain_id, captain:players!selections_captain_id_fkey(name)")
    .eq("match_id", id)
    .not("captain_id", "is", null)

  const captainPickMap = new Map<string, { name: string }>()
  for (const s of captainPicksData ?? []) {
    captainPickMap.set(s.user_id, {
      name: (s.captain as unknown as { name: string })?.name ?? "—",
    })
  }

  // Build podium entries from top 3
  const podiumEntries = userScores && userScores.length >= 3
    ? userScores.slice(0, 3).map((s, i) => ({
        name: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
        points: s.total_points,
        rank: i + 1,
        isCurrentUser: s.user_id === user.id,
      }))
    : null

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header with team gradient */}
      <div
        className="flex items-center gap-3 p-4 -mx-4 -mt-4 md:-mx-6 md:-mt-6 rounded-b-[24px]"
        style={{
          background: `linear-gradient(to right, ${home.color}10, transparent 40%, transparent 60%, ${away.color}10)`,
        }}
      >
        <Link href="/matches">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight font-display">
            Match #{match.match_number} Scores
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <TeamLogo team={home} size="md" />
            <span className="text-xs font-bold text-muted-foreground">VS</span>
            <TeamLogo team={away} size="md" />
          </div>
        </div>
      </div>

      {match.result_summary && (
        <div className="text-sm text-muted-foreground bg-secondary border border-border rounded-lg px-4 py-3">
          {match.result_summary}
        </div>
      )}

      {/* Your Match Score — Hero Section */}
      {myScore && (
        <Card className="border border-border overflow-hidden relative bg-gradient-to-br from-primary/8 via-transparent to-transparent">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/15 p-2.5 shrink-0">
                  <CricketBall className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Your Match Points</p>
                  <p className="text-3xl font-bold font-display animate-count-up">
                    {myScore.total_points}
                  </p>
                  {/* Score breakdown */}
                  {(myScore.captain_points > 0 || myScore.vc_points > 0) && (() => {
                    const basePoints = myScore.total_points - myScore.captain_points - myScore.vc_points
                    return (
                      <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                        <p>Base: {basePoints} pts</p>
                        {myScore.captain_points > 0 && <p>Captain (2×): +{myScore.captain_points}</p>}
                        {myScore.vc_points > 0 && <p>VC (1.5×): +{myScore.vc_points}</p>}
                      </div>
                    )
                  })()}
                </div>
              </div>
              {myScore.rank != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Rank</p>
                  <RankBadge rank={myScore.rank} size="lg" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score breakdown bars — only show if we have breakdown data */}
      {myScore?.breakdown && (() => {
        const breakdownMap = myScore.breakdown as Record<string, number>
        const playerScoreList = Object.entries(breakdownMap)
          .map(([playerId, pts]) => {
            const ps = playerScores?.find(p => p.player_id === playerId)
            const player = ps?.player as unknown as { name: string; role: string } | undefined
            return {
              playerId,
              name: player?.name ?? "Unknown",
              role: player?.role ?? "—",
              points: pts,
            }
          })
          .filter(p => p.points > 0)
          .sort((a, b) => b.points - a.points)

        if (playerScoreList.length === 0) return null
        const maxPts = playerScoreList[0].points

        return (
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {playerScoreList.map(({ playerId, name, role, points }) => (
                <div key={playerId} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-mono w-10 shrink-0">{role}</span>
                      <span className="font-medium truncate max-w-[140px]">{name}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{points} pts</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${(points / maxPts) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })()}

      {/* Match Leaderboard */}
      {userScores && userScores.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Match Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Podium for top 3 */}
            {podiumEntries && <Podium entries={podiumEntries} />}

            {/* Remaining rows */}
            <div className="space-y-2 mt-2">
              {userScores.slice(podiumEntries ? 3 : 0).map((s, i) => {
                const profile = s.profile as unknown as { display_name: string }
                const isMe = s.user_id === user.id
                const rank = s.rank ?? (podiumEntries ? i + 4 : i + 1)

                return (
                  <div
                    key={s.user_id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg animate-slide-up border-b border-border/30 last:border-b-0 ${
                      isMe ? "bg-primary/10 border border-primary/20" : ""
                    }`}
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <RankBadge rank={rank} size="sm" />
                      <div className={`h-7 w-7 rounded-full ${getAvatarColor(profile?.display_name ?? "U")} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-semibold">{getInitials(profile?.display_name ?? "U")}</span>
                      </div>
                      <div>
                        <span className={`text-sm ${isMe ? "font-semibold" : ""}`}>
                          {profile?.display_name ?? "Unknown"}
                          {isMe && " (you)"}
                        </span>
                        {captainPickMap.has(s.user_id) && (
                          <div className="text-[10px] text-muted-foreground">
                            👑 {captainPickMap.get(s.user_id)?.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {s.captain_points > 0 && (
                        <span className="text-muted-foreground text-xs">C: +{s.captain_points}</span>
                      )}
                      {s.vc_points > 0 && (
                        <span className="text-muted-foreground text-xs">VC: +{s.vc_points}</span>
                      )}
                      <span className="font-bold text-lg font-display animate-count-up">{s.total_points}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Score Breakdown */}
      {playerScores && playerScores.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Player Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile card layout */}
            <div className="space-y-2 lg:hidden">
              {playerScores.map((ps) => {
                const player = ps.player as unknown as {
                  name: string
                  role: string
                  team_id: string
                  team: { short_name: string; color: string }
                }
                const isCaptain = mySelection?.captain_id === ps.player_id
                const isVC = mySelection?.vice_captain_id === ps.player_id
                const multiplier = isCaptain ? 2 : isVC ? 1.5 : 1

                const roleAccent = { WK: "border-l-[3px] border-l-amber-400", BAT: "border-l-[3px] border-l-blue-400", AR: "border-l-[3px] border-l-emerald-400", BOWL: "border-l-[3px] border-l-purple-400" }
                const roleBorder = roleAccent[player.role as keyof typeof roleAccent] ?? "border-l-[3px] border-l-border"
                return (
                  <div key={ps.id} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg bg-secondary/50 ${roleBorder}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{player.name}</span>
                        {isCaptain && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                            C
                          </Badge>
                        )}
                        {isVC && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-gray-600/10 text-gray-400 border-gray-600/20">
                            VC
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {ps.runs > 0 && <span>{ps.runs}r ({ps.balls_faced}b)</span>}
                        {ps.wickets > 0 && <span>{ps.wickets}w</span>}
                        {(ps.catches + ps.stumpings + ps.run_outs) > 0 && (
                          <span>{ps.catches + ps.stumpings + ps.run_outs}c</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold font-display">{ps.fantasy_points}</span>
                      {multiplier > 1 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({multiplier}x)
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table layout */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Player</th>
                    <th className="text-center py-2 px-1 font-medium">R</th>
                    <th className="text-center py-2 px-1 font-medium">B</th>
                    <th className="text-center py-2 px-1 font-medium">4s</th>
                    <th className="text-center py-2 px-1 font-medium">6s</th>
                    <th className="text-center py-2 px-1 font-medium">W</th>
                    <th className="text-center py-2 px-1 font-medium">Ov</th>
                    <th className="text-center py-2 px-1 font-medium">C</th>
                    <th className="text-right py-2 px-2 font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {playerScores.map((ps) => {
                    const player = ps.player as unknown as {
                      name: string
                      role: string
                      team_id: string
                      team: { short_name: string; color: string }
                    }
                    const isCaptain = mySelection?.captain_id === ps.player_id
                    const isVC = mySelection?.vice_captain_id === ps.player_id
                    const multiplier = isCaptain ? 2 : isVC ? 1.5 : 1

                    return (
                      <tr key={ps.id} className="border-b border-border/50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-1 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: player.team?.color }}
                            />
                            <span className="truncate max-w-[100px]">{player.name}</span>
                            {isCaptain && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                                C
                              </Badge>
                            )}
                            {isVC && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-gray-600/10 text-gray-400 border-gray-600/20">
                                VC
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-2 px-1">{ps.runs}</td>
                        <td className="text-center py-2 px-1">{ps.balls_faced}</td>
                        <td className="text-center py-2 px-1">{ps.fours}</td>
                        <td className="text-center py-2 px-1">{ps.sixes}</td>
                        <td className="text-center py-2 px-1">{ps.wickets}</td>
                        <td className="text-center py-2 px-1">{ps.overs_bowled}</td>
                        <td className="text-center py-2 px-1">{ps.catches}</td>
                        <td className="text-right py-2 px-2">
                          <span className="font-semibold">{ps.fantasy_points}</span>
                          {multiplier > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({multiplier}x)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(!playerScores || playerScores.length === 0) && (
        <Card className="border border-border">
          <CardContent>
            <EmptyState
              icon={Trophy}
              title="Scores not yet available"
              description="Check back after the match is completed and scores are published"
              action={{ label: "Back to Matches", href: "/matches" }}
            />
          </CardContent>
        </Card>
      )}
    </div>
    </PageTransition>
  )
}

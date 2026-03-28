import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trophy } from "lucide-react"
import { RankBadge } from "@/components/rank-badge"
import { TeamLogo } from "@/components/team-logo"
import { EmptyState } from "@/components/empty-state"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { PageTransition } from "@/components/page-transition"
import { CricketBall } from "@/components/icons/cricket-ball"
import { LiveRefresher } from "@/components/live-refresher"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { MatchLeaderboard } from "@/components/match-leaderboard"

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

  // Get user's own selection with player IDs
  const { data: mySelection } = await supabase
    .from("selections")
    .select("captain_id, vice_captain_id, selection_players(player_id)")
    .eq("user_id", user.id)
    .eq("match_id", id)
    .single()

  const myPlayerIds = new Set(
    (mySelection?.selection_players as { player_id: string }[] | undefined)?.map((sp) => sp.player_id) ?? []
  )

  // Fetch ALL users' selections for the expandable leaderboard
  const { data: allSelectionsRaw } = await admin
    .from("selections")
    .select("user_id, captain_id, vice_captain_id, selection_players(player_id)")
    .eq("match_id", id)

  const allSelections = (allSelectionsRaw ?? []).map((s) => ({
    user_id: s.user_id,
    captain_id: s.captain_id as string | null,
    vice_captain_id: s.vice_captain_id as string | null,
    player_ids: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
  }))

  // Captain picks for leaderboard display
  const { data: captainPicksData } = await admin
    .from("selections")
    .select("user_id, captain_id, captain:players!selections_captain_id_fkey(name)")
    .eq("match_id", id)
    .not("captain_id", "is", null)

  const captainPicks: Record<string, { name: string }> = {}
  for (const s of captainPicksData ?? []) {
    captainPicks[s.user_id] = {
      name: (s.captain as unknown as { name: string })?.name ?? "—",
    }
  }

  // Build podium entries from top 3
  const podiumEntries = userScores && userScores.length >= 3
    ? userScores.slice(0, 3).map((s, i) => ({
        name: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
        points: s.total_points,
        rank: i + 1,
        isCurrentUser: s.user_id === user.id,
      }))
    : undefined

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

      {match.status === "live" && <LiveRefresher interval={30000} />}

      {match.status === "live" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm bg-red-500/10 border border-red-500/20 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span>LIVE — Points update every ~5 min. Provisional until match ends.</span>
          </div>
          {match.cricapi_match_id && (
            <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Live Score</p>
              <div className="text-sm">
                <LiveScoreWidget
                  cricapiMatchId={match.cricapi_match_id}
                  startTime={match.start_time}
                />
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Your Selected XI — show all 11 players with individual points and stats */}
      {mySelection && playerScores && playerScores.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Selected XI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const roleAccent: Record<string, string> = {
                WK: "border-l-[3px] border-l-amber-400",
                BAT: "border-l-[3px] border-l-blue-400",
                AR: "border-l-[3px] border-l-emerald-400",
                BOWL: "border-l-[3px] border-l-purple-400",
              }

              // Get player scores for the user's 11, sorted by points
              const myPlayers = (playerScores ?? [])
                .filter((ps) => myPlayerIds.has(ps.player_id))
                .sort((a, b) => Number(b.fantasy_points) - Number(a.fantasy_points))

              return myPlayers.map((ps) => {
                const player = ps.player as unknown as {
                  name: string
                  role: string
                  team: { short_name: string; color: string }
                }
                const isCaptain = mySelection.captain_id === ps.player_id
                const isVC = mySelection.vice_captain_id === ps.player_id
                const multiplier = isCaptain ? 2 : isVC ? 1.5 : 1
                const basePoints = Number(ps.fantasy_points)
                const effectivePoints = Math.round(basePoints * multiplier * 100) / 100
                const roleBorder = roleAccent[player.role] ?? "border-l-[3px] border-l-border"

                return (
                  <div key={ps.player_id} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg bg-secondary/50 ${roleBorder}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{player.name}</span>
                        {isCaptain && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                            C
                          </Badge>
                        )}
                        {isVC && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-sky-500/10 text-sky-400 border-sky-500/20">
                            VC
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {(ps.runs > 0 || ps.balls_faced > 0) && <span>{ps.runs}({ps.balls_faced})</span>}
                        {ps.fours > 0 && <span>{ps.fours}×4</span>}
                        {ps.sixes > 0 && <span>{ps.sixes}×6</span>}
                        {Number(ps.overs_bowled) > 0 && <span>{ps.wickets}/{ps.runs_conceded} ({ps.overs_bowled} ov)</span>}
                        {(ps.catches + ps.stumpings + ps.run_outs) > 0 && (
                          <span>
                            {ps.catches > 0 && `${ps.catches}c`}
                            {ps.stumpings > 0 && ` ${ps.stumpings}st`}
                            {ps.run_outs > 0 && ` ${ps.run_outs}ro`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold font-display">{multiplier > 1 ? effectivePoints : basePoints}</span>
                      {multiplier > 1 && (
                        <p className="text-[10px] text-muted-foreground">
                          {basePoints} × {multiplier}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </CardContent>
        </Card>
      )}

      {/* Match Leaderboard — expandable rows */}
      {userScores && userScores.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Match Leaderboard</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Tap a player to see their XI</p>
          </CardHeader>
          <CardContent>
            <MatchLeaderboard
              userScores={userScores.map((s) => ({
                user_id: s.user_id,
                total_points: s.total_points,
                rank: s.rank,
                captain_points: s.captain_points,
                vc_points: s.vc_points,
                profile: s.profile as unknown as { display_name: string },
              }))}
              playerScores={(playerScores ?? []).map((ps) => ({
                player_id: ps.player_id,
                fantasy_points: ps.fantasy_points,
                runs: ps.runs,
                balls_faced: ps.balls_faced,
                fours: ps.fours,
                sixes: ps.sixes,
                wickets: ps.wickets,
                overs_bowled: ps.overs_bowled,
                runs_conceded: ps.runs_conceded,
                catches: ps.catches,
                stumpings: ps.stumpings,
                run_outs: ps.run_outs,
                player: ps.player as unknown as { name: string; role: string; team: { short_name: string; color: string } },
              }))}
              allSelections={allSelections}
              currentUserId={user.id}
              captainPicks={captainPicks}
              podiumEntries={podiumEntries}
            />
          </CardContent>
        </Card>
      )}

      {/* Full Player Breakdown — all players in the match */}
      {playerScores && playerScores.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {playerScores.map((ps) => {
                const player = ps.player as unknown as {
                  name: string
                  role: string
                  team_id: string
                  team: { short_name: string; color: string }
                }
                const isCaptain = mySelection?.captain_id === ps.player_id
                const isVC = mySelection?.vice_captain_id === ps.player_id
                const isMyPick = myPlayerIds.has(ps.player_id)
                const multiplier = isCaptain ? 2 : isVC ? 1.5 : 1

                const roleAccent: Record<string, string> = { WK: "border-l-[3px] border-l-amber-400", BAT: "border-l-[3px] border-l-blue-400", AR: "border-l-[3px] border-l-emerald-400", BOWL: "border-l-[3px] border-l-purple-400" }
                const roleBorder = roleAccent[player.role as keyof typeof roleAccent] ?? "border-l-[3px] border-l-border"
                return (
                  <div key={ps.id} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg ${roleBorder} ${isMyPick ? "bg-primary/5 border border-primary/10" : "bg-secondary/50"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{player.name}</span>
                        {isCaptain && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                            C
                          </Badge>
                        )}
                        {isVC && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-sky-500/10 text-sky-400 border-sky-500/20">
                            VC
                          </Badge>
                        )}
                        {isMyPick && !isCaptain && !isVC && (
                          <span className="text-[9px] text-primary/60">●</span>
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
          </CardContent>
        </Card>
      )}

      {(!playerScores || playerScores.length === 0) && (
        <Card className="border border-border">
          <CardContent>
            <EmptyState
              icon={Trophy}
              title={match.status === "live" ? "Calculating live scores..." : "Scores not yet available"}
              description={
                match.status === "live"
                  ? "Fantasy points will appear here within 5 minutes of the match starting. This page refreshes automatically."
                  : "Check back after the match is completed and scores are published"
              }
              action={{ label: "Back to Matches", href: "/matches" }}
            />
          </CardContent>
        </Card>
      )}
    </div>
    </PageTransition>
  )
}

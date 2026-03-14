import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

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
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, color), team_away:teams!matches_team_away_id_fkey(short_name, color)")
    .eq("id", id)
    .single()

  if (!match) redirect("/matches")

  const home = match.team_home as unknown as { short_name: string; color: string }
  const away = match.team_away as unknown as { short_name: string; color: string }

  // Player scores with player + team info
  const { data: playerScores } = await admin
    .from("match_player_scores")
    .select("*, player:players(name, role, team_id, team:teams(short_name, color))")
    .eq("match_id", id)
    .order("fantasy_points", { ascending: false })

  // User scores with profiles
  const { data: userScores } = await admin
    .from("user_match_scores")
    .select("*, profile:profiles(display_name)")
    .eq("match_id", id)
    .order("rank", { ascending: true })

  // Get user's own selection for this match
  const { data: mySelection } = await supabase
    .from("selections")
    .select("captain_id, vice_captain_id")
    .eq("user_id", user.id)
    .eq("match_id", id)
    .single()

  const medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/matches">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Match #{match.match_number} Scores
          </h1>
          <p className="text-sm">
            <span style={{ color: home.color }}>{home.short_name}</span>
            {" vs "}
            <span style={{ color: away.color }}>{away.short_name}</span>
          </p>
        </div>
      </div>

      {match.result_summary && (
        <div className="text-sm text-muted-foreground bg-secondary border border-border rounded-lg px-4 py-3">
          {match.result_summary}
        </div>
      )}

      {/* Match Leaderboard */}
      {userScores && userScores.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Match Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userScores.map((s, i) => {
                const profile = s.profile as unknown as { display_name: string }
                const isMe = s.user_id === user.id
                const prefix =
                  i < 3
                    ? medals[i]
                    : i === userScores.length - 1 && userScores.length > 3
                    ? "\ud83e\udd44"
                    : `${s.rank ?? i + 1}.`

                return (
                  <div
                    key={s.user_id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
                      isMe ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-sm">{prefix}</span>
                      <span className={`text-sm ${isMe ? "font-semibold" : ""}`}>
                        {profile?.display_name ?? "Unknown"}
                        {isMe && " (you)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {s.captain_points > 0 && (
                        <span className="text-muted-foreground text-xs">C: +{s.captain_points}</span>
                      )}
                      {s.vc_points > 0 && (
                        <span className="text-muted-foreground text-xs">VC: +{s.vc_points}</span>
                      )}
                      <span className="font-bold text-lg">{s.total_points}</span>
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
          <CardContent className="overflow-x-auto">
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
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-500/10 text-blue-400 border-blue-500/20">
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
          </CardContent>
        </Card>
      )}

      {(!playerScores || playerScores.length === 0) && (
        <Card className="border border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Scores not yet available for this match.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

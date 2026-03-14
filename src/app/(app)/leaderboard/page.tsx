import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy } from "lucide-react"
import { getMyLeagues, getLeagueLeaderboard } from "@/actions/leagues"
import { LeaderboardSelector } from "./leaderboard-selector"

const avatarColors = [
  "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-orange-500"
]

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

type LeaderRow = {
  user_id: string
  display_name: string
  total_points: number
  rank: number
  matches_played?: number
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { league: leagueId } = await searchParams
  const myLeagues = await getMyLeagues()

  // Season leaderboard — either overall or league-specific
  let seasonRows: LeaderRow[] = []

  if (leagueId) {
    const leagueData = await getLeagueLeaderboard(leagueId)
    seasonRows = leagueData.map((e) => ({
      user_id: e.user_id,
      display_name: e.display_name,
      total_points: e.total_points,
      rank: e.season_rank,
      matches_played: e.matches_played,
    }))
  } else {
    const { data: seasonData } = await supabase
      .from("season_leaderboard")
      .select("*")
      .order("season_rank", { ascending: true })

    seasonRows = (seasonData ?? []).map((e) => {
      const entry = e as unknown as {
        user_id: string; display_name: string; total_points: number
        season_rank: number; matches_played: number
      }
      return {
        user_id: entry.user_id,
        display_name: entry.display_name,
        total_points: entry.total_points,
        rank: entry.season_rank,
        matches_played: entry.matches_played,
      }
    })
  }

  // Last two completed matches
  const { data: completedMatches } = await supabase
    .from("matches")
    .select("id, match_number")
    .eq("status", "completed")
    .order("start_time", { ascending: false })
    .limit(2)

  const lastMatch = completedMatches?.[0] ?? null
  const prevMatch = completedMatches?.[1] ?? null

  async function getMatchScores(matchId: string): Promise<LeaderRow[]> {
    if (leagueId) {
      // Filter match scores to league members
      const { data: members } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId)
      const memberIds = (members ?? []).map((m) => m.user_id)
      if (memberIds.length === 0) return []

      const { data } = await supabase
        .from("user_match_scores")
        .select("user_id, total_points, rank, profile:profiles(display_name)")
        .eq("match_id", matchId)
        .in("user_id", memberIds)
        .order("total_points", { ascending: false })

      return (data ?? []).map((s, i) => ({
        user_id: s.user_id,
        total_points: s.total_points,
        rank: i + 1,
        display_name: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
      }))
    }

    const { data } = await supabase
      .from("user_match_scores")
      .select("user_id, total_points, rank, profile:profiles(display_name)")
      .eq("match_id", matchId)
      .order("rank", { ascending: true })
    return (data ?? []).map((s) => ({
      user_id: s.user_id,
      total_points: s.total_points,
      rank: s.rank ?? 0,
      display_name: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
    }))
  }

  const thisWeekRows = lastMatch ? await getMatchScores(lastMatch.id) : []
  const lastWeekRows = prevMatch ? await getMatchScores(prevMatch.id) : []

  const medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"]

  function LeaderTable({ rows, showMP, showBanner }: { rows: LeaderRow[]; showMP?: boolean; showBanner?: boolean }) {
    if (rows.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
    }

    return (
      <div className="space-y-2">
        {showBanner && rows[0] && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 mb-4">
            <Trophy className="h-5 w-5 text-amber-500" />
            <div className={`h-7 w-7 rounded-full ${getAvatarColor(rows[0].display_name)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-xs font-semibold">{getInitials(rows[0].display_name)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-400">Manager of the Match</p>
              <p className="text-sm">{rows[0].display_name} &mdash; {rows[0].total_points} pts</p>
            </div>
          </div>
        )}

        <div className="flex items-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span className="w-10">#</span>
          <span className="flex-1">Name</span>
          {showMP && <span className="w-12 text-center">MP</span>}
          <span className="w-16 text-right">Points</span>
        </div>

        {rows.map((row, i) => {
          const isMe = row.user_id === user!.id
          return (
            <div
              key={row.user_id}
              className={`flex items-center py-2.5 px-3 rounded-lg ${
                isMe ? "bg-primary/10 border border-primary/20" : i % 2 === 0 ? "bg-secondary/50" : ""
              } ${i === 0 ? "border-l-2 border-l-amber-400" : i === 1 ? "border-l-2 border-l-gray-300" : i === 2 ? "border-l-2 border-l-amber-700" : ""}`}
            >
              <span className="w-10 text-sm">
                {i < 3 ? medals[i] : row.rank}
              </span>
              <div className={`flex-1 flex items-center gap-2 text-sm ${isMe ? "font-semibold" : ""}`}>
                <div className={`h-7 w-7 rounded-full ${getAvatarColor(row.display_name)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-semibold">{getInitials(row.display_name)}</span>
                </div>
                <span>
                  {row.display_name}
                  {isMe && " (you)"}
                </span>
              </div>
              {showMP && (
                <span className="w-12 text-center text-sm text-muted-foreground">
                  {row.matches_played ?? 0}
                </span>
              )}
              <span className="w-16 text-right font-semibold text-sm">{row.total_points}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground mt-0.5">Fantasy rankings</p>
        </div>
        {myLeagues.length > 0 && (
          <LeaderboardSelector
            leagues={myLeagues.map((l) => ({ id: l.id, name: l.name }))}
            currentLeagueId={leagueId ?? null}
          />
        )}
      </div>

      <Tabs defaultValue="season">
        <TabsList className="w-full">
          <TabsTrigger value="season" className="flex-1">Season</TabsTrigger>
          <TabsTrigger value="this-week" className="flex-1">
            {lastMatch ? `Match #${lastMatch.match_number}` : "Latest"}
          </TabsTrigger>
          <TabsTrigger value="last-week" className="flex-1">
            {prevMatch ? `Match #${prevMatch.match_number}` : "Previous"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="season" className="mt-4">
          <Card className="border border-border">
            <CardContent className="pt-4">
              <LeaderTable rows={seasonRows} showMP />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="this-week" className="mt-4">
          <Card className="border border-border">
            <CardContent className="pt-4">
              <LeaderTable rows={thisWeekRows} showBanner />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="last-week" className="mt-4">
          <Card className="border border-border">
            <CardContent className="pt-4">
              <LeaderTable rows={lastWeekRows} showBanner />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

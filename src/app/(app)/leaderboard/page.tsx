import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy as TrophyIcon } from "lucide-react"
import { Trophy } from "@/components/icons/trophy"
import { getMyLeagues, getLeagueLeaderboard } from "@/actions/leagues"
import { LeaderboardSelector } from "./leaderboard-selector"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { RankBadge } from "@/components/rank-badge"
import { Podium } from "@/components/podium"
import { EmptyState } from "@/components/empty-state"
import { PageTransition } from "@/components/page-transition"

type LeaderRow = {
  user_id: string
  display_name: string
  total_points: number
  rank: number
  matches_played?: number
  avg_points?: number
  podium_count?: number
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
      .limit(500)

    seasonRows = (seasonData ?? []).map((e) => {
      const entry = e as unknown as {
        user_id: string; display_name: string; total_points: number
        season_rank: number; matches_played: number; avg_points: number; podium_count: number
      }
      return {
        user_id: entry.user_id,
        display_name: entry.display_name,
        total_points: entry.total_points,
        rank: entry.season_rank,
        matches_played: entry.matches_played,
        avg_points: entry.avg_points,
        podium_count: entry.podium_count,
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
      const { data: members } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId)
        .limit(200)
      const memberIds = (members ?? []).map((m) => m.user_id)
      if (memberIds.length === 0) return []

      const { data } = await supabase
        .from("user_match_scores")
        .select("user_id, total_points, rank, profile:profiles(display_name)")
        .eq("match_id", matchId)
        .in("user_id", memberIds)
        .order("total_points", { ascending: false })
        .limit(200)

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
      .limit(200)
    return (data ?? []).map((s) => ({
      user_id: s.user_id,
      total_points: s.total_points,
      rank: s.rank ?? 0,
      display_name: (s.profile as unknown as { display_name: string })?.display_name ?? "Unknown",
    }))
  }

  const [thisWeekRows, lastWeekRows] = await Promise.all([
    lastMatch ? getMatchScores(lastMatch.id) : Promise.resolve([]),
    prevMatch ? getMatchScores(prevMatch.id) : Promise.resolve([]),
  ])

  const seasonRankMap = new Map(seasonRows.map((r) => [r.user_id, r.rank]))

  function LeaderTable({
    rows,
    showMP,
    showBanner,
    showPodium,
    seasonRankMap,
    showConsistency,
  }: {
    rows: LeaderRow[]
    showMP?: boolean
    showBanner?: boolean
    showPodium?: boolean
    seasonRankMap?: Map<string, number>
    showConsistency?: boolean
  }) {
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={TrophyIcon}
          title="No data yet"
          description="Rankings will appear after the first match"
        />
      )
    }

    const podiumEntries = showPodium && rows.length >= 3
      ? rows.slice(0, 3).map((r) => ({
          name: r.display_name,
          points: r.total_points,
          rank: r.rank,
          isCurrentUser: r.user_id === user!.id,
        }))
      : null

    const tableRows = podiumEntries ? rows.slice(3) : rows
    const startRank = podiumEntries ? 4 : 1

    return (
      <div className="space-y-2">
        {/* Manager of the Match banner */}
        {showBanner && rows[0] && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent border border-amber-500/20 mb-4">
            <div className="rounded-full bg-amber-500/20 p-2">
              <TrophyIcon className="h-6 w-6 text-amber-500" />
            </div>
            <div className={`h-9 w-9 rounded-full ${getAvatarColor(rows[0].display_name)} flex items-center justify-center flex-shrink-0 ring-2 ring-amber-500/30`}>
              <span className="text-white text-sm font-semibold">{getInitials(rows[0].display_name)}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-400">Manager of the Match</p>
              <p className="text-sm">{rows[0].display_name}</p>
            </div>
            <p className="text-xl font-bold font-display text-amber-400">{rows[0].total_points} pts</p>
          </div>
        )}

        {/* Podium */}
        {podiumEntries && <Podium entries={podiumEntries} />}

        {/* Table header */}
        {tableRows.length > 0 && (
          <>
            <div className="flex items-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">
              <span className="w-10">#</span>
              <span className="flex-1">Name</span>
              {showMP && <span className="w-12 text-center">MP</span>}
              {showConsistency && <span className="w-14 text-center">Avg</span>}
              {showConsistency && <span className="w-14 text-center">Top-3</span>}
              <span className="w-16 text-right">Points</span>
            </div>

            {tableRows.map((row, i) => {
              const isMe = row.user_id === user!.id
              const displayRank = podiumEntries ? row.rank : i + startRank
              return (
                <div
                  key={row.user_id}
                  className={`flex items-center py-2.5 px-3 rounded-lg transition-all border-b border-border/30 last:border-b-0 ${
                    isMe
                      ? "bg-primary/10 border border-primary/20"
                      : displayRank === 1 ? "bg-emerald-500/5"
                      : displayRank === 2 ? "bg-amber-500/5"
                      : displayRank === 3 ? "bg-orange-700/5"
                      : ""
                  }`}
                >
                  <span className="w-10">
                    <RankBadge rank={displayRank} size="sm" />
                  </span>
                  <div className={`flex-1 flex items-center gap-2 text-sm ${isMe ? "font-semibold" : ""}`}>
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(row.display_name)} flex items-center justify-center flex-shrink-0 ${
                      displayRank === 1 ? "ring-gold" : displayRank === 2 ? "ring-silver" : displayRank === 3 ? "ring-bronze" : ""
                    }`}>
                      <span className="text-white text-xs font-semibold">{getInitials(row.display_name)}</span>
                    </div>
                    <span>
                      {row.display_name}
                      {isMe && (
                        <Badge variant="outline" className="ml-1.5 text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                          You
                        </Badge>
                      )}
                    </span>
                    {showBanner && seasonRankMap?.has(row.user_id) && (
                      <span className="text-[10px] text-muted-foreground ml-1">#{seasonRankMap.get(row.user_id)}</span>
                    )}
                  </div>
                  {showMP && (
                    <span className="w-12 text-center text-sm text-muted-foreground">
                      {row.matches_played ?? 0}
                    </span>
                  )}
                  {showConsistency && (
                    <span className="w-14 text-center text-sm text-muted-foreground">
                      {row.avg_points != null ? row.avg_points.toFixed(0) : "—"}
                    </span>
                  )}
                  {showConsistency && (() => {
                    const pct = row.matches_played && row.podium_count != null
                      ? Math.round((row.podium_count / row.matches_played) * 100)
                      : null
                    const isHot = pct != null && pct >= 75
                    return (
                      <span className={`w-14 text-center text-sm ${isHot ? "text-amber-400 font-semibold" : "text-muted-foreground"}`}>
                        {row.podium_count != null && row.matches_played
                          ? `${row.podium_count}/${row.matches_played}`
                          : "—"}
                      </span>
                    )
                  })()}
                  <span className="w-16 text-right font-bold text-sm font-display">{row.total_points}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
    )
  }

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display flex items-center gap-2">
            <Trophy className="h-6 w-6 shrink-0" />
            Leaderboard
          </h1>
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
              <LeaderTable rows={seasonRows} showMP showPodium showConsistency />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="this-week" className="mt-4">
          <Card className="border border-border">
            <CardContent className="pt-4">
              <LeaderTable rows={thisWeekRows} showBanner showPodium seasonRankMap={seasonRankMap} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="last-week" className="mt-4">
          <Card className="border border-border">
            <CardContent className="pt-4">
              <LeaderTable rows={lastWeekRows} showBanner showPodium seasonRankMap={seasonRankMap} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  )
}

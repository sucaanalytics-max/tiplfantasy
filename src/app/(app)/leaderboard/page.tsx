export const dynamic = "force-dynamic"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy as TrophyIcon, Zap, Crown, Target } from "lucide-react"
import { getMyLeagues, getLeagueLeaderboard, getLeagueAwards, getLeagueMatchScores } from "@/actions/leagues"
import { LeaderboardSelector } from "./leaderboard-selector"
import { MatchdayHistory, AwardTables } from "./leaderboard-sections"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { EmptyState } from "@/components/empty-state"
import { PageTransition } from "@/components/page-transition"
import { RaceChart } from "@/components/charts/race-chart"
import { LeaderboardTable, type LeaderboardRow } from "@/components/leaderboard-table"
import { PodiumCard, type PodiumEntry } from "@/components/podium-card"
import { buildRaceData } from "@/lib/race-data"
import type { LeagueMemberStats } from "@/lib/types"

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { league: leagueIdParam } = await searchParams
  const myLeagues = await getMyLeagues()

  // Default to first league (Tusk League)
  const leagueId = leagueIdParam ?? myLeagues[0]?.id ?? null

  if (!leagueId) {
    return (
      <PageTransition>
        <div className="p-4 md:p-6 max-w-3xl space-y-6">
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <EmptyState icon={TrophyIcon} title="No league yet" description="Join or create a league to see standings" action={{ label: "Go to Leagues", href: "/leagues" }} />
        </div>
      </PageTransition>
    )
  }

  // Fetch all data in parallel
  const [leaderboard, awards, matchScores] = await Promise.all([
    getLeagueLeaderboard(leagueId),
    getLeagueAwards(leagueId),
    getLeagueMatchScores(leagueId),
  ])

  // Build matchday history (winners per match)
  type MatchWinner = { matchNumber: number; matchId: string; winners: { userId?: string; name: string; points: number }[]; winnersCount: number }
  const matchesMap = new Map<number, MatchWinner>()
  for (const row of matchScores) {
    if (row.league_rank === 1) {
      if (!matchesMap.has(row.match_number)) {
        matchesMap.set(row.match_number, {
          matchNumber: row.match_number,
          matchId: row.match_id,
          winners: [],
          winnersCount: row.match_winners_count,
        })
      }
      matchesMap.get(row.match_number)!.winners.push({ userId: row.user_id, name: row.display_name, points: row.total_points })
    }
  }
  const matchHistory = [...matchesMap.entries()].sort(([a], [b]) => b - a).map(([, data]) => data)

  // Build merged rows for the sortable LeaderboardTable
  const awardsMap = new Map(awards.map((a) => [a.user_id, a]))
  const leaderboardRows: LeaderboardRow[] = leaderboard.map((entry, i) => {
    const award = awardsMap.get(entry.user_id)
    return {
      user_id: entry.user_id,
      display_name: entry.display_name,
      season_rank: i + 1,
      total_points: Number(entry.total_points),
      avg_points: Number(entry.avg_points),
      matches_played: entry.matches_played,
      highest_score: Number(award?.highest_score ?? 0),
      matchday_wins: award?.matchday_wins ?? 0,
    }
  })

  // Awards race — sort all members for each category
  const sortedByHighest = [...awards].sort((a, b) => Number(b.highest_score) - Number(a.highest_score))
  const sortedByWins = [...awards].sort((a, b) => b.matchday_wins - a.matchday_wins)
  const sortedByCaptain = [...awards].sort((a, b) => Number(b.total_captain_points) - Number(a.total_captain_points))
  const sortedByConsistent = [...awards].sort((a, b) => b.top2_finishes - a.top2_finishes)

  // Award leaders
  const awardLeaders = awards.length > 0 ? {
    highest: sortedByHighest[0],
    wins: sortedByWins[0],
    captain: sortedByCaptain[0],
    consistent: sortedByConsistent[0],
  } : null

  // Race chart: derived purely from data already fetched above
  const raceData = buildRaceData(matchScores, leaderboard, user.id)

  const selectedLeague = myLeagues.find((l) => l.id === leagueId)

  return (
    <PageTransition>
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        {myLeagues.length > 0 && (
          <LeaderboardSelector leagues={myLeagues} currentLeagueId={leagueId} />
        )}
      </div>

      {selectedLeague && (
        <Badge variant="secondary" className="gap-1">
          <TrophyIcon className="h-3 w-3" />
          {selectedLeague.name}
        </Badge>
      )}

      {/* Player Stats link */}
      <Link
        href="/stats"
        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg glass-panel text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-overlay-subtle transition-colors"
      >
        📊 Player Stats — Orange Cap, Purple Cap, Form & More
      </Link>

      {/* ═══ SEASON STANDINGS ═══ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Season Standings
          </span>
          <span className="text-2xs text-muted-foreground">Tap a header to sort</span>
        </div>
        {leaderboard.length === 0 ? (
          <div className="glass rounded-2xl p-8">
            <p className="text-sm text-muted-foreground text-center">No scores yet</p>
          </div>
        ) : (
          <LeaderboardTable rows={leaderboardRows} currentUserId={user.id} />
        )}
      </div>

      {/* ═══ SEASON RACE ═══ */}
      {raceData && <RaceChart data={raceData} />}

      {/* ═══ KEY STATS ═══ */}
      {awardLeaders && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Key Stats</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Zap, label: "Highest Score", name: awardLeaders.highest?.display_name, stat: `${Number(awardLeaders.highest?.highest_score)} pts` },
              { icon: TrophyIcon, label: "Most Wins", name: awardLeaders.wins?.display_name, stat: `${awardLeaders.wins?.matchday_wins} wins` },
              { icon: Crown, label: "Best Captaincy", name: awardLeaders.captain?.display_name, stat: `${Math.round(Number(awardLeaders.captain?.total_captain_points))} pts` },
              { icon: Target, label: "Most Consistent", name: awardLeaders.consistent?.display_name, stat: `${awardLeaders.consistent?.top2_finishes} top-2s` },
            ].map((award) => (
              <Card key={award.label} className="glass">
                <CardContent className="pt-3 pb-3 px-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-accent/10 text-accent shrink-0">
                      <award.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{award.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {award.name && (
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(award.name)}`}>
                        <span className="text-white text-[8px] font-bold">{getInitials(award.name)}</span>
                      </div>
                    )}
                    <span className="text-xs font-medium truncate">{award.name ?? "—"}</span>
                  </div>
                  <p className="text-gold-stat text-2xl leading-none mt-1.5">{award.stat}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══ AWARDS RACE ═══ */}
      {awards.length >= 3 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Awards Race</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Zap, label: "Highest Score", data: sortedByHighest, getValue: (a: LeagueMemberStats) => Number(a.highest_score), suffix: "pts" },
              { icon: TrophyIcon, label: "Matchday Wins", data: sortedByWins, getValue: (a: LeagueMemberStats) => a.matchday_wins, suffix: "wins" },
              { icon: Crown, label: "Best Captaincy", data: sortedByCaptain, getValue: (a: LeagueMemberStats) => Math.round(Number(a.total_captain_points)), suffix: "pts" },
              { icon: Target, label: "Most Consistent", data: sortedByConsistent, getValue: (a: LeagueMemberStats) => a.top2_finishes, suffix: "top-2s" },
            ].map(({ icon: Icon, label, data, getValue, suffix }) => {
              const podiumEntries: PodiumEntry[] = data.slice(0, 3).map((entry) => {
                const value = getValue(entry)
                return {
                  user_id: entry.user_id,
                  display_name: entry.display_name,
                  total_points: value,
                  displayValue: `${value} ${suffix}`,
                }
              })
              return (
                <div key={label} className="rounded-2xl glass overflow-hidden">
                  <div className="px-3 py-2 border-b border-overlay-border flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                  </div>
                  {/* Visual podium for the leader trio — staggered heights, gold/silver/bronze */}
                  <PodiumCard
                    entries={podiumEntries}
                    currentUserId={user.id}
                    hideGap
                    className="!rounded-none border-0"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ MATCHDAY HISTORY ═══ */}
      {matchHistory.length > 0 && <MatchdayHistory matchHistory={matchHistory} />}

      {/* ═══ AWARD TABLES ═══ */}
      {matchScores.length > 0 && <AwardTables awards={awards} matchScores={matchScores} />}
    </div>
    </PageTransition>
  )
}

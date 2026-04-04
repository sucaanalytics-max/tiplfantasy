import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy as TrophyIcon, Zap, Crown, Target, Swords } from "lucide-react"
import { Trophy } from "@/components/icons/trophy"
import { getMyLeagues, getLeagueLeaderboard, getLeagueAwards, getLeagueMatchScores } from "@/actions/leagues"
import { LeaderboardSelector } from "./leaderboard-selector"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { RankBadge } from "@/components/rank-badge"
import { EmptyState } from "@/components/empty-state"
import { PageTransition } from "@/components/page-transition"
import type { LeagueMemberStats, LeagueMatchScore } from "@/lib/types"

const MEDALS = ["🥇", "🥈", "🥉"] as const

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
  type MatchWinner = { matchNumber: number; matchId: string; winners: { name: string; points: number }[]; winnersCount: number }
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
      matchesMap.get(row.match_number)!.winners.push({ name: row.display_name, points: row.total_points })
    }
  }
  const matchHistory = [...matchesMap.entries()].sort(([a], [b]) => b - a).map(([, data]) => data)

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
        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg glass-panel text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors"
      >
        📊 Player Stats — Orange Cap, Purple Cap, Form & More
      </Link>

      {/* ═══ SEASON STANDINGS ═══ */}
      <div className="rounded-lg glass overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Season Standings</span>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No scores yet</p>
        ) : (
          <div>
            {leaderboard.map((entry, i) => {
              const rank = i + 1
              const isMe = entry.user_id === user.id
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 ${isMe ? "bg-primary/5" : ""}`}
                >
                  <span className="w-6 text-center text-sm shrink-0">
                    {rank <= 3 ? MEDALS[rank - 1] : <span className="text-muted-foreground">{rank}</span>}
                  </span>
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(entry.display_name)}`}>
                    <span className="text-white text-[10px] font-semibold">{getInitials(entry.display_name)}</span>
                  </div>
                  <span className={`text-sm flex-1 ${isMe ? "font-bold" : "font-medium"}`}>
                    {entry.display_name}
                    {isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
                  </span>
                  <span className="text-sm font-bold font-display tabular-nums">{Number(entry.total_points)}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{entry.matches_played}M</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">{entry.avg_points.toFixed(0)} avg</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
                    <award.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">{award.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {award.name && (
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(award.name)}`}>
                        <span className="text-white text-[8px] font-bold">{getInitials(award.name)}</span>
                      </div>
                    )}
                    <span className="text-xs font-medium truncate">{award.name ?? "—"}</span>
                  </div>
                  <p className="text-lg font-bold font-display mt-1">{award.stat}</p>
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
              { icon: Zap, label: "Highest Score", data: sortedByHighest, getValue: (a: LeagueMemberStats) => `${Number(a.highest_score)} pts` },
              { icon: TrophyIcon, label: "Matchday Wins", data: sortedByWins, getValue: (a: LeagueMemberStats) => `${a.matchday_wins} wins` },
              { icon: Crown, label: "Best Captaincy", data: sortedByCaptain, getValue: (a: LeagueMemberStats) => `${Math.round(Number(a.total_captain_points))} pts` },
              { icon: Target, label: "Most Consistent", data: sortedByConsistent, getValue: (a: LeagueMemberStats) => `${a.top2_finishes} top-2s` },
            ].map(({ icon: Icon, label, data, getValue }) => (
              <div key={label} className="rounded-lg glass overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {data.slice(0, 3).map((entry, i) => (
                    <div key={entry.user_id} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-xs w-4 text-center shrink-0">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="text-sm flex-1 truncate">{entry.display_name}</span>
                      <span className="text-sm font-bold font-display tabular-nums shrink-0">{getValue(entry)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ MATCHDAY HISTORY ═══ */}
      {matchHistory.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Matchday History</p>
          <div className="rounded-lg glass overflow-hidden divide-y divide-white/[0.04]">
            {matchHistory.map((match) => (
              <div key={match.matchNumber} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-xs text-muted-foreground">Match #{match.matchNumber}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm">🏆</span>
                    <span className="text-sm font-medium">
                      {match.winners.map((w) => w.name).join(" & ")}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold font-display tabular-nums">{match.winners[0]?.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  )
}

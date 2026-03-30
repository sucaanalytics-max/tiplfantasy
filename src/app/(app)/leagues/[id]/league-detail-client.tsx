"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn, formatIST } from "@/lib/utils"
import { Copy, Check, Share2, Trash2, ArrowLeft, Users, Trophy, Swords, Zap, Crown, Target, ChevronRight, ChevronDown, GitCompareArrows, Radio, type LucideIcon } from "lucide-react"
import { LiveRefresher } from "@/components/live-refresher"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { getInitials as getAvatarInitials, getAvatarColor } from "@/lib/avatar"
import { LeaderboardRow } from "@/components/shared/leaderboard-row"
import { PlayerRow } from "@/components/shared/player-row"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { leaveLeague, deleteLeague } from "@/actions/leagues"
import { toast } from "sonner"
import type { League, LeagueLeaderboardEntry, LeagueMemberStats, LeagueMatchScore } from "@/lib/types"
import { getInitials, getAvatarHexColor } from "@/lib/avatar"

type MemberProfile = {
  user_id: string
  joined_at: string
  profile: { display_name: string; avatar_url: string | null }[] | { display_name: string; avatar_url: string | null } | null
}

type LockedMatch = {
  id: string
  match_number: number
  start_time: string
  status: string
  team_home: { short_name: string; color: string }
  team_away: { short_name: string; color: string }
}

type LiveMatchData = {
  match: {
    id: string; match_number: number; status: string; cricapi_match_id: string | null; start_time: string
    team_home: { short_name: string; color: string; logo_url: string | null }
    team_away: { short_name: string; color: string; logo_url: string | null }
  }
  memberScores: Array<{ user_id: string; display_name: string; total_points: number; captain_points: number; vc_points: number }>
  memberSelections: Array<{ user_id: string; captain_id: string | null; vice_captain_id: string | null; player_ids: string[] }>
  playerPoints: Record<string, number>
  playerNames: Record<string, { name: string; role: string }>
  banter?: Array<{ message: string; event_type: string; created_at: string }>
}

type Props = {
  league: League
  members: MemberProfile[]
  isCreator: boolean
  leaderboard: LeagueLeaderboardEntry[]
  awards: LeagueMemberStats[]
  matchScores: LeagueMatchScore[]
  lockedMatches: LockedMatch[]
  liveMatchData?: LiveMatchData | null
  currentUserId?: string
  recentBanter?: Array<{ message: string; event_type: string }>
}

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"] as const

export function LeagueDetailClient({ league, members, isCreator, leaderboard, awards, matchScores, lockedMatches, liveMatchData, currentUserId, recentBanter = [] }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [liveExpandedId, setLiveExpandedId] = useState<string | null>(null)

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  function handleShare(): void {
    const shareData = {
      title: "Join my TIPL league!",
      text: `Join "${league.name}" on TIPL! Use invite code: ${league.invite_code}`,
    }

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        copyCode()
      })
    } else {
      copyCode()
    }
  }

  function copyCode(): void {
    navigator.clipboard.writeText(league.invite_code)
    setCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  function handleLeave(): void {
    startTransition(async () => {
      const result = await leaveLeague(league.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.push("/leagues")
      router.refresh()
    })
  }

  function handleDelete(): void {
    startTransition(async () => {
      const result = await deleteLeague(league.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDeleteOpen(false)
      router.push("/leagues")
      router.refresh()
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl lg:max-w-5xl">
      {/* Header with compact invite code */}
      <div className="flex items-center gap-3">
        <Link href="/leagues">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Back to leagues">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{league.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {members.length}
            </Badge>
            <button onClick={copyCode} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors font-mono">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {league.invite_code}
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={handleShare} className="h-8 w-8 p-0">
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          {isCreator ? (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete League</DialogTitle>
                  <DialogDescription>
                    This will permanently delete &quot;{league.name}&quot; and remove all members.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                    {isPending ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLeave} disabled={isPending} className="h-8 text-xs">
              Leave
            </Button>
          )}
        </div>
      </div>

      {/* Season Leaderboard — always visible, above tabs */}
      <div className="rounded-lg border border-border/30 bg-[hsl(var(--background))] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-secondary/20">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Season Standings</span>
          <Link href={`/leagues/${league.id}/h2h`}>
            <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2">
              <Swords className="h-3 w-3" />
              H2H
            </Button>
          </Link>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No scores yet. Play some matches!</p>
        ) : (
          <div>
            {leaderboard.map((entry, i) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={{
                  userId: entry.user_id,
                  displayName: entry.display_name ?? "Unknown",
                  totalPoints: Number(entry.total_points),
                  rank: i + 1,
                  matchesPlayed: entry.matches_played,
                  avgPoints: entry.avg_points,
                }}
                isCurrentUser={entry.user_id === currentUserId}
                variant="season"
              />
            ))}
          </div>
        )}
      </div>

      {/* Season Awards — compact 2x2 grid */}
      <SeasonAwards awards={awards} />

      {/* Tabs — Live, Match Teams, Prizes */}
      <div>
      <Tabs defaultValue={liveMatchData ? "live" : "match-teams"}>
        <TabsList className={cn("w-full mb-4", liveMatchData ? "grid grid-cols-3" : "grid grid-cols-2")}>
          {liveMatchData && (
            <TabsTrigger value="live" className="gap-1.5">
              <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                <Radio className="h-3.5 w-3.5 text-red-400" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              </span>
              Live
            </TabsTrigger>
          )}
          <TabsTrigger value="match-teams" className="gap-1.5">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Match Teams
          </TabsTrigger>
          <TabsTrigger value="prizes" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Prizes
          </TabsTrigger>
        </TabsList>

        {/* ── Live Tab ─────────────────────────────── */}
        {liveMatchData && (
          <TabsContent value="live" className="space-y-4">
            <LiveRefresher interval={30000} />

            {/* Match score header */}
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-4">
              <div className="flex items-center justify-center gap-4 mb-2">
                <span className="text-sm font-bold font-display" style={{ color: liveMatchData.match.team_home.color }}>
                  {liveMatchData.match.team_home.short_name}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </div>
                <span className="text-sm font-bold font-display" style={{ color: liveMatchData.match.team_away.color }}>
                  {liveMatchData.match.team_away.short_name}
                </span>
              </div>
              <div className="text-center">
                <LiveScoreWidget
                  cricapiMatchId={liveMatchData.match.cricapi_match_id}
                  startTime={liveMatchData.match.start_time}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                Match #{liveMatchData.match.match_number} · Updates every ~5 min
              </p>
            </div>

            {/* League fantasy table */}
            {liveMatchData.memberScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Fantasy points will appear within 5 minutes of the match starting.
              </p>
            ) : (
              <div className="space-y-1">
                {liveMatchData.memberScores
                  .sort((a, b) => b.total_points - a.total_points)
                  .map((member, idx) => {
                    const isMe = member.user_id === currentUserId
                    const sel = liveMatchData.memberSelections.find((s) => s.user_id === member.user_id)
                    const leagueRank = idx + 1
                    const expanded = liveExpandedId === member.user_id

                    return (
                      <div key={member.user_id}>
                        <button
                          onClick={() => setLiveExpandedId((prev) => prev === member.user_id ? null : member.user_id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors",
                            "hover:bg-secondary/50 active:bg-secondary/70",
                            isMe && "bg-primary/10 border border-primary/20",
                            expanded && !isMe && "bg-secondary/30"
                          )}
                        >
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                            leagueRank === 1 && "bg-amber-400/20 text-amber-400",
                            leagueRank === 2 && "bg-gray-400/20 text-gray-400",
                            leagueRank === 3 && "bg-amber-600/20 text-amber-600",
                            leagueRank > 3 && "bg-secondary text-muted-foreground"
                          )}>
                            {leagueRank}
                          </span>
                          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAvatarColor(member.display_name))}>
                            <span className="text-white text-[10px] font-semibold">{getAvatarInitials(member.display_name)}</span>
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.display_name}
                              {isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
                            </p>
                          </div>
                          <span className="text-lg font-bold font-display tabular-nums shrink-0">
                            {member.total_points}
                          </span>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
                        </button>

                        {expanded && sel && (
                          <div className="ml-8 mr-2 mb-2 border-t border-border/40 pt-2 space-y-0.5">
                            {sel.player_ids
                              .map((pid) => {
                                const pts = liveMatchData.playerPoints[pid] ?? 0
                                const pInfo = liveMatchData.playerNames[pid]
                                const isC = sel.captain_id === pid
                                const isVC = sel.vice_captain_id === pid
                                const mult = isC ? 2 : isVC ? 1.5 : 1
                                const eff = Math.round(pts * mult * 100) / 100
                                return { pid, name: pInfo?.name ?? "Unknown", role: pInfo?.role ?? "?", pts, isC, isVC, eff }
                              })
                              .sort((a, b) => b.eff - a.eff)
                              .map((p) => (
                                <PlayerRow
                                  key={p.pid}
                                  player={{ id: p.pid, name: p.name, role: p.role }}
                                  isCaptain={p.isC}
                                  isViceCaptain={p.isVC}
                                  effectivePoints={p.eff}
                                  variant="compact"
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Banter Feed */}
            {liveMatchData.banter && liveMatchData.banter.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-gradient-to-b from-amber-400/5 to-transparent overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-400/10 flex items-center gap-2">
                  <span className="text-base">🎭</span>
                  <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">Live Commentary</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{liveMatchData.banter.length} moments</span>
                </div>
                <div className="divide-y divide-border/10 max-h-[28rem] overflow-y-auto">
                  {liveMatchData.banter.map((b, i) => (
                    <div key={i} className="px-4 py-3 text-sm text-foreground leading-relaxed">
                      {b.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* Leaderboard tab removed — now above tabs */}

        <TabsContent value="match-teams" className="space-y-3">
          {lockedMatches.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 gap-3">
              <GitCompareArrows className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="font-medium text-muted-foreground">No completed matches yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Team comparisons appear once matches begin</p>
              </div>
            </div>
          ) : (
            lockedMatches.map((match) => (
              <Card key={match.id} className="border border-border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm font-medium">
                          <span style={{ color: match.team_home.color }}>{match.team_home.short_name}</span>
                          <span className="text-muted-foreground mx-1.5">vs</span>
                          <span style={{ color: match.team_away.color }}>{match.team_away.short_name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Match #{match.match_number} · {formatIST(match.start_time, "MMM d")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {match.status === "live" && (
                        <Badge variant="live" className="text-[10px]">Live</Badge>
                      )}
                      <Link href={`/leagues/${league.id}/match/${match.id}`}>
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          View Teams <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="prizes" className="space-y-6">
          <PrizesTab awards={awards} matchScores={matchScores} leaderboard={leaderboard} />
        </TabsContent>
      </Tabs>
      </div>{/* end tabs wrapper */}
    </div>
  )
}

function AvatarInitial({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <div
      className={
        size === "sm"
          ? "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          : "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
      }
      style={{ backgroundColor: getAvatarHexColor(name) }}
    >
      {getInitials(name)}
    </div>
  )
}

function SeasonAwards({ awards }: { awards: LeagueMemberStats[] }) {
  if (awards.length === 0) return null

  const highestScore = awards.reduce((a, b) => b.highest_score > a.highest_score ? b : a)
  const mostWins = awards.reduce((a, b) => b.matchday_wins > a.matchday_wins ? b : a)
  const bestCaptain = awards.reduce((a, b) => b.total_captain_points > a.total_captain_points ? b : a)
  const mostConsistent = awards.reduce((a, b) => b.top2_finishes > a.top2_finishes ? b : a)

  const cards: { Icon: LucideIcon; label: string; winner: LeagueMemberStats; stat: string }[] = [
    { Icon: Zap,    label: "Highest Score",   winner: highestScore,  stat: `${highestScore.highest_score} pts` },
    { Icon: Trophy, label: "Matchday Wins",   winner: mostWins,      stat: `${mostWins.matchday_wins} wins` },
    { Icon: Crown,  label: "Best Captaincy",  winner: bestCaptain,   stat: `${bestCaptain.total_captain_points} pts` },
    { Icon: Target, label: "Most Consistent", winner: mostConsistent, stat: `${mostConsistent.top2_finishes} top-2s` },
  ]

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Season Awards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map(({ Icon, label, winner, stat }) => (
            <div key={label} className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <AvatarInitial name={winner.display_name} size="sm" />
                <span className="text-xs truncate">{winner.display_name}</span>
              </div>
              <span className="text-sm font-bold">{stat}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Prize Tracker — Tusk League prize configuration
// ─────────────────────────────────────────────────────────────────────────────

const KNOCKOUT_MATCH_NUMBERS = [71, 72, 73]
const FINAL_MATCH_NUMBER = 74
const MATCHDAY_PRIZE = { league: 150, knockout: 200, final: 400 } as const
const SEASON_PRIZE = { first: 19000, second: 7000 } as const
const AWARD_PRIZE = 2000

type MatchKind = "league" | "knockout" | "final"

function getMatchType(matchNumber: number): MatchKind {
  if (matchNumber === FINAL_MATCH_NUMBER) return "final"
  if (KNOCKOUT_MATCH_NUMBERS.includes(matchNumber)) return "knockout"
  return "league"
}

function getMatchdayPrize(matchNumber: number): number {
  return MATCHDAY_PRIZE[getMatchType(matchNumber)]
}

type PrizesTabProps = {
  awards: LeagueMemberStats[]
  matchScores: LeagueMatchScore[]
  leaderboard: LeagueLeaderboardEntry[]
}

export function PrizesTab({ awards, matchScores, leaderboard }: PrizesTabProps) {
  if (awards.length === 0 && matchScores.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 gap-3">
        <Trophy className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="font-medium text-muted-foreground">No prize data yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Prizes unlock once matches complete</p>
        </div>
      </div>
    )
  }

  // ── Award leaders ──────────────────────────────────────────────────────────
  const awardLeaders = awards.length > 0 ? {
    highestScore:  awards.reduce((a, b) => b.highest_score > a.highest_score ? b : a),
    mostWins:      awards.reduce((a, b) => b.matchday_wins > a.matchday_wins ? b : a),
    bestCaptain:   awards.reduce((a, b) => b.total_captain_points > a.total_captain_points ? b : a),
    mostConsistent: awards.reduce((a, b) => b.top2_finishes > a.top2_finishes ? b : a),
  } : null

  const awardCards: { Icon: LucideIcon; label: string; winner: LeagueMemberStats; stat: string }[] = awardLeaders ? [
    { Icon: Zap,    label: "Highest Score",   winner: awardLeaders.highestScore,   stat: `${awardLeaders.highestScore.highest_score} pts` },
    { Icon: Trophy, label: "Matchday Wins",   winner: awardLeaders.mostWins,       stat: `${awardLeaders.mostWins.matchday_wins} wins` },
    { Icon: Crown,  label: "Best Captaincy",  winner: awardLeaders.bestCaptain,    stat: `${Math.round(awardLeaders.bestCaptain.total_captain_points)} pts` },
    { Icon: Target, label: "Most Consistent", winner: awardLeaders.mostConsistent, stat: `${awardLeaders.mostConsistent.top2_finishes} top-2s` },
  ] : []

  // ── Per-match winners (league_rank === 1) ───────────────────────────────────
  const matchesMap = new Map<number, { matchId: string; startTime: string; prize: number; winners: { userId: string; name: string; points: number }[]; winnersCount: number }>()
  for (const row of matchScores) {
    if (row.league_rank === 1) {
      if (!matchesMap.has(row.match_number)) {
        matchesMap.set(row.match_number, {
          matchId: row.match_id,
          startTime: row.start_time,
          prize: getMatchdayPrize(row.match_number),
          winners: [],
          winnersCount: row.match_winners_count,
        })
      }
      matchesMap.get(row.match_number)!.winners.push({
        userId: row.user_id,
        name: row.display_name,
        points: row.total_points,
      })
    }
  }
  const matchHistory = Array.from(matchesMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([matchNumber, data]) => ({ matchNumber, ...data }))

  // ── Per-member earnings ────────────────────────────────────────────────────
  type MemberEarnings = {
    userId: string
    name: string
    matchdayEarnings: number
    seasonPrize: number
    awardLeads: number
  }

  const earningsMap = new Map<string, MemberEarnings>()

  // Seed from leaderboard so all members appear
  leaderboard.forEach((entry, idx) => {
    earningsMap.set(entry.user_id, {
      userId: entry.user_id,
      name: entry.display_name ?? "Unknown",
      matchdayEarnings: 0,
      seasonPrize: idx === 0 ? SEASON_PRIZE.first : idx === 1 ? SEASON_PRIZE.second : 0,
      awardLeads: 0,
    })
  })

  // Confirmed matchday earnings from match history
  for (const match of matchHistory) {
    const splitPrize = match.prize / match.winnersCount
    for (const winner of match.winners) {
      const entry = earningsMap.get(winner.userId)
      if (entry) entry.matchdayEarnings += splitPrize
    }
  }

  // Award leads count
  if (awardLeaders) {
    for (const { winner } of awardCards) {
      const entry = earningsMap.get(winner.user_id)
      if (entry) entry.awardLeads += 1
    }
  }

  const earnings = Array.from(earningsMap.values()).sort(
    (a, b) => b.matchdayEarnings - a.matchdayEarnings
  )

  return (
    <div className="space-y-6">
      {/* Award Leaders */}
      {awardCards.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Award Leaders
              <span className="text-xs font-normal text-muted-foreground ml-auto">2,000 each</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {awardCards.map(({ Icon, label, winner, stat }) => (
                <div key={label} className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                      2k
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarInitial name={winner.display_name} size="sm" />
                    <span className="text-xs truncate">{winner.display_name}</span>
                  </div>
                  <span className="text-sm font-bold">{stat}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">Ties share prize equally</p>
          </CardContent>
        </Card>
      )}

      {/* Matchday History */}
      {matchHistory.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Matchday History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {matchHistory.map((match) => {
                const isTied = match.winnersCount > 1
                const splitPrize = match.prize / match.winnersCount
                const matchKind = getMatchType(match.matchNumber)
                return (
                  <div key={match.matchId} className="flex items-center justify-between py-2.5 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">Match #{match.matchNumber}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{matchKind}</span>
                      </div>
                      <div className="min-w-0">
                        {match.winners.map((w) => (
                          <div key={w.userId} className="flex items-center gap-1.5">
                            <AvatarInitial name={w.name} size="sm" />
                            <span className="text-sm truncate">{w.name}</span>
                            <span className="text-xs text-muted-foreground">· {w.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-bold text-emerald-400">
                        {isTied ? splitPrize : match.prize}
                      </span>
                      {isTied && (
                        <p className="text-[10px] text-muted-foreground">each (split)</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Awards */}
      {earnings.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Awards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_4rem_4rem] gap-2 text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide">
                <span>Member</span>
                <span className="text-right">Wins</span>
                <span className="text-right">Top 2</span>
              </div>
              {earnings.map((e) => {
                // Look up stats from awards data
                const memberAwards = awards.find((a) => a.user_id === e.userId)
                const matchWins = memberAwards?.matchday_wins ?? 0
                const top2 = memberAwards?.top2_finishes ?? 0
                return (
                  <div
                    key={e.userId}
                    className="grid grid-cols-[1fr_4rem_4rem] gap-2 items-center py-2.5 px-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarInitial name={e.name} size="sm" />
                      <span className="text-sm truncate">{e.name}</span>
                      {e.awardLeads > 0 && (
                        <span className="text-[10px] text-amber-400 shrink-0">+{e.awardLeads} award{e.awardLeads > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-right text-emerald-400">
                      {matchWins > 0 ? matchWins : "—"}
                    </span>
                    <span className="text-sm font-semibold text-right text-sky-400">
                      {top2 > 0 ? top2 : "—"}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


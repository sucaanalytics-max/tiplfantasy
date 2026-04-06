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
            <button onClick={copyCode} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-overlay-subtle border border-overlay-border-hover text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors font-mono">
              {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
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
      <div className="rounded-lg glass overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-overlay-border bg-overlay-subtle">
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
                <Radio className="h-3.5 w-3.5 text-[var(--tw-red-text)]" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              </span>
              Live
            </TabsTrigger>
          )}
          <TabsTrigger value="match-teams" className="gap-1.5">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Match Teams
          </TabsTrigger>
          <Link href="/leaderboard" className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all text-muted-foreground hover:text-foreground">
            <Trophy className="h-3.5 w-3.5" />
            Prizes →
          </Link>
        </TabsList>

        {/* ── Live Tab ─────────────────────────────── */}
        {liveMatchData && (
          <TabsContent value="live" className="space-y-4">
            <LiveRefresher interval={30000} />

            {/* Match score header */}
            <div className="rounded-lg border border-overlay-border bg-overlay-subtle p-4">
              <div className="flex items-center justify-center gap-4 mb-2">
                <span className="text-sm font-bold font-display" style={{ color: liveMatchData.match.team_home.color }}>
                  {liveMatchData.match.team_home.short_name}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-[var(--tw-red-text)]">
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
                            "hover:bg-overlay-subtle active:bg-secondary/70",
                            isMe && "bg-primary/10 border border-primary/20",
                            expanded && !isMe && "bg-overlay-subtle"
                          )}
                        >
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                            leagueRank === 1 && "bg-[var(--tw-amber-bg)] text-[var(--tw-amber-text)]",
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
                          <div className="ml-8 mr-2 mb-2 border-t border-overlay-border pt-2 space-y-0.5">
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
                  <span className="text-sm font-bold text-[var(--tw-amber-text)] uppercase tracking-wider">Live Commentary</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{liveMatchData.banter.length} moments</span>
                </div>
                <div className="divide-y divide-overlay-border max-h-[28rem] overflow-y-auto">
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
              <Card key={match.id} className="glass">
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

        {/* Prizes moved to /leaderboard */}
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
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Season Awards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map(({ Icon, label, winner, stat }) => (
            <div key={label} className="flex flex-col gap-2 p-3 rounded-lg glass-subtle">
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
        <Card className="glass">
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
                <div key={label} className="flex flex-col gap-2 p-3 rounded-lg glass-subtle">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--tw-emerald-text)] bg-[var(--tw-emerald-bg)] border border-emerald-400/20 rounded px-1.5 py-0.5">
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
      {matchHistory.length > 0 && <MatchdayHistorySection matchHistory={matchHistory} />}

      {/* Award Detail Tables */}
      {matchScores.length > 0 && <AwardDetailTables awards={awards} matchScores={matchScores} />}
    </div>
  )
}

// ── Matchday History Section ────────────────────────────────────────────────
type MatchHistoryItem = { matchNumber: number; matchId: string; startTime: string; prize: number; winners: { userId: string; name: string; points: number }[]; winnersCount: number }

function MatchdayHistorySection({ matchHistory }: { matchHistory: MatchHistoryItem[] }) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  // Last 3 matchday results
  const recent = matchHistory.slice(0, 3)

  // Per-user: which matches they won + total earned
  const userWins = new Map<string, { name: string; matches: MatchHistoryItem[]; totalEarned: number }>()
  for (const match of matchHistory) {
    const splitPrize = match.prize / match.winnersCount
    for (const w of match.winners) {
      if (!userWins.has(w.userId)) {
        userWins.set(w.userId, { name: w.name, matches: [], totalEarned: 0 })
      }
      const entry = userWins.get(w.userId)!
      entry.matches.push(match)
      entry.totalEarned += splitPrize
    }
  }
  const userWinsList = [...userWins.entries()]
    .sort(([, a], [, b]) => b.totalEarned - a.totalEarned)

  // Grand total matchday prize pool paid out
  const grandTotal = userWinsList.reduce((s, [, u]) => s + u.totalEarned, 0)

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Matchday History
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            Total: <span className="text-emerald-400 font-semibold">{Math.round(grandTotal).toLocaleString()}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recent 3 matchdays */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Recent</p>
          <div className="space-y-1">
            {recent.map((match) => {
              const isTied = match.winnersCount > 1
              const splitPrize = match.prize / match.winnersCount
              return (
                <div key={match.matchId} className="flex items-center justify-between py-2 px-3 rounded-lg glass-subtle">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-medium shrink-0">M{match.matchNumber}</span>
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
                    <span className="text-sm font-bold text-emerald-400">{isTied ? Math.round(splitPrize) : match.prize}</span>
                    {isTied && <p className="text-[10px] text-muted-foreground">each</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Per-user breakdown */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">By Member</p>
          <div className="space-y-1">
            {userWinsList.map(([uid, data]) => {
              const isOpen = expandedUser === uid
              return (
                <div key={uid}>
                  <button
                    onClick={() => setExpandedUser(isOpen ? null : uid)}
                    className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg glass-subtle hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarInitial name={data.name} size="sm" />
                      <span className="text-sm truncate">{data.name}</span>
                      <span className="text-xs text-muted-foreground">{data.matches.length} win{data.matches.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-emerald-400">{Math.round(data.totalEarned).toLocaleString()}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2 pt-1 ml-8 space-y-1">
                      {data.matches.map((m) => {
                        const split = m.prize / m.winnersCount
                        const winner = m.winners.find((w) => w.userId === uid)
                        return (
                          <div key={m.matchId} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.04] last:border-0">
                            <span className="text-muted-foreground">M{m.matchNumber}</span>
                            <span>
                              <span className="font-medium">{winner?.points} pts</span>
                              <span className="text-emerald-400 ml-2 font-semibold">+{Math.round(split)}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Award Detail Tables ────────────────────────────────────────────────────
type CaptaincySortKey = "cPts" | "vcPts" | "total"

function AwardDetailTables({ awards, matchScores }: { awards: LeagueMemberStats[]; matchScores: LeagueMatchScore[] }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, string | null>>({
    captaincy: null, highScore: null, wins: null, consistency: null,
  })
  const [captaincySort, setCaptaincySort] = useState<CaptaincySortKey>("cPts")

  const toggle = (table: string, userId: string) =>
    setExpandedRows((prev) => ({ ...prev, [table]: prev[table] === userId ? null : userId }))

  // Build per-user match data
  const userMap = new Map<string, { name: string; matches: Array<{ matchNumber: number; total: number; captain: number; vc: number; rank: number }> }>()
  for (const row of matchScores) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, { name: row.display_name, matches: [] })
    }
    userMap.get(row.user_id)!.matches.push({
      matchNumber: row.match_number,
      total: row.total_points,
      captain: row.captain_points ?? 0,
      vc: row.vc_points ?? 0,
      rank: row.league_rank,
    })
  }

  // ── Captaincy ──
  const captaincyUnsorted = [...userMap.entries()]
    .map(([uid, d]) => {
      const cPts = d.matches.reduce((s, m) => s + m.captain, 0)
      const vcPts = d.matches.reduce((s, m) => s + m.vc, 0)
      return { userId: uid, name: d.name, cPts, vcPts, total: cPts + vcPts, matches: d.matches }
    })
  const captaincy = [...captaincyUnsorted].sort((a, b) => b[captaincySort] - a[captaincySort] || b.total - a.total)

  // ── Highest Score ──
  const highScore = [...userMap.entries()]
    .map(([uid, d]) => {
      const best = d.matches.reduce((max, m) => (m.total > max.total ? m : max), d.matches[0])
      return { userId: uid, name: d.name, best: best.total, matchNum: best.matchNumber, matches: [...d.matches].sort((a, b) => b.total - a.total) }
    })
    .sort((a, b) => b.best - a.best)

  // ── Matchday Wins ──
  const wins = [...userMap.entries()]
    .map(([uid, d]) => {
      const wonMatches = d.matches.filter((m) => m.rank === 1)
      return { userId: uid, name: d.name, winCount: wonMatches.length, wonMatches, matches: d.matches }
    })
    .sort((a, b) => b.winCount - a.winCount)

  // ── Consistency ──
  const consistency = [...userMap.entries()]
    .map(([uid, d]) => {
      const top2 = d.matches.filter((m) => m.rank <= 2).length
      const avg = d.matches.length > 0 ? Math.round(d.matches.reduce((s, m) => s + m.total, 0) / d.matches.length) : 0
      return { userId: uid, name: d.name, top2, avg, matches: [...d.matches].sort((a, b) => a.matchNumber - b.matchNumber) }
    })
    .sort((a, b) => b.top2 - a.top2 || b.avg - a.avg)

  const renderRow = (uid: string, name: string, cells: React.ReactNode[], table: string, expandContent: React.ReactNode) => {
    const isOpen = expandedRows[table] === uid
    return (
      <div key={uid}>
        <button
          onClick={() => toggle(table, uid)}
          className="w-full grid items-center py-2.5 px-3 rounded-lg glass-subtle hover:bg-overlay-subtle transition-colors"
          style={{ gridTemplateColumns: "1fr " + "3.5rem ".repeat(cells.length) + "1.5rem" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AvatarInitial name={name} size="sm" />
            <span className="text-sm truncate">{name}</span>
          </div>
          {cells}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <div className="px-3 pb-2 pt-1 ml-8 space-y-1">
            {expandContent}
          </div>
        )}
      </div>
    )
  }

  const matchRow = (label: string, value: string, highlight?: boolean) => (
    <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-overlay-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-[var(--tw-emerald-text)]" : "font-medium"}>{value}</span>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Captaincy Table */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crown className="h-4 w-4 text-[var(--tw-amber-text)]" />
            Captaincy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div
            className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide"
            style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 3.5rem 1.5rem" }}
          >
            <span>Member</span>
            {(["cPts", "vcPts", "total"] as CaptaincySortKey[]).map((key) => {
              const labels: Record<CaptaincySortKey, string> = { cPts: "C", vcPts: "VC", total: "Total" }
              return (
                <button
                  key={key}
                  onClick={() => setCaptaincySort(key)}
                  className={`text-right cursor-pointer hover:text-foreground transition-colors ${captaincySort === key ? "text-foreground font-bold" : ""}`}
                >
                  {labels[key]}{captaincySort === key ? " ↓" : ""}
                </button>
              )
            })}
            <span />
          </div>
          {captaincy.map((row) =>
            renderRow(
              row.userId,
              row.name,
              [
                <span key="c" className="text-sm font-semibold text-right text-[var(--tw-amber-text)]">{Math.round(row.cPts)}</span>,
                <span key="vc" className="text-sm font-medium text-right text-violet-400">{Math.round(row.vcPts)}</span>,
                <span key="t" className="text-sm font-medium text-right">{Math.round(row.total)}</span>,
              ],
              "captaincy",
              row.matches
                .sort((a, b) => b.matchNumber - a.matchNumber)
                .map((m) =>
                  matchRow(`M${m.matchNumber}`, `C: ${Math.round(m.captain)} · VC: ${Math.round(m.vc)}`, m.captain > 0)
                )
            )
          )}
        </CardContent>
      </Card>

      {/* Highest Score Table */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            Highest Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div
            className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide"
            style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 1.5rem" }}
          >
            <span>Member</span>
            <span className="text-right">Best</span>
            <span className="text-right">M#</span>
            <span />
          </div>
          {highScore.map((row) =>
            renderRow(
              row.userId,
              row.name,
              [
                <span key="b" className="text-sm font-semibold text-right text-orange-400">{Math.round(row.best)}</span>,
                <span key="m" className="text-sm font-medium text-right text-muted-foreground">{row.matchNum}</span>,
              ],
              "highScore",
              row.matches.map((m) =>
                matchRow(`M${m.matchNumber}`, `${Math.round(m.total)} pts`, m.total === row.best)
              )
            )
          )}
        </CardContent>
      </Card>

      {/* Matchday Wins Table */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[var(--tw-emerald-text)]" />
            Matchday Wins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div
            className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide"
            style={{ gridTemplateColumns: "1fr 3.5rem 1.5rem" }}
          >
            <span>Member</span>
            <span className="text-right">Wins</span>
            <span />
          </div>
          {wins.map((row) =>
            renderRow(
              row.userId,
              row.name,
              [
                <span key="w" className="text-sm font-semibold text-right text-[var(--tw-emerald-text)]">{row.winCount}</span>,
              ],
              "wins",
              row.wonMatches.length > 0
                ? row.wonMatches
                    .sort((a, b) => b.matchNumber - a.matchNumber)
                    .map((m) => matchRow(`M${m.matchNumber}`, `${Math.round(m.total)} pts`, true))
                : [<p key="none" className="text-xs text-muted-foreground py-1">No wins yet</p>]
            )
          )}
        </CardContent>
      </Card>

      {/* Consistency Table */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--tw-sky-text)]" />
            Consistency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div
            className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide"
            style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 1.5rem" }}
          >
            <span>Member</span>
            <span className="text-right">Top-2</span>
            <span className="text-right">Avg</span>
            <span />
          </div>
          {consistency.map((row) =>
            renderRow(
              row.userId,
              row.name,
              [
                <span key="t2" className="text-sm font-semibold text-right text-[var(--tw-sky-text)]">{row.top2}</span>,
                <span key="avg" className="text-sm font-medium text-right text-muted-foreground">{row.avg}</span>,
              ],
              "consistency",
              row.matches
                .sort((a, b) => b.matchNumber - a.matchNumber)
                .map((m) =>
                  matchRow(`M${m.matchNumber}`, `${Math.round(m.total)} pts (#${m.rank})`, m.rank <= 2)
                )
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}


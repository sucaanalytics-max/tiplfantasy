"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowLeft, ChevronDown, Trophy, ClipboardList, BarChart3, Swords, Users } from "lucide-react"
import { RankBadge } from "@/components/rank-badge"
import { Podium } from "@/components/podium"
import { TeamLogo } from "@/components/team-logo"
import { EmptyState } from "@/components/empty-state"
import { LiveRefresher } from "@/components/live-refresher"
import { MomentumChart } from "@/components/momentum-chart"
import { FantasyHUD } from "@/components/live/fantasy-hud"
import { CricketStrip } from "@/components/live/cricket-strip"
import { SummaryStrip } from "@/components/live/summary-strip"
import { ThreatsSection } from "@/components/live/threats-section"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import { getPreMatchAnalysis } from "@/actions/matches"
import { AnalysisContent } from "@/components/analysis-content"
import type { PreMatchAnalysis } from "@/lib/match-analysis"

// ─── Types ──────────────────────────────────────────────────────────────

export type TeamInfo = { short_name: string; color: string; logo_url: string | null }

export type PlayerScoreRow = {
  id: string
  player_id: string
  fantasy_points: number | string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number | string
  runs_conceded: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
  breakdown: Record<string, number> | null
  player: { name: string; role: string; team_id: string; team: { short_name: string; color: string } }
}

export type UserScoreRow = {
  user_id: string
  total_points: number | string
  rank: number | null
  captain_points: number | string
  vc_points: number | string
  profile: { display_name: string }
}

export type SelectionRow = {
  user_id: string
  captain_id: string | null
  vice_captain_id: string | null
  player_ids: string[]
}

type Props = {
  match: {
    id: string
    match_number: number
    status: string
    result_summary: string | null
    cricapi_match_id: string | null
    start_time: string
  }
  home: TeamInfo
  away: TeamInfo
  playerScores: PlayerScoreRow[]
  userScores: UserScoreRow[]
  myScore: UserScoreRow | null
  myPlayerIds: string[]
  myCaptainId: string | null
  myVcId: string | null
  allSelections: SelectionRow[]
  captainPicks: Record<string, { name: string }>
  currentUserId: string
  banter?: Array<{ message: string; event_type: string }>
  userLeagues?: { id: string; name: string; memberIds: string[] }[]
  lastBalls?: Array<{ ball: number; runs: number; four: boolean; six: boolean; wicket: boolean }>
  snapshots?: Array<{ over_number: number; scores: Record<string, number> }>
  userNames?: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────────────

const BREAKDOWN_LABELS: Record<string, string> = {
  run: "Runs", four_bonus: "4s Bonus", six_bonus: "6s Bonus",
  thirty: "30+", half_century: "50 Bonus", century: "100 Bonus",
  duck: "Duck", sr_above_170: "SR>170", sr_150_170: "SR 150-170",
  sr_below_70: "SR<70", sr_70_80: "SR 70-80",
  wicket: "Wickets", maiden: "Maiden", three_wicket_haul: "3W Haul",
  four_wicket_haul: "4W Haul", five_wicket_haul: "5W Haul",
  econ_below_5: "Econ<5", econ_5_6: "Econ 5-6",
  econ_10_11: "Econ 10-11", econ_above_11: "Econ>11",
  catch: "Catches", stumping: "Stumping", run_out: "Run Out",
  three_catch_bonus: "3+ Catches", potm: "POTM", playing_xi_bonus: "Playing XI",
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  BAT: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  AR: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  BOWL: "text-purple-400 border-purple-400/30 bg-purple-400/10",
}

function sr(runs: number, balls: number): string {
  if (balls === 0) return "-"
  return ((runs / balls) * 100).toFixed(1)
}

function econ(runs: number, overs: number): string {
  if (overs === 0) return "-"
  return (runs / overs).toFixed(2)
}

// ─── Component ──────────────────────────────────────────────────────────

export function ScoresClient({
  match, home, away, playerScores, userScores, myScore,
  myPlayerIds, myCaptainId, myVcId, allSelections,
  captainPicks, currentUserId, banter = [], userLeagues = [],
  lastBalls = [], snapshots = [], userNames = {},
}: Props) {
  const [activeTab, setActiveTab] = useState("board")
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [leagueFilter, setLeagueFilter] = useState<string | null>(
    userLeagues.length > 0 ? userLeagues[0].id : null
  )
  const [compareUserId, setCompareUserId] = useState<string | null>(null)
  const [statsSubTab, setStatsSubTab] = useState<"fantasy" | "scorecard">("fantasy")
  const [analysis, setAnalysis] = useState<PreMatchAnalysis | null>(null)
  const [analysisWhatsapp, setAnalysisWhatsapp] = useState<string>("")
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisCopied, setAnalysisCopied] = useState(false)

  const isLive = match.status === "live"
  const myPlayerSet = new Set(myPlayerIds)

  // Build lookup maps
  const psMap = new Map(playerScores.map((ps) => [ps.player_id, ps]))
  const selMap = new Map(allSelections.map((s) => [s.user_id, s]))

  // My XI sorted by effective points
  const myXI = useMemo(() =>
    myPlayerIds
      .map((pid) => psMap.get(pid))
      .filter(Boolean)
      .map((ps) => {
        const isC = myCaptainId === ps!.player_id
        const isVC = myVcId === ps!.player_id
        const mult = isC ? 2 : isVC ? 1.5 : 1
        return { ...ps!, isC, isVC, mult, effective: Math.round(Number(ps!.fantasy_points) * mult * 100) / 100 }
      })
      .sort((a, b) => b.effective - a.effective),
    [myPlayerIds, myCaptainId, myVcId, playerScores]
  )

  // Scorecard: group players by team
  const homeTeamPlayers = playerScores.filter((ps) => ps.player.team.short_name === home.short_name)
  const awayTeamPlayers = playerScores.filter((ps) => ps.player.team.short_name === away.short_name)

  // Captain name for HUD
  const captainPlayer = myCaptainId ? psMap.get(myCaptainId) : null
  const captainPoints = Number(myScore?.captain_points ?? 0)

  // Leader data
  const leader = userScores[0] ?? null
  const leaderPoints = Number(leader?.total_points ?? 0)

  // Threats: players NOT in my XI that are owned by >40% of users and scoring
  const threats = useMemo(() => {
    if (allSelections.length < 2) return []
    const totalUsers = allSelections.length
    const ownershipCount = new Map<string, number>()
    for (const sel of allSelections) {
      for (const pid of sel.player_ids) {
        ownershipCount.set(pid, (ownershipCount.get(pid) ?? 0) + 1)
      }
    }
    return playerScores
      .filter((ps) => !myPlayerSet.has(ps.player_id) && Number(ps.fantasy_points) > 0)
      .map((ps) => {
        const count = ownershipCount.get(ps.player_id) ?? 0
        return {
          name: ps.player.name,
          role: ps.player.role,
          teamShortName: ps.player.team.short_name,
          fantasyPoints: Number(ps.fantasy_points),
          ownershipPct: Math.round((count / totalUsers) * 100),
          ownerCount: count,
          totalUsers,
        }
      })
      .filter((t) => t.ownershipPct >= 40)
      .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      .slice(0, 5)
  }, [playerScores, allSelections, myPlayerSet])

  // Compare data
  const compareOpponents = useMemo(() =>
    userScores.filter((s) => s.user_id !== currentUserId),
    [userScores, currentUserId]
  )

  const compareData = useMemo(() => {
    const opId = compareUserId ?? compareOpponents[0]?.user_id
    if (!opId) return null
    const mySel = selMap.get(currentUserId)
    const theirSel = selMap.get(opId)
    if (!mySel || !theirSel) return null

    const mySet = new Set(mySel.player_ids)
    const theirSet = new Set(theirSel.player_ids)

    const myEdge = mySel.player_ids.filter((pid) => !theirSet.has(pid)).map((pid) => {
      const ps = psMap.get(pid)
      if (!ps) return null
      const isC = mySel.captain_id === pid
      const isVC = mySel.vice_captain_id === pid
      const mult = isC ? 2 : isVC ? 1.5 : 1
      return { ...ps, isC, isVC, effective: Math.round(Number(ps.fantasy_points) * mult * 100) / 100 }
    }).filter(Boolean).sort((a, b) => b!.effective - a!.effective)

    const theirEdge = theirSel.player_ids.filter((pid) => !mySet.has(pid)).map((pid) => {
      const ps = psMap.get(pid)
      if (!ps) return null
      const isC = theirSel.captain_id === pid
      const isVC = theirSel.vice_captain_id === pid
      const mult = isC ? 2 : isVC ? 1.5 : 1
      return { ...ps, isC, isVC, effective: Math.round(Number(ps.fantasy_points) * mult * 100) / 100 }
    }).filter(Boolean).sort((a, b) => b!.effective - a!.effective)

    const shared = mySel.player_ids.filter((pid) => theirSet.has(pid)).map((pid) => {
      const ps = psMap.get(pid)
      if (!ps) return null
      const myMult = mySel.captain_id === pid ? 2 : mySel.vice_captain_id === pid ? 1.5 : 1
      const theirMult = theirSel.captain_id === pid ? 2 : theirSel.vice_captain_id === pid ? 1.5 : 1
      return { ...ps, myMult, theirMult, myEff: Math.round(Number(ps.fantasy_points) * myMult * 100) / 100, theirEff: Math.round(Number(ps.fantasy_points) * theirMult * 100) / 100 }
    }).filter(Boolean)

    return { opponentId: opId, myEdge, theirEdge, shared }
  }, [compareUserId, compareOpponents, selMap, psMap, currentUserId])

  // Global ownership stats
  const globalOwnership = useMemo(() => {
    if (allSelections.length < 2) return []
    const totalUsers = allSelections.length
    const counts = new Map<string, number>()
    for (const sel of allSelections) {
      for (const pid of sel.player_ids) counts.set(pid, (counts.get(pid) ?? 0) + 1)
    }
    return playerScores
      .map((ps) => ({
        name: ps.player.name,
        playerId: ps.player_id,
        pct: Math.round(((counts.get(ps.player_id) ?? 0) / totalUsers) * 100),
        isMine: myPlayerSet.has(ps.player_id),
      }))
      .filter((p) => p.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8)
  }, [playerScores, allSelections, myPlayerSet])

  const loadAnalysis = useCallback(async () => {
    if (analysis) return
    setAnalysisLoading(true)
    try {
      const leagueId = userLeagues.length > 0 ? userLeagues[0].id : "__first__"
      const res = await getPreMatchAnalysis(match.id, leagueId)
      if (res.analysis) setAnalysis(res.analysis)
      if (res.whatsapp) setAnalysisWhatsapp(res.whatsapp)
    } finally {
      setAnalysisLoading(false)
    }
  }, [analysis, match.id, userLeagues])

  // Auto-load analysis on mount (no lazy click needed)
  useEffect(() => { loadAnalysis() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const copyAnalysisWhatsapp = useCallback(async () => {
    if (!analysisWhatsapp) return
    await navigator.clipboard.writeText(analysisWhatsapp)
    setAnalysisCopied(true)
    setTimeout(() => setAnalysisCopied(false), 2000)
  }, [analysisWhatsapp])

  return (
    <div className="space-y-0 max-w-3xl">
      {isLive && <LiveRefresher interval={30000} />}

      {/* ── Sticky Header ──────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: `linear-gradient(135deg, ${home.color} 0%, transparent 40%, transparent 60%, ${away.color} 100%)` }}
        />
        <div className="relative px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/matches">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              {/* Team logos + VS */}
              <div className="flex items-center gap-2">
                <TeamLogo team={home} size="md" />
                <span className="text-2xs font-bold text-muted-foreground/50">VS</span>
                <TeamLogo team={away} size="md" />
              </div>
              <span className="text-xs text-muted-foreground">M#{match.match_number}</span>
            </div>
            {isLive && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-live/15 border border-status-live/20">
                <span className="h-2 w-2 rounded-full bg-status-live animate-pulse" />
                <span className="text-2xs font-bold uppercase tracking-wider text-status-live">LIVE</span>
              </div>
            )}
            {match.status === "completed" && match.result_summary && (
              <span className="text-[10px] text-muted-foreground max-w-[160px] text-right truncate">{match.result_summary}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Cricket Strip ──────────────────────────────── */}
      <CricketStrip
        cricapiMatchId={match.cricapi_match_id}
        startTime={match.start_time}
        lastBalls={lastBalls}
        isLive={isLive}
        resultSummary={!isLive ? match.result_summary : null}
      />

      {/* ── Fantasy HUD ────────────────────────────────── */}
      {myScore && (
        <FantasyHUD
          rank={myScore.rank}
          totalPoints={Number(myScore.total_points)}
          captainName={captainPlayer?.player.name ?? null}
          captainPoints={captainPoints}
          leaderPoints={leaderPoints}
          isLive={isLive}
          totalUsers={userScores.length}
        />
      )}

      {/* ── Summary Strip ──────────────────────────────── */}
      <SummaryStrip
        activeTab={activeTab}
        leaderName={leader?.profile.display_name ?? null}
        leaderPoints={leaderPoints}
        edgeCount={compareData?.myEdge.length ?? 0}
        threatCount={threats.length}
      />

      {/* ── Main Tabs ──────────────────────────────────── */}
      {playerScores.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 md:px-6">
          <TabsList className="w-full grid grid-cols-5 mb-4">
            <TabsTrigger value="board" className="gap-1 text-[11px]">
              <Trophy className="h-3.5 w-3.5" />Board
            </TabsTrigger>
            <TabsTrigger value="my-xi" className="gap-1 text-[11px]">
              <ClipboardList className="h-3.5 w-3.5" />My XI
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-1 text-[11px]">
              <Users className="h-3.5 w-3.5" />Players
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-1 text-[11px]">
              <Swords className="h-3.5 w-3.5" />Compare
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 text-[11px]">
              <BarChart3 className="h-3.5 w-3.5" />Stats
            </TabsTrigger>
          </TabsList>

          {/* ════════════════ TAB: Board ════════════════ */}
          <TabsContent value="board">
            {userScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No scores yet.</p>
            ) : (
              <div className="space-y-4">
                {/* League filter pills */}
                {userLeagues.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    <button
                      onClick={() => setLeagueFilter(null)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
                        !leagueFilter ? "bg-primary text-primary-foreground" : "glass-panel text-muted-foreground"
                      )}
                    >All</button>
                    {userLeagues.map((league) => (
                      <button
                        key={league.id}
                        onClick={() => setLeagueFilter(league.id)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
                          leagueFilter === league.id ? "bg-primary text-primary-foreground" : "glass-panel text-muted-foreground"
                        )}
                      >{league.name}</button>
                    ))}
                  </div>
                )}

                {(() => {
                  const activeLeague = userLeagues.find((l) => l.id === leagueFilter)
                  const filteredScores = activeLeague
                    ? userScores.filter((s) => activeLeague.memberIds.includes(s.user_id))
                    : userScores
                  const filteredPodium = filteredScores.length >= 3
                    ? filteredScores.slice(0, 3).map((s, i) => ({
                        name: s.profile.display_name,
                        points: Number(s.total_points),
                        rank: i + 1,
                        isCurrentUser: s.user_id === currentUserId,
                      }))
                    : undefined

                  return (
                    <>
                      {filteredPodium && <Podium entries={filteredPodium} />}
                      <div className="flex flex-col gap-1">
                        {filteredScores.map((user, idx) => {
                          const isExpanded = expandedUserId === user.user_id
                          const isMe = user.user_id === currentUserId
                          const sel = selMap.get(user.user_id)
                          return (
                            <div key={user.user_id}>
                              <button
                                onClick={() => setExpandedUserId((prev) => prev === user.user_id ? null : user.user_id)}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors",
                                  isMe && "bg-primary/10 border border-primary/20",
                                  isExpanded && !isMe && "bg-white/[0.03]"
                                )}
                              >
                                <RankBadge rank={leagueFilter ? idx + 1 : (user.rank ?? 0)} size="sm" />
                                <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAvatarColor(user.profile.display_name))}>
                                  <span className="text-white text-[10px] font-semibold">{getInitials(user.profile.display_name)}</span>
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {user.profile.display_name}
                                    {isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
                                  </p>
                                  {captainPicks[user.user_id] && (
                                    <p className="text-[10px] text-muted-foreground">C: {captainPicks[user.user_id].name}</p>
                                  )}
                                </div>
                                <span className="text-sm font-bold font-display tabular-nums shrink-0">{Number(user.total_points)}</span>
                                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                              </button>
                              {isExpanded && sel && (
                                <div className="ml-8 mr-2 mb-2 border-t border-border/40 pt-2 space-y-0.5">
                                  {sel.player_ids
                                    .map((pid) => {
                                      const ps = psMap.get(pid)
                                      if (!ps) return null
                                      const isC = sel.captain_id === pid
                                      const isVC = sel.vice_captain_id === pid
                                      const mult = isC ? 2 : isVC ? 1.5 : 1
                                      const eff = Math.round(Number(ps.fantasy_points) * mult * 100) / 100
                                      return { ...ps, isC, isVC, eff }
                                    })
                                    .filter(Boolean)
                                    .sort((a, b) => b!.eff - a!.eff)
                                    .map((p) => (
                                      <div key={p!.player_id} className="flex items-center gap-2 py-1 text-xs">
                                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border shrink-0", ROLE_COLORS[p!.player.role])}>
                                          {p!.isC ? "C" : p!.isVC ? "VC" : p!.player.role}
                                        </Badge>
                                        <span className="truncate min-w-0 font-medium">{p!.player.name}</span>
                                        <span className="text-muted-foreground text-[10px] truncate">
                                          {p!.runs > 0 && `${p!.runs}(${p!.balls_faced})`}
                                          {Number(p!.overs_bowled) > 0 && ` ${p!.wickets}/${p!.runs_conceded}`}
                                        </span>
                                        <span className="ml-auto font-bold font-display tabular-nums shrink-0">{p!.eff}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}

                {/* Top Performers */}
                {playerScores.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Top Performers</p>
                    <div className="space-y-1">
                      {playerScores.slice(0, 5).map((ps) => {
                        const isMine = myPlayerSet.has(ps.player_id)
                        return (
                          <div key={ps.player_id} className={cn(
                            "flex items-center gap-2 py-1.5 px-2.5 rounded-lg",
                            isMine ? "bg-primary/10 border border-primary/20" : "bg-white/[0.03]"
                          )}>
                            <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] shrink-0", ROLE_COLORS[ps.player.role])}>{ps.player.role}</Badge>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium truncate block">{ps.player.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {ps.runs > 0 && `${ps.runs}(${ps.balls_faced})`}
                                {ps.runs > 0 && Number(ps.overs_bowled) > 0 && " · "}
                                {Number(ps.overs_bowled) > 0 && `${ps.wickets}/${ps.runs_conceded}`}
                              </span>
                            </div>
                            <span className="text-sm font-bold font-display tabular-nums shrink-0">{Number(ps.fantasy_points)}</span>
                            {isMine && <span className="text-[8px] text-primary">●</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Threats */}
                <ThreatsSection threats={threats} />

                {/* Momentum */}
                {snapshots.length >= 2 && (
                  <MomentumChart snapshots={snapshots} userNames={userNames} currentUserId={currentUserId} />
                )}

                {/* Banter */}
                {banter.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/[0.04] bg-white/[0.03] flex items-center gap-2">
                      <span className="text-sm">🎭</span>
                      <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                        {match.status === "completed" ? "Match Story" : "Match Highlights"}
                      </span>
                    </div>
                    <div className="divide-y divide-white/[0.04] max-h-36 overflow-y-auto">
                      {banter.map((b, i) => (
                        <div key={i} className="px-3 py-2 text-xs text-foreground/90">{b.message}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ════════════════ TAB: My XI ════════════════ */}
          <TabsContent value="my-xi">
            {myXI.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">You didn&apos;t pick a team for this match.</p>
            ) : (
              <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
                <div className="grid grid-cols-[2.5rem_1fr_1.5rem_1.5rem_1.5rem_1.5rem_1px_1.5rem_1.8rem_1.8rem_1.5rem_3.2rem] gap-px px-3 py-2 text-[9px] text-muted-foreground/70 uppercase tracking-widest font-semibold border-b border-white/[0.06] bg-secondary/40 min-w-[420px]">
                  <span></span><span>Player</span>
                  <span className="text-right">R</span><span className="text-right">B</span>
                  <span className="text-right">4s</span><span className="text-right">6s</span>
                  <span></span>
                  <span className="text-right">W</span><span className="text-right">Ov</span>
                  <span className="text-right">RC</span><span className="text-right">M</span>
                  <span className="text-right">Pts</span>
                </div>
                {myXI.map((ps, idx) => {
                  const role = ps.player.role
                  const isLast = idx === myXI.length - 1
                  const bowled = Number(ps.overs_bowled) > 0
                  const isPlayerExpanded = expandedPlayerId === ps.player_id
                  const bd = ps.breakdown as Record<string, number> | null
                  return (
                    <div key={ps.player_id}>
                      <button
                        onClick={() => setExpandedPlayerId((prev) => prev === ps.player_id ? null : ps.player_id)}
                        className={cn(
                          "w-full grid grid-cols-[2.5rem_1fr_1.5rem_1.5rem_1.5rem_1.5rem_1px_1.5rem_1.8rem_1.8rem_1.5rem_3.2rem] gap-px items-center px-3 py-1.5 min-w-[420px] text-left",
                          !isLast && !isPlayerExpanded && "border-b border-white/[0.04]",
                          isPlayerExpanded && "bg-white/[0.03]"
                        )}
                      >
                        <div className="flex items-center gap-0.5">
                          {ps.isC && <span className="text-[8px] font-bold text-amber-400 mr-px">C</span>}
                          {ps.isVC && <span className="text-[8px] font-bold text-sky-400 mr-px">VC</span>}
                          <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] border leading-none", ROLE_COLORS[role])}>{role}</Badge>
                        </div>
                        <span className="text-[13px] font-medium truncate text-foreground">{ps.player.name}</span>
                        <span className="text-[13px] text-right tabular-nums">{ps.runs > 0 ? ps.runs : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.balls_faced > 0 ? ps.balls_faced : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.fours > 0 ? ps.fours : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.sixes > 0 ? ps.sixes : "-"}</span>
                        <span className="h-4 bg-border/20" />
                        <span className="text-[13px] text-right tabular-nums">{bowled ? ps.wickets : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{bowled ? ps.overs_bowled : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{bowled ? ps.runs_conceded : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{bowled ? ps.maidens : "-"}</span>
                        <div className="text-right">
                          <span className="text-[13px] font-bold font-display tabular-nums">{ps.effective}</span>
                          {ps.mult > 1 && <p className="text-[8px] text-muted-foreground/50">{Number(ps.fantasy_points)}×{ps.mult}</p>}
                        </div>
                      </button>
                      {isPlayerExpanded && bd && Object.keys(bd).length > 0 && (
                        <div className={cn("flex flex-wrap gap-1.5 px-3 py-2 bg-secondary/10 min-w-[420px]", !isLast && "border-b border-white/[0.04]")}>
                          {Object.entries(bd).map(([key, pts]) => (
                            <span key={key} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", pts > 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
                              {BREAKDOWN_LABELS[key] ?? key} {pts > 0 ? "+" : ""}{pts}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Fielding summary */}
                {(() => {
                  const totalCatches = myXI.reduce((s, p) => s + p.catches, 0)
                  const totalStumpings = myXI.reduce((s, p) => s + p.stumpings, 0)
                  const totalRunOuts = myXI.reduce((s, p) => s + p.run_outs, 0)
                  if (totalCatches + totalStumpings + totalRunOuts === 0) return null
                  return (
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-muted-foreground/50 border-t border-border/20 bg-secondary/10">
                      <span className="font-semibold uppercase tracking-widest text-muted-foreground/40">Field</span>
                      {totalCatches > 0 && <span>{totalCatches}c</span>}
                      {totalStumpings > 0 && <span>{totalStumpings}st</span>}
                      {totalRunOuts > 0 && <span>{totalRunOuts}ro</span>}
                    </div>
                  )
                })()}
              </div>
            )}
          </TabsContent>

          {/* ════════════════ TAB: Compare ════════════════ */}
          <TabsContent value="compare">
            {compareOpponents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No other users to compare with.</p>
            ) : (
              <div className="space-y-4">
                {/* Opponent selector */}
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                  {compareOpponents.map((opp) => {
                    const isSelected = (compareUserId ?? compareOpponents[0]?.user_id) === opp.user_id
                    return (
                      <button
                        key={opp.user_id}
                        onClick={() => setCompareUserId(opp.user_id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0",
                          isSelected ? "bg-primary text-primary-foreground" : "glass-panel text-muted-foreground"
                        )}
                      >
                        <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0", getAvatarColor(opp.profile.display_name))}>
                          {getInitials(opp.profile.display_name)}
                        </span>
                        {opp.profile.display_name.split(" ")[0]}
                      </button>
                    )
                  })}
                </div>

                {compareData && (
                  <>
                    {/* Your Edge */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                          Your Edge <Badge variant="secondary" className="ml-1 text-[10px]">{compareData.myEdge.length}</Badge>
                        </p>
                      </div>
                      {compareData.myEdge.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-4">No unique picks</p>
                      ) : (
                        <div className="space-y-1 border-l-2 border-emerald-400/40 pl-3">
                          {compareData.myEdge.map((p) => (
                            <div key={p!.player_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/40 text-xs">
                              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] shrink-0", ROLE_COLORS[p!.player.role])}>
                                {p!.isC ? "C" : p!.isVC ? "VC" : p!.player.role}
                              </Badge>
                              <span className="font-medium truncate">{p!.player.name}</span>
                              <span className="ml-auto font-bold tabular-nums shrink-0">+{p!.effective}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Their Edge */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                          Their Edge <Badge variant="secondary" className="ml-1 text-[10px]">{compareData.theirEdge.length}</Badge>
                        </p>
                      </div>
                      {compareData.theirEdge.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-4">No unique picks</p>
                      ) : (
                        <div className="space-y-1 border-l-2 border-red-400/40 pl-3">
                          {compareData.theirEdge.map((p) => (
                            <div key={p!.player_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/40 text-xs">
                              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] shrink-0", ROLE_COLORS[p!.player.role])}>
                                {p!.isC ? "C" : p!.isVC ? "VC" : p!.player.role}
                              </Badge>
                              <span className="font-medium truncate">{p!.player.name}</span>
                              <span className="ml-auto font-bold tabular-nums text-red-400 shrink-0">+{p!.effective}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Shared */}
                    {compareData.shared.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Shared <Badge variant="secondary" className="ml-1 text-[10px]">{compareData.shared.length}</Badge>
                          </p>
                        </div>
                        <div className="space-y-1 border-l-2 border-muted-foreground/30 pl-3">
                          {compareData.shared.map((p) => {
                            const hasDiff = p!.myMult !== p!.theirMult
                            return (
                              <div key={p!.player_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/40 text-xs">
                                <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] shrink-0", ROLE_COLORS[p!.player.role])}>{p!.player.role}</Badge>
                                <span className="font-medium truncate">{p!.player.name}</span>
                                {hasDiff && (
                                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                    {p!.myEff} vs {p!.theirEff}
                                  </span>
                                )}
                                {!hasDiff && (
                                  <span className="ml-auto text-muted-foreground tabular-nums shrink-0">{p!.myEff}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Global popularity */}
                {globalOwnership.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Global Popularity</p>
                    <div className="flex flex-wrap gap-1.5">
                      {globalOwnership.map((p) => (
                        <span key={p.playerId} className={cn(
                          "text-[10px] px-2 py-1 rounded-full border",
                          p.isMine ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                        )}>
                          {p.pct}% {p.name.split(" ").pop()}
                          {!p.isMine && <span className="text-amber-400 ml-1">✗</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ownership Matrix (lazy loaded) */}
                {analysisLoading ? (
                  <p className="text-sm text-muted-foreground animate-pulse text-center py-4">Loading analysis...</p>
                ) : analysis ? (
                  <AnalysisContent analysis={analysis} whatsapp={analysisWhatsapp} copied={analysisCopied} onCopy={copyAnalysisWhatsapp} />
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* ════════════════ TAB: Players ════════════════ */}
          <TabsContent value="players">
            {playerScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No scores yet.</p>
            ) : (
              <div className="space-y-6">
                {[
                  { team: away, players: awayTeamPlayers, label: away.short_name },
                  { team: home, players: homeTeamPlayers, label: home.short_name },
                ].map(({ team, players: teamPlayers, label }) => {
                  const sorted = [...teamPlayers].sort((a, b) => Number(b.fantasy_points) - Number(a.fantasy_points))
                  return (
                    <div key={team.short_name} className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] bg-white/[0.03]">
                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                        <TeamLogo team={team} size="sm" />
                        <span className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: team.color }}>{label}</span>
                      </div>
                      {sorted.map((ps, idx) => {
                        const bd = ps.breakdown as Record<string, number> | null
                        const entries = bd ? Object.entries(bd).filter(([, v]) => v !== 0) : []
                        const isMine = myPlayerSet.has(ps.player_id)
                        const isLast = idx === sorted.length - 1
                        return (
                          <div key={ps.player_id} className={cn("px-3 py-2.5", !isLast && "border-b border-white/[0.04]", isMine && "bg-primary/5")}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] border leading-none shrink-0", ROLE_COLORS[ps.player.role])}>{ps.player.role}</Badge>
                              <span className="text-[13px] font-semibold truncate min-w-0 flex-1">
                                {ps.player.name}
                                {isMine && <span className="text-[8px] text-primary ml-1">●</span>}
                              </span>
                              <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">
                                {ps.runs > 0 || ps.balls_faced > 0 ? `${ps.runs}(${ps.balls_faced})` : ""}
                                {ps.runs > 0 && Number(ps.overs_bowled) > 0 ? " · " : ""}
                                {Number(ps.overs_bowled) > 0 ? `${ps.wickets}/${ps.runs_conceded}` : ""}
                              </span>
                              <span className="text-base font-bold font-display tabular-nums shrink-0 ml-2 min-w-[2.5rem] text-right">{Number(ps.fantasy_points)}</span>
                            </div>
                            {entries.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                                {entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([key, pts]) => (
                                  <span key={key} className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", pts > 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
                                    {BREAKDOWN_LABELS[key] ?? key} {pts > 0 ? "+" : ""}{pts}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ════════════════ TAB: Stats ════════════════ */}
          <TabsContent value="stats">
            {/* Sub-toggle */}
            <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-secondary/40 w-fit">
              <button
                onClick={() => setStatsSubTab("fantasy")}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", statsSubTab === "fantasy" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >Fantasy Pts</button>
              <button
                onClick={() => setStatsSubTab("scorecard")}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", statsSubTab === "scorecard" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >Scorecard</button>
            </div>

            {statsSubTab === "fantasy" ? (
              /* Fantasy breakdown by team */
              <div className="space-y-6">
                {[
                  { team: away, players: awayTeamPlayers, label: away.short_name },
                  { team: home, players: homeTeamPlayers, label: home.short_name },
                ].map(({ team, players: teamPlayers, label }) => {
                  const sorted = [...teamPlayers].sort((a, b) => Number(b.fantasy_points) - Number(a.fantasy_points))
                  return (
                    <div key={team.short_name} className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] bg-white/[0.03]">
                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                        <TeamLogo team={team} size="sm" />
                        <span className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: team.color }}>{label}</span>
                      </div>
                      {sorted.map((ps, idx) => {
                        const bd = ps.breakdown as Record<string, number> | null
                        const entries = bd ? Object.entries(bd).filter(([, v]) => v !== 0) : []
                        const isMine = myPlayerSet.has(ps.player_id)
                        const isLast = idx === sorted.length - 1
                        return (
                          <div key={ps.player_id} className={cn("px-3 py-2.5", !isLast && "border-b border-white/[0.04]", isMine && "bg-primary/5")}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] border leading-none shrink-0", ROLE_COLORS[ps.player.role])}>{ps.player.role}</Badge>
                              <span className="text-[13px] font-semibold truncate min-w-0 flex-1">
                                {ps.player.name}
                                {isMine && <span className="text-[8px] text-primary ml-1">●</span>}
                              </span>
                              <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">
                                {ps.runs > 0 || ps.balls_faced > 0 ? `${ps.runs}(${ps.balls_faced})` : ""}
                                {ps.runs > 0 && Number(ps.overs_bowled) > 0 ? " · " : ""}
                                {Number(ps.overs_bowled) > 0 ? `${ps.wickets}/${ps.runs_conceded}` : ""}
                              </span>
                              <span className="text-base font-bold font-display tabular-nums shrink-0 ml-2 min-w-[2.5rem] text-right">{Number(ps.fantasy_points)}</span>
                            </div>
                            {entries.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                                {entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([key, pts]) => (
                                  <span key={key} className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", pts > 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
                                    {BREAKDOWN_LABELS[key] ?? key} {pts > 0 ? "+" : ""}{pts}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Scorecard by team */
              <div className="space-y-6">
                {[
                  { team: away, players: awayTeamPlayers, label: `${away.short_name} Innings` },
                  { team: home, players: homeTeamPlayers, label: `${home.short_name} Innings` },
                ].map(({ team, players: teamPlayers, label }) => {
                  const batsmen = teamPlayers.filter((p) => p.runs > 0 || p.balls_faced > 0)
                  const bowlers = teamPlayers.filter((p) => Number(p.overs_bowled) > 0)
                  return (
                    <div key={team.short_name}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: team.color }} />
                        <h3 className="text-sm font-bold font-display">{label}</h3>
                      </div>
                      {batsmen.length > 0 && (
                        <div className="mb-3">
                          <div className="grid grid-cols-[1fr_2rem_2rem_2rem_2rem_3rem_3.5rem] gap-1 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-white/[0.06]">
                            <span>Batter</span><span className="text-right">R</span><span className="text-right">B</span>
                            <span className="text-right">4s</span><span className="text-right">6s</span>
                            <span className="text-right">SR</span><span className="text-right font-bold">Pts</span>
                          </div>
                          {batsmen.sort((a, b) => b.runs - a.runs).map((ps) => {
                            const isMine = myPlayerSet.has(ps.player_id)
                            return (
                              <div key={ps.player_id} className={cn("grid grid-cols-[1fr_2rem_2rem_2rem_2rem_3rem_3.5rem] gap-1 items-center px-3 py-1.5 border-b border-white/[0.04]", isMine && "bg-primary/5")}>
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-sm truncate">{ps.player.name}</span>
                                  {isMine && <span className="text-[8px] text-primary">●</span>}
                                </div>
                                <span className="text-sm text-right font-medium tabular-nums">{ps.runs}</span>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{ps.balls_faced}</span>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{ps.fours}</span>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{ps.sixes}</span>
                                <span className="text-[11px] text-right tabular-nums text-muted-foreground">{sr(ps.runs, ps.balls_faced)}</span>
                                <span className="text-sm text-right font-bold font-display tabular-nums">{Number(ps.fantasy_points)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {bowlers.length > 0 && (
                        <div>
                          <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_3rem_3.5rem] gap-1 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-white/[0.06]">
                            <span>Bowler</span><span className="text-right">O</span><span className="text-right">M</span>
                            <span className="text-right">R</span><span className="text-right">W</span>
                            <span className="text-right">Econ</span><span className="text-right font-bold">Pts</span>
                          </div>
                          {bowlers.sort((a, b) => b.wickets - a.wickets || Number(a.runs_conceded) - Number(b.runs_conceded)).map((ps) => {
                            const isMine = myPlayerSet.has(ps.player_id)
                            return (
                              <div key={`bowl-${ps.player_id}`} className={cn("grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_3rem_3.5rem] gap-1 items-center px-3 py-1.5 border-b border-white/[0.04]", isMine && "bg-primary/5")}>
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-sm truncate">{ps.player.name}</span>
                                  {isMine && <span className="text-[8px] text-primary">●</span>}
                                </div>
                                <span className="text-sm text-right tabular-nums">{ps.overs_bowled}</span>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{ps.maidens}</span>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{ps.runs_conceded}</span>
                                <span className="text-sm text-right font-medium tabular-nums">{ps.wickets}</span>
                                <span className="text-[11px] text-right tabular-nums text-muted-foreground">{econ(ps.runs_conceded, Number(ps.overs_bowled))}</span>
                                <span className="text-sm text-right font-bold font-display tabular-nums">{Number(ps.fantasy_points)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="px-4 md:px-6">
          <EmptyState
            icon={Trophy}
            title={isLive ? "Calculating live scores..." : "Scores not yet available"}
            description={
              isLive
                ? "Fantasy points will appear here within 5 minutes of the match starting. This page refreshes automatically."
                : "Check back after the match is completed and scores are published"
            }
            action={{ label: "Back to Matches", href: "/matches" }}
          />
        </div>
      )}
    </div>
  )
}

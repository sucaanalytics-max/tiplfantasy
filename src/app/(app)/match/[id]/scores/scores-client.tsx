"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowLeft, ChevronDown, Trophy, Users, ClipboardList } from "lucide-react"
import { RankBadge } from "@/components/rank-badge"
import { Podium } from "@/components/podium"
import { TeamLogo } from "@/components/team-logo"
import { EmptyState } from "@/components/empty-state"
import { LiveRefresher } from "@/components/live-refresher"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { cn } from "@/lib/utils"

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
}

// ─── Helpers ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  WK: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  BAT: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  AR: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  BOWL: "text-purple-400 border-purple-400/30 bg-purple-400/10",
}

const ROLE_BORDER: Record<string, string> = {
  WK: "border-l-amber-400",
  BAT: "border-l-blue-400",
  AR: "border-l-emerald-400",
  BOWL: "border-l-purple-400",
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
  captainPicks, currentUserId,
}: Props) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const myPlayerSet = new Set(myPlayerIds)

  // Build lookup maps
  const psMap = new Map(playerScores.map((ps) => [ps.player_id, ps]))
  const selMap = new Map(allSelections.map((s) => [s.user_id, s]))

  // Podium data
  const podiumEntries = userScores.length >= 3
    ? userScores.slice(0, 3).map((s, i) => ({
        name: s.profile.display_name,
        points: Number(s.total_points),
        rank: i + 1,
        isCurrentUser: s.user_id === currentUserId,
      }))
    : undefined

  // My XI sorted by effective points
  const myXI = myPlayerIds
    .map((pid) => psMap.get(pid))
    .filter(Boolean)
    .map((ps) => {
      const isC = myCaptainId === ps!.player_id
      const isVC = myVcId === ps!.player_id
      const mult = isC ? 2 : isVC ? 1.5 : 1
      return { ...ps!, isC, isVC, mult, effective: Math.round(Number(ps!.fantasy_points) * mult * 100) / 100 }
    })
    .sort((a, b) => b.effective - a.effective)

  // Scorecard: group players by team
  const homeTeamPlayers = playerScores.filter((ps) => ps.player.team.short_name === home.short_name)
  const awayTeamPlayers = playerScores.filter((ps) => ps.player.team.short_name === away.short_name)

  return (
    <div className="space-y-0 max-w-3xl">
      {/* ── Match Header ────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 md:px-6 md:pt-6">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/matches">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm font-medium text-muted-foreground">Match #{match.match_number}</span>
        </div>

        {/* Team score line */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <TeamLogo team={home} size="md" />
            <span className="text-base font-bold font-display" style={{ color: home.color }}>{home.short_name}</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground tracking-wider">VS</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold font-display" style={{ color: away.color }}>{away.short_name}</span>
            <TeamLogo team={away} size="md" />
          </div>
        </div>

        {match.result_summary && (
          <p className="text-center text-xs text-muted-foreground mt-2">{match.result_summary}</p>
        )}

        {match.status === "live" && (
          <>
            <LiveRefresher interval={30000} />
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </div>
            {match.cricapi_match_id && (
              <div className="mt-1 text-center">
                <LiveScoreWidget cricapiMatchId={match.cricapi_match_id} startTime={match.start_time} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Your Score Bar ───────────────────────────────── */}
      {myScore && (
        <div className="mx-4 md:mx-6 mb-4 flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-primary/10 via-transparent to-transparent border border-primary/15">
          <div>
            <p className="text-3xl font-bold font-display tracking-tight">{Number(myScore.total_points)}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
              {Number(myScore.captain_points) > 0 && (
                <span>C ×2 <span className="text-primary/70">+{Number(myScore.captain_points)}</span></span>
              )}
              {Number(myScore.captain_points) > 0 && Number(myScore.vc_points) > 0 && <span>·</span>}
              {Number(myScore.vc_points) > 0 && (
                <span>VC ×1.5 <span className="text-primary/70">+{Number(myScore.vc_points)}</span></span>
              )}
            </div>
          </div>
          {myScore.rank != null && <RankBadge rank={myScore.rank} size="lg" />}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────── */}
      {playerScores.length > 0 ? (
        <Tabs defaultValue="your-xi" className="px-4 md:px-6">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="your-xi" className="gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              Your XI
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="scorecard" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Scorecard
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Your XI ─────────────────────────────── */}
          <TabsContent value="your-xi">
            {myXI.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">You didn&apos;t pick a team for this match.</p>
            ) : (
              <div className="rounded-lg overflow-hidden border border-border/30 bg-[hsl(var(--background))]">
                {/* Table header */}
                <div className="grid grid-cols-[2.5rem_1fr_2rem_2rem_2rem_2rem_3.5rem] gap-1 px-3 py-2 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-semibold border-b border-border/40 bg-secondary/30">
                  <span></span>
                  <span>Player</span>
                  <span className="text-right">R</span>
                  <span className="text-right">B</span>
                  <span className="text-right">4s</span>
                  <span className="text-right">6s</span>
                  <span className="text-right">Pts</span>
                </div>

                {myXI.map((ps, idx) => {
                  const role = ps.player.role
                  const hasBowled = Number(ps.overs_bowled) > 0
                  const isLast = idx === myXI.length - 1
                  return (
                    <div key={ps.player_id} className={cn(
                      !isLast && "border-b border-border/15"
                    )}>
                      {/* Main row */}
                      <div className="grid grid-cols-[2.5rem_1fr_2rem_2rem_2rem_2rem_3.5rem] gap-1 items-center px-3 py-1.5">
                        <div className="flex items-center gap-0.5">
                          {ps.isC && <span className="text-[8px] font-bold text-amber-400 mr-px">C</span>}
                          {ps.isVC && <span className="text-[8px] font-bold text-sky-400 mr-px">VC</span>}
                          <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] border leading-none", ROLE_COLORS[role])}>
                            {role}
                          </Badge>
                        </div>
                        <span className="text-[13px] font-medium truncate text-foreground">{ps.player.name}</span>
                        <span className="text-[13px] text-right tabular-nums text-foreground">{ps.runs > 0 ? ps.runs : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.balls_faced > 0 ? ps.balls_faced : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.fours > 0 ? ps.fours : "-"}</span>
                        <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.sixes > 0 ? ps.sixes : "-"}</span>
                        <div className="text-right">
                          <span className="text-[13px] font-bold font-display tabular-nums text-foreground">{ps.effective}</span>
                          {ps.mult > 1 && (
                            <p className="text-[8px] text-muted-foreground/50">{Number(ps.fantasy_points)}×{ps.mult}</p>
                          )}
                        </div>
                      </div>

                      {/* Bowling sub-row */}
                      {hasBowled && (
                        <div className="grid grid-cols-[2.5rem_1fr_2rem_2rem_2rem_2rem_3.5rem] gap-1 px-3 pb-1 -mt-0.5 text-[10px]">
                          <span />
                          <span className="text-purple-400/50 font-medium">Bowling</span>
                          <span className="text-right text-muted-foreground/50">{ps.wickets}w</span>
                          <span className="text-right text-muted-foreground/50">{ps.overs_bowled}ov</span>
                          <span className="text-right text-muted-foreground/50">{ps.runs_conceded}rc</span>
                          <span className="text-right text-muted-foreground/50">{ps.maidens}m</span>
                          <span />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Fielding summary — bottom row of the table */}
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

          {/* ── Tab: Leaderboard ──────────────────────────── */}
          <TabsContent value="leaderboard">
            {userScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No scores yet.</p>
            ) : (
              <div>
                {podiumEntries && <Podium entries={podiumEntries} />}

                <div className="flex flex-col gap-1 mt-3">
                  {userScores.map((user) => {
                    const isExpanded = expandedUserId === user.user_id
                    const isMe = user.user_id === currentUserId
                    const sel = selMap.get(user.user_id)

                    return (
                      <div key={user.user_id}>
                        <button
                          onClick={() => setExpandedUserId((prev) => prev === user.user_id ? null : user.user_id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors",
                            "hover:bg-secondary/50 active:bg-secondary/70",
                            isMe && "bg-primary/10 border border-primary/20",
                            isExpanded && !isMe && "bg-secondary/30"
                          )}
                        >
                          <RankBadge rank={user.rank ?? 0} size="sm" />
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
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Scorecard (ESPN-style by team) ─────── */}
          <TabsContent value="scorecard">
            {[
              { team: away, players: awayTeamPlayers, label: `${away.short_name} Innings` },
              { team: home, players: homeTeamPlayers, label: `${home.short_name} Innings` },
            ].map(({ team, players: teamPlayers, label }) => {
              const batsmen = teamPlayers.filter((p) => p.runs > 0 || p.balls_faced > 0)
              const bowlers = teamPlayers.filter((p) => Number(p.overs_bowled) > 0)

              return (
                <div key={team.short_name} className="mb-6">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: team.color }} />
                    <h3 className="text-sm font-bold font-display">{label}</h3>
                  </div>

                  {/* Batting */}
                  {batsmen.length > 0 && (
                    <div className="mb-3">
                      <div className="grid grid-cols-[1fr_2rem_2rem_2rem_2rem_3rem_3.5rem] gap-1 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/40">
                        <span>Batter</span>
                        <span className="text-right">R</span>
                        <span className="text-right">B</span>
                        <span className="text-right">4s</span>
                        <span className="text-right">6s</span>
                        <span className="text-right">SR</span>
                        <span className="text-right font-bold">Pts</span>
                      </div>
                      {batsmen.sort((a, b) => b.runs - a.runs).map((ps) => {
                        const isMine = myPlayerSet.has(ps.player_id)
                        return (
                          <div key={ps.player_id} className={cn(
                            "grid grid-cols-[1fr_2rem_2rem_2rem_2rem_3rem_3.5rem] gap-1 items-center px-3 py-1.5 border-b border-border/20",
                            isMine && "bg-primary/5"
                          )}>
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

                  {/* Bowling */}
                  {bowlers.length > 0 && (
                    <div>
                      <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_3rem_3.5rem] gap-1 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/40">
                        <span>Bowler</span>
                        <span className="text-right">O</span>
                        <span className="text-right">M</span>
                        <span className="text-right">R</span>
                        <span className="text-right">W</span>
                        <span className="text-right">Econ</span>
                        <span className="text-right font-bold">Pts</span>
                      </div>
                      {bowlers.sort((a, b) => b.wickets - a.wickets || Number(a.runs_conceded) - Number(b.runs_conceded)).map((ps) => {
                        const isMine = myPlayerSet.has(ps.player_id)
                        return (
                          <div key={`bowl-${ps.player_id}`} className={cn(
                            "grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_3rem_3.5rem] gap-1 items-center px-3 py-1.5 border-b border-border/20",
                            isMine && "bg-primary/5"
                          )}>
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
          </TabsContent>
        </Tabs>
      ) : (
        <div className="px-4 md:px-6">
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
        </div>
      )}
    </div>
  )
}

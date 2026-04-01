"use client"

import Link from "next/link"
import React, { useState, useMemo, useCallback } from "react"
import { ArrowLeft, Trophy, GitCompareArrows, ChevronDown, BarChart3, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ROLE_COLORS } from "@/lib/badges"
import { getInitials, getAvatarColor, getAvatarHexColor } from "@/lib/avatar"
import { LiveRefresher } from "@/components/live-refresher"
import { PlayerRow as SharedPlayerRow } from "@/components/shared/player-row"
import { LeaderboardRow } from "@/components/shared/leaderboard-row"
import { getPreMatchAnalysis } from "@/actions/matches"
import type { PreMatchAnalysis, MatrixCell } from "@/lib/match-analysis"
import type { PlayerWithTeam, PlayerRole } from "@/lib/types"

type MemberSelection = {
  user_id: string
  display_name: string
  captain_id: string | null
  vice_captain_id: string | null
  player_ids: string[]
}

type MemberScore = {
  user_id: string
  display_name: string
  total_points: number
  rank: number | null
  captain_points: number
  vc_points: number
  breakdown: Record<string, number> | null
}

type MatchInfo = {
  id: string
  match_number: number
  status: string
  team_home: { short_name: string; color: string }
  team_away: { short_name: string; color: string }
}

type Props = {
  leagueId: string
  leagueName: string
  match: MatchInfo
  currentUserId: string
  memberSelections: MemberSelection[]
  players: PlayerWithTeam[]
  playerPoints?: Record<string, number>
  memberScores?: MemberScore[]
}

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

function multiplierLabel(isC: boolean, isVC: boolean): string {
  if (isC) return "C (2×)"
  if (isVC) return "VC (1.5×)"
  return "1×"
}

function PlayerRow({
  player,
  myMultiplier,
  theirMultiplier,
  showSharedNotes,
  points,
}: {
  player: PlayerWithTeam
  myMultiplier?: string
  theirMultiplier?: string
  showSharedNotes?: boolean
  points?: number
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-secondary/40 border border-border/30">
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0", ROLE_COLORS[player.role])}>
        {player.role}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{player.name}</p>
        <p className="text-[11px] text-muted-foreground">{player.team.short_name}</p>
      </div>
      {showSharedNotes && myMultiplier && theirMultiplier ? (
        <div className="text-[10px] text-right shrink-0 space-y-0.5">
          <p className="text-primary/80">You: {myMultiplier}</p>
          <p className="text-muted-foreground">They: {theirMultiplier}</p>
        </div>
      ) : myMultiplier && myMultiplier !== "1×" ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-400 shrink-0">
          {myMultiplier}
        </span>
      ) : theirMultiplier && theirMultiplier !== "1×" ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-400/30 bg-red-400/10 text-red-400 shrink-0">
          {theirMultiplier}
        </span>
      ) : null}
      {points !== undefined && (
        <span className="text-sm font-bold font-display tabular-nums shrink-0">{points}</span>
      )}
    </div>
  )
}

const TIER_ORDER: PreMatchAnalysis["picks"][0]["status"][] = ["UNIVERSAL", "CORE", "COMMON", "SPLIT", "DIFF", "UNIQUE"]
const TIER_LABEL: Record<string, string> = { UNIVERSAL: "Universal (100%)", CORE: "Core (80%+)", COMMON: "Common (60%+)", SPLIT: "Split (40%+)", DIFF: "Differential", UNIQUE: "Unique" }
const TIER_DOT: Record<string, string> = { UNIVERSAL: "bg-emerald-500", CORE: "bg-blue-500", COMMON: "bg-yellow-500", SPLIT: "bg-orange-500", DIFF: "bg-red-500", UNIQUE: "bg-purple-500" }

function getMatrixCell(playerId: string, user: PreMatchAnalysis["users"][0]): MatrixCell {
  if (user.captainId === playerId) return "C"
  if (user.vcId === playerId) return "VC"
  if (user.playerIds.includes(playerId)) return "picked"
  return null
}

function MatrixCellBadge({ cell }: { cell: MatrixCell }) {
  if (cell === "C") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-emerald-500 rounded-[3px]">
        <span className="text-[10px] font-bold text-white">C</span>
      </div>
    )
  }
  if (cell === "VC") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-blue-500 rounded-[3px]">
        <span className="text-[10px] font-bold text-white">VC</span>
      </div>
    )
  }
  if (cell === "picked") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-700 rounded-[3px]">
        <span className="text-[10px] text-zinc-300">✓</span>
      </div>
    )
  }
  return <div className="w-full h-full bg-zinc-800/40 rounded-[3px]" />
}

function AnalysisContent({ analysis, whatsapp, copied, onCopy }: { analysis: PreMatchAnalysis; whatsapp: string; copied: boolean; onCopy: () => void }) {
  // Group picks by tier
  const tiers = useMemo(() => {
    const groups: Record<string, typeof analysis.picks> = {}
    for (const tier of TIER_ORDER) groups[tier] = []
    for (const p of analysis.picks) groups[p.status].push(p)
    return TIER_ORDER.filter((t) => groups[t].length > 0).map((t) => ({ tier: t, picks: groups[t] }))
  }, [analysis.picks])

  // Abbreviate display names for column headers (first name or short form)
  const colNames = useMemo(() => {
    return analysis.users.map((u) => {
      const parts = u.displayName.split(" ")
      if (u.displayName.length <= 6) return u.displayName
      // Use first name, or initials if first name is also long
      return parts[0].length <= 8 ? parts[0] : parts[0].slice(0, 6)
    })
  }, [analysis.users])

  return (
    <div className="space-y-5">
      {/* Copy button */}
      <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy for WhatsApp"}
      </Button>

      {/* Ownership Matrix */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ownership Matrix</h3>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-background z-10 min-w-[120px]">PLAYER</th>
                {colNames.map((name, i) => (
                  <th key={i} className="text-center px-0.5 py-2 font-semibold text-muted-foreground" style={{ minWidth: 44 }}>
                    <span className="block truncate max-w-[44px] mx-auto">{name}</span>
                  </th>
                ))}
                <th className="text-right pl-2 py-2 font-semibold text-muted-foreground w-10">%</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(({ tier, picks }) => (
                <React.Fragment key={tier}>
                  {/* Tier header row */}
                  <tr>
                    <td colSpan={colNames.length + 2} className="pt-3 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", TIER_DOT[tier])} />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{TIER_LABEL[tier]}</span>
                      </div>
                    </td>
                  </tr>
                  {picks.map((p) => (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="py-1.5 pr-2 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", TIER_DOT[p.status])} />
                          <span className="font-medium truncate max-w-[100px]">{p.name}</span>
                        </div>
                      </td>
                      {analysis.users.map((u) => {
                        const cell = getMatrixCell(p.id, u)
                        return (
                          <td key={u.displayName} className="px-0.5 py-1.5">
                            <div className="w-[38px] h-[24px] mx-auto">
                              <MatrixCellBadge cell={cell} />
                            </div>
                          </td>
                        )
                      })}
                      <td className={cn(
                        "text-right pl-2 py-1.5 font-bold tabular-nums",
                        p.ownership === 100 ? "text-emerald-400" :
                        p.ownership >= 80 ? "text-blue-400" :
                        p.ownership >= 60 ? "text-yellow-400" :
                        p.ownership >= 40 ? "text-orange-400" :
                        "text-red-400"
                      )}>
                        {p.ownership}%
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-emerald-500 rounded-[2px]" />
            <span>Captain</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-500 rounded-[2px]" />
            <span>Vice Captain</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-zinc-700 rounded-[2px]" />
            <span>Picked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-zinc-800/40 rounded-[2px]" />
            <span>Not Picked</span>
          </div>
        </div>
      </div>

      {/* Per-user threats */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Threats Per User</h3>
        <div className="space-y-3">
          {analysis.users.map((u) => (
            <div key={u.displayName} className="rounded-lg border border-border/30 bg-secondary/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: getAvatarHexColor(u.displayName) }}
                >
                  {getInitials(u.displayName)}
                </div>
                <span className="text-sm font-semibold">{u.displayName}</span>
                {u.captainName ? (
                  <span className="text-[10px] text-amber-400">C: {u.captainName}</span>
                ) : (
                  <span className="text-[10px] text-red-400">⚠️ No Captain</span>
                )}
              </div>
              {u.missing.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-red-400 font-medium">Missing: </span>
                  {u.missing.map((m) => `${m.name} (${m.ownership}%)`).join(", ")}
                </div>
              )}
              {u.unique.length > 0 && (
                <div className="text-[11px]">
                  <span className="text-purple-400 font-medium">Unique: </span>
                  {u.unique.join(", ")} 🔥
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LeagueMatchClient({
  leagueId,
  leagueName,
  match,
  currentUserId,
  memberSelections,
  players,
  playerPoints = {},
  memberScores = [],
}: Props) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<PreMatchAnalysis | null>(null)
  const [analysisWhatsapp, setAnalysisWhatsapp] = useState<string>("")
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadAnalysis = useCallback(async () => {
    if (analysis) return // already loaded
    setAnalysisLoading(true)
    try {
      const res = await getPreMatchAnalysis(match.id, leagueId)
      if (res.analysis) setAnalysis(res.analysis)
      if (res.whatsapp) setAnalysisWhatsapp(res.whatsapp)
    } finally {
      setAnalysisLoading(false)
    }
  }, [analysis, match.id, leagueId])

  const copyWhatsapp = useCallback(async () => {
    if (!analysisWhatsapp) return
    await navigator.clipboard.writeText(analysisWhatsapp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [analysisWhatsapp])

  const opponents = useMemo(
    () => memberSelections.filter((m) => m.user_id !== currentUserId),
    [memberSelections, currentUserId]
  )
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>(
    opponents[0]?.user_id ?? ""
  )

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const selectionMap = useMemo(() => new Map(memberSelections.map((s) => [s.user_id, s])), [memberSelections])

  const mySelection = useMemo(
    () => memberSelections.find((m) => m.user_id === currentUserId),
    [memberSelections, currentUserId]
  )
  const opponentSelection = useMemo(
    () => memberSelections.find((m) => m.user_id === selectedOpponentId),
    [memberSelections, selectedOpponentId]
  )
  const selectedOpponent = useMemo(
    () => opponents.find((m) => m.user_id === selectedOpponentId),
    [opponents, selectedOpponentId]
  )

  const myIds = useMemo(() => new Set(mySelection?.player_ids ?? []), [mySelection])
  const theirIds = useMemo(() => new Set(opponentSelection?.player_ids ?? []), [opponentSelection])

  const myEdge = useMemo(
    () =>
      [...myIds]
        .filter((id) => !theirIds.has(id))
        .map((id) => playerMap.get(id))
        .filter((p): p is PlayerWithTeam => !!p)
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)),
    [myIds, theirIds, playerMap]
  )

  const theirEdge = useMemo(
    () =>
      [...theirIds]
        .filter((id) => !myIds.has(id))
        .map((id) => playerMap.get(id))
        .filter((p): p is PlayerWithTeam => !!p)
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)),
    [theirIds, myIds, playerMap]
  )

  const shared = useMemo(
    () =>
      [...myIds]
        .filter((id) => theirIds.has(id))
        .map((id) => playerMap.get(id))
        .filter((p): p is PlayerWithTeam => !!p)
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)),
    [myIds, theirIds, playerMap]
  )

  // Rank league members by total_points for league-specific ranking
  const rankedScores = useMemo(
    () => [...memberScores].sort((a, b) => b.total_points - a.total_points),
    [memberScores]
  )

  const hasScores = rankedScores.length > 0
  const defaultTab = hasScores ? "scores" : "compare"

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" asChild>
          <Link href={`/leagues/${leagueId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-base font-bold truncate">{leagueName}</h1>
          <p className="text-xs text-muted-foreground">
            <span style={{ color: match.team_home.color }}>{match.team_home.short_name}</span>
            {" vs "}
            <span style={{ color: match.team_away.color }}>{match.team_away.short_name}</span>
            {" · "}Match #{match.match_number}
            {match.status === "live" && (
              <span className="ml-2 inline-flex items-center gap-1 text-status-live">
                <span className="w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
                Live
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Team sheet link */}
      <Link
        href={`/leagues/${leagueId}/match/${match.id}/sheet`}
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-border/30 bg-secondary/20 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
      >
        📋 View Team Sheet — All XIs + Differentials
      </Link>

      {match.status === "live" && <LiveRefresher interval={30000} />}

      {/* Tabs: Scores + Compare */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="scores" className="gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-1.5 text-xs">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5 text-xs" onClick={loadAnalysis}>
            <BarChart3 className="h-3.5 w-3.5" />
            Analysis
          </TabsTrigger>
        </TabsList>

        {/* ── Scores Tab ──────────────────────────────── */}
        <TabsContent value="scores" className="mt-4">
          {!hasScores ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {match.status === "live"
                  ? "Fantasy points will appear here within 5 minutes of the match starting."
                  : "No scores available for this match."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {match.status === "live" && (
                <p className="text-[10px] text-muted-foreground/60 mb-2 text-center">
                  Updates every ~5 min · Provisional until match ends
                </p>
              )}

              {rankedScores.map((member, idx) => {
                const isMe = member.user_id === currentUserId
                const isExpanded = expandedUserId === member.user_id
                const sel = selectionMap.get(member.user_id)
                const leagueRank = idx + 1

                return (
                  <div key={member.user_id}>
                    <button
                      onClick={() => setExpandedUserId((prev) => prev === member.user_id ? null : member.user_id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors",
                        "hover:bg-secondary/50 active:bg-secondary/70",
                        isMe && "bg-primary/10 border border-primary/20",
                        isExpanded && !isMe && "bg-secondary/30"
                      )}
                    >
                      {/* League rank */}
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        leagueRank === 1 && "bg-amber-400/20 text-amber-400",
                        leagueRank === 2 && "bg-gray-400/20 text-gray-400",
                        leagueRank === 3 && "bg-amber-600/20 text-amber-600",
                        leagueRank > 3 && "bg-secondary text-muted-foreground"
                      )}>
                        {leagueRank}
                      </span>

                      {/* Avatar */}
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAvatarColor(member.display_name))}>
                        <span className="text-white text-[10px] font-semibold">{getInitials(member.display_name)}</span>
                      </div>

                      {/* Name */}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.display_name}
                          {isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
                        </p>
                        {sel && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            C: {(() => {
                              const cp = sel.captain_id ? playerMap.get(sel.captain_id) : null
                              return cp?.name ?? "—"
                            })()}
                          </p>
                        )}
                      </div>

                      {/* Points */}
                      <span className="text-lg font-bold font-display tabular-nums shrink-0">
                        {member.total_points}
                      </span>

                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
                        isExpanded && "rotate-180"
                      )} />
                    </button>

                    {/* Expanded: player breakdown */}
                    {isExpanded && sel && (
                      <div className="ml-8 mr-2 mb-2 border-t border-border/40 pt-2 space-y-0.5">
                        {sel.player_ids
                          .map((pid) => {
                            const p = playerMap.get(pid)
                            if (!p) return null
                            const pts = playerPoints[pid] ?? 0
                            const isC = sel.captain_id === pid
                            const isVC = sel.vice_captain_id === pid
                            const mult = isC ? 2 : isVC ? 1.5 : 1
                            const eff = Math.round(pts * mult * 100) / 100
                            return { player: p, pts, isC, isVC, eff }
                          })
                          .filter(Boolean)
                          .sort((a, b) => b!.eff - a!.eff)
                          .map((item) => (
                            <SharedPlayerRow
                              key={item!.player.id}
                              player={{ id: item!.player.id, name: item!.player.name, role: item!.player.role }}
                              isCaptain={item!.isC}
                              isViceCaptain={item!.isVC}
                              effectivePoints={item!.eff}
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
        </TabsContent>

        {/* ── Compare Tab ─────────────────────────────── */}
        <TabsContent value="compare" className="mt-4">
          {!mySelection ? (
            <div className="flex flex-col items-center text-center py-12 gap-3">
              <p className="text-muted-foreground text-sm">You didn&apos;t submit a team for this match.</p>
            </div>
          ) : opponents.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12 gap-3">
              <p className="text-muted-foreground text-sm">No other league members to compare with.</p>
            </div>
          ) : (
            <>
              {/* Opponent selector */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Compare with</p>
                <div className="flex gap-2 flex-wrap">
                  {opponents.map((opp) => (
                    <Button
                      key={opp.user_id}
                      variant="outline"
                      onClick={() => setSelectedOpponentId(opp.user_id)}
                      className={cn(
                        "h-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                        selectedOpponentId === opp.user_id
                          ? "border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-transparent"
                      )}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: getAvatarHexColor(opp.display_name) }}
                      >
                        {getInitials(opp.display_name)}
                      </span>
                      {opp.display_name}
                    </Button>
                  ))}
                </div>
              </div>

              {!opponentSelection ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {selectedOpponent?.display_name ?? "They"} didn&apos;t submit a team for this match.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Your Edge */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                        Your Edge
                        <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{myEdge.length}</Badge>
                      </p>
                    </div>
                    {myEdge.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-4">None — they have all your players too</p>
                    ) : (
                      <div className="space-y-1.5 border-l-2 border-emerald-400/40 pl-3">
                        {myEdge.map((p) => (
                          <PlayerRow
                            key={p.id}
                            player={p}
                            myMultiplier={multiplierLabel(p.id === mySelection.captain_id, p.id === mySelection.vice_captain_id)}
                            points={playerPoints[p.id]}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Their Edge */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                        Their Edge
                        <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{theirEdge.length}</Badge>
                      </p>
                    </div>
                    {theirEdge.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-4">None — you have all their players</p>
                    ) : (
                      <div className="space-y-1.5 border-l-2 border-red-400/40 pl-3">
                        {theirEdge.map((p) => (
                          <PlayerRow
                            key={p.id}
                            player={p}
                            theirMultiplier={multiplierLabel(p.id === opponentSelection.captain_id, p.id === opponentSelection.vice_captain_id)}
                            points={playerPoints[p.id]}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shared */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Shared
                        <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{shared.length}</Badge>
                      </p>
                    </div>
                    {shared.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-4">No shared players</p>
                    ) : (
                      <div className="space-y-1.5 border-l-2 border-muted-foreground/30 pl-3">
                        {shared.map((p) => {
                          const myMul = multiplierLabel(p.id === mySelection.captain_id, p.id === mySelection.vice_captain_id)
                          const theirMul = multiplierLabel(p.id === opponentSelection.captain_id, p.id === opponentSelection.vice_captain_id)
                          const hasDiff = myMul !== theirMul
                          return (
                            <PlayerRow
                              key={p.id}
                              player={p}
                              showSharedNotes={hasDiff}
                              myMultiplier={hasDiff ? myMul : undefined}
                              theirMultiplier={hasDiff ? theirMul : undefined}
                              points={playerPoints[p.id]}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Analysis Tab ──────────────────────────────── */}
        <TabsContent value="analysis" className="mt-4">
          {analysisLoading ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground animate-pulse">Loading analysis...</p>
            </div>
          ) : !analysis ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Tap the Analysis tab to load pre-match intelligence.</p>
            </div>
          ) : (
            <AnalysisContent analysis={analysis} whatsapp={analysisWhatsapp} copied={copied} onCopy={copyWhatsapp} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

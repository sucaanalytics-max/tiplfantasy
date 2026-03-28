"use client"

import { useState } from "react"
import { RankBadge } from "@/components/rank-badge"
import { Podium } from "@/components/podium"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type PlayerScore = {
  player_id: string
  fantasy_points: string | number
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: string | number
  runs_conceded: number
  catches: number
  stumpings: number
  run_outs: number
  player: {
    name: string
    role: string
    team: { short_name: string; color: string }
  }
}

type UserScore = {
  user_id: string
  total_points: string | number
  rank: number | null
  captain_points: string | number
  vc_points: string | number
  profile: { display_name: string }
}

type UserSelection = {
  user_id: string
  captain_id: string | null
  vice_captain_id: string | null
  player_ids: string[]
}

type PodiumEntry = {
  name: string
  points: number
  rank: number
  isCurrentUser?: boolean
}

type Props = {
  userScores: UserScore[]
  playerScores: PlayerScore[]
  allSelections: UserSelection[]
  currentUserId: string
  captainPicks: Record<string, { name: string }>
  podiumEntries?: PodiumEntry[]
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-amber-400 bg-amber-400/15 border-amber-400/30",
  BAT: "text-blue-400 bg-blue-400/15 border-blue-400/30",
  AR: "text-emerald-400 bg-emerald-400/15 border-emerald-400/30",
  BOWL: "text-purple-400 bg-purple-400/15 border-purple-400/30",
}

function formatBattingStats(p: PlayerScore): string {
  const parts: string[] = []
  if (p.runs > 0 || p.balls_faced > 0) {
    parts.push(`${p.runs}(${p.balls_faced})`)
  }
  if (p.fours > 0) parts.push(`${p.fours}×4`)
  if (p.sixes > 0) parts.push(`${p.sixes}×6`)
  return parts.join(" ")
}

function formatBowlingStats(p: PlayerScore): string {
  const parts: string[] = []
  if (Number(p.overs_bowled) > 0) {
    parts.push(`${p.wickets}/${p.runs > 0 ? "" : "0"} (${p.overs_bowled} ov)`)
  }
  return parts.join(" ")
}

function formatPlayerStats(p: PlayerScore): string {
  const role = p.player.role
  const batting = formatBattingStats(p)
  const bowling = formatBowlingStats(p)

  if (role === "BOWL" && bowling) return bowling
  if (role === "BAT" || role === "WK") return batting
  // AR: show both if available
  const combined = [batting, bowling].filter(Boolean).join("  ")
  return combined
}

function formatBowlerLine(p: PlayerScore): string {
  if (Number(p.overs_bowled) <= 0) return ""
  // Calculate runs conceded — we don't have it directly, so show wickets/overs
  return `${p.wickets}w (${p.overs_bowled} ov)`
}

function getPlayerDisplayStats(p: PlayerScore): string {
  const role = p.player.role
  const parts: string[] = []

  // Batting line
  if (p.runs > 0 || p.balls_faced > 0) {
    let bat = `${p.runs}(${p.balls_faced})`
    const extras: string[] = []
    if (p.fours > 0) extras.push(`${p.fours}×4`)
    if (p.sixes > 0) extras.push(`${p.sixes}×6`)
    if (extras.length) bat += " " + extras.join(" ")
    parts.push(bat)
  }

  // Bowling line
  if (Number(p.overs_bowled) > 0) {
    parts.push(`${p.wickets}/${p.runs_conceded} (${p.overs_bowled} ov)`)
  }

  // Fielding
  const fielding: string[] = []
  if (p.catches > 0) fielding.push(`${p.catches}c`)
  if (p.stumpings > 0) fielding.push(`${p.stumpings}st`)
  if (p.run_outs > 0) fielding.push(`${p.run_outs}ro`)
  if (fielding.length) parts.push(fielding.join(" "))

  return parts.join("  ") || "-"
}

/** We don't have runs conceded, so just show wicket count for bowlers */
function formatBowlerEconomy(p: PlayerScore): string {
  // Placeholder — we only have wickets + overs
  return `${p.wickets}w`
}

export function MatchLeaderboard({
  userScores,
  playerScores,
  allSelections,
  currentUserId,
  captainPicks,
  podiumEntries,
}: Props) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Build a lookup: player_id -> PlayerScore
  const playerScoreMap = new Map<string, PlayerScore>()
  for (const ps of playerScores) {
    playerScoreMap.set(ps.player_id, ps)
  }

  // Build a lookup: user_id -> UserSelection
  const selectionMap = new Map<string, UserSelection>()
  for (const sel of allSelections) {
    selectionMap.set(sel.user_id, sel)
  }

  const sortedScores = [...userScores].sort((a, b) => {
    if (a.rank === null && b.rank === null) return 0
    if (a.rank === null) return 1
    if (b.rank === null) return -1
    return a.rank - b.rank
  })

  const hasPodium = podiumEntries && podiumEntries.length >= 3
  // Show ALL users as expandable rows (including top 3) so their teams are viewable
  const rowScores = sortedScores

  function toggleExpand(userId: string) {
    setExpandedUserId((prev) => (prev === userId ? null : userId))
  }

  function getUserPlayers(userId: string): (PlayerScore & { isCaptain: boolean; isVc: boolean })[] {
    const sel = selectionMap.get(userId)
    if (!sel) return []

    return sel.player_ids
      .map((pid) => {
        const ps = playerScoreMap.get(pid)
        if (!ps) return null
        return {
          ...ps,
          isCaptain: sel.captain_id === pid,
          isVc: sel.vice_captain_id === pid,
        }
      })
      .filter(Boolean)
      .sort((a, b) => Number(b!.fantasy_points) - Number(a!.fantasy_points)) as (PlayerScore & {
      isCaptain: boolean
      isVc: boolean
    })[]
  }

  return (
    <div>
      {hasPodium && <Podium entries={podiumEntries!} />}

      <div className="flex flex-col gap-1 mt-2">
        {rowScores.map((user) => {
          const isExpanded = expandedUserId === user.user_id
          const isCurrentUser = user.user_id === currentUserId
          const displayName = user.profile.display_name
          const players = isExpanded ? getUserPlayers(user.user_id) : []

          return (
            <div key={user.user_id}>
              {/* User row */}
              <button
                onClick={() => toggleExpand(user.user_id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  "hover:bg-secondary/50 active:bg-secondary/70",
                  isCurrentUser && "bg-primary/10 border border-primary/20",
                  isExpanded && !isCurrentUser && "bg-secondary/30"
                )}
              >
                {/* Rank */}
                <RankBadge rank={user.rank ?? 0} size="sm" />

                {/* Avatar */}
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    getAvatarColor(displayName)
                  )}
                >
                  <span className="text-white text-xs font-semibold">
                    {getInitials(displayName)}
                  </span>
                </div>

                {/* Name + captain pick */}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">
                    {displayName}
                    {isCurrentUser && (
                      <span className="text-primary text-xs ml-1">(you)</span>
                    )}
                  </p>
                  {captainPicks[user.user_id] && (
                    <p className="text-xs text-muted-foreground truncate">
                      C: {captainPicks[user.user_id].name}
                    </p>
                  )}
                </div>

                {/* Points */}
                <span className="text-sm font-bold font-display tabular-nums shrink-0">
                  {Number(user.total_points)} pts
                </span>

                {/* Chevron */}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {/* Expanded player details */}
              {isExpanded && (
                <div className="ml-10 mr-4 mb-2 border-t border-border/50 pt-2 flex flex-col gap-1">
                  {players.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No selection data</p>
                  )}
                  {players.map((p) => {
                    const role = p.player.role
                    const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.BAT
                    const pts = Number(p.fantasy_points)

                    return (
                      <div
                        key={p.player_id}
                        className="flex items-center gap-2 py-1.5 text-xs"
                      >
                        {/* Role badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0 h-5 shrink-0 border",
                            roleColor
                          )}
                        >
                          {role}
                        </Badge>

                        {/* Player name */}
                        <span className="font-medium truncate min-w-0">
                          {p.player.name}
                        </span>

                        {/* Stats */}
                        <span className="text-muted-foreground truncate min-w-0">
                          {getPlayerDisplayStats(p)}
                        </span>

                        {/* C/VC badge */}
                        {p.isCaptain && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 h-5 shrink-0">
                            C
                          </Badge>
                        )}
                        {p.isVc && (
                          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] px-1.5 py-0 h-5 shrink-0">
                            VC
                          </Badge>
                        )}

                        {/* Points — pushed to the right */}
                        <span className="ml-auto font-bold font-display tabular-nums text-right shrink-0">
                          {pts} pts
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
  )
}

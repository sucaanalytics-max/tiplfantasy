"use client"

import { useState, useTransition, useMemo, useCallback, useRef, useDeferredValue } from "react"
import { useRouter } from "next/navigation"
import { CountdownTimer } from "@/components/countdown-timer"
import {
  Star,
  Check,
  ChevronLeft,
  AlertCircle,
  Search,
  X,
  Eye,
  ArrowUpDown,
  Sparkles,
  Info,
} from "lucide-react"
import { FormIcon } from "@/components/form-icon"
import { TeamLogo } from "@/components/team-logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn, formatIST } from "@/lib/utils"
import { validateSelection, ROLE_LIMITS, type ValidationResult } from "@/lib/validation"
import { submitSelection } from "@/actions/selections"
import { TOTAL_BUDGET } from "@/lib/constants"
import { SegmentedProgressBar } from "@/components/segmented-progress-bar"
import { CricketField } from "@/components/cricket-field"
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer"
import { PlayerStatsDrawer } from "@/components/player-stats-drawer"
import { Confetti } from "@/components/confetti"
import { TeamSubmitPreview } from "@/components/team-submit-preview"
import type { PlayerWithTeam, MatchWithTeams, PlayerRole, PlayerVenueStats, PlayerVsTeamStats, PlayerSeasonStats } from "@/lib/types"
import { CAPTAIN_BADGE, VICE_CAPTAIN_BADGE } from "@/lib/badges"

type Props = {
  match: MatchWithTeams
  players: PlayerWithTeam[]
  playingXIIds: string[]
  initialSelectedIds: string[]
  initialCaptainId: string | null
  initialViceCaptainId: string | null
  tiplScores: Record<string, number[]>
  venueStats: Record<string, PlayerVenueStats>
  vsTeamStats: Record<string, PlayerVsTeamStats>
  seasonStats: Record<string, PlayerSeasonStats[]>
  selectionPcts: Record<string, number>
}

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

const ROLE_ACCENT: Record<PlayerRole, string> = {
  WK:   "border-l-[3px] border-l-amber-400",
  BAT:  "border-l-[3px] border-l-blue-400",
  AR:   "border-l-[3px] border-l-emerald-400",
  BOWL: "border-l-[3px] border-l-purple-400",
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "Wicket-keeper",
  BAT: "Batsman",
  AR: "All-rounder",
  BOWL: "Bowler",
}

export function PickTeamClient({
  match,
  players,
  playingXIIds,
  initialSelectedIds,
  initialCaptainId,
  initialViceCaptainId,
  tiplScores,
  venueStats,
  vsTeamStats,
  seasonStats,
  selectionPcts,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds)
  )
  const [captainId, setCaptainId] = useState<string | null>(initialCaptainId)
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(
    initialViceCaptainId
  )
  const [activeFilter, setActiveFilter] = useState<PlayerRole | "ALL">("ALL")
  const [teamFilter, setTeamFilter] = useState<"ALL" | "HOME" | "AWAY">("ALL")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [error, setError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSubmitPreview, setShowSubmitPreview] = useState(false)
  const [sortBy, setSortBy] = useState<"default" | "credits">("default")
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null)

  const statsPlayer = statsPlayerId ? players.find((p) => p.id === statsPlayerId) ?? null : null

  const getMatchupChip = useCallback((player: PlayerWithTeam): string | null => {
    const opponentShort = player.team_id === match.team_home_id
      ? match.team_away.short_name
      : match.team_home.short_name
    const vs = vsTeamStats[player.id]
    if (!vs || vs.matches < 3) return null
    if (vs.balls_faced > 0) {
      const avg = vs.runs / Math.max(vs.matches, 1)
      if (avg >= 35) return `${avg.toFixed(0)} avg vs ${opponentShort}`
    }
    if (Number(vs.overs_bowled) > 0) {
      const econ = vs.runs_conceded / Number(vs.overs_bowled)
      if (econ <= 7) return `${econ.toFixed(1)} econ vs ${opponentShort}`
    }
    return null
  }, [match, vsTeamStats])

  const hasPlayingXI = playingXIIds.length > 0

  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.has(p.id)),
    [players, selectedIds]
  )

  const validation: ValidationResult = useMemo(
    () => validateSelection(selectedPlayers, captainId, viceCaptainId),
    [selectedPlayers, captainId, viceCaptainId]
  )

  const roleCount = useMemo(() => {
    const counts: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
    selectedPlayers.forEach((p) => counts[p.role]++)
    return counts
  }, [selectedPlayers])

  const teamCount = useMemo(() => {
    const counts = new Map<string, number>()
    selectedPlayers.forEach((p) => {
      counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1)
    })
    return counts
  }, [selectedPlayers])

  const totalCost = useMemo(
    () => selectedPlayers.reduce((sum, p) => sum + (p.credit_cost ?? 0), 0),
    [selectedPlayers]
  )
  const remainingBudget = TOTAL_BUDGET - totalCost

  const filteredPlayers = useMemo(() => {
    let list = players
    if (activeFilter !== "ALL") {
      list = list.filter((p) => p.role === activeFilter)
    }
    if (teamFilter === "HOME") {
      list = list.filter((p) => p.team_id === match.team_home_id)
    } else if (teamFilter === "AWAY") {
      list = list.filter((p) => p.team_id === match.team_away_id)
    }
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    // Show playing XI players first if announced
    if (hasPlayingXI) {
      const xi = list.filter((p) => playingXIIds.includes(p.id))
      const rest = list.filter((p) => !playingXIIds.includes(p.id))
      list = [...xi, ...rest]
    }
    // Sort by credits if selected
    if (sortBy === "credits") {
      list = [...list].sort((a, b) => b.credit_cost - a.credit_cost)
    }
    return list
  }, [players, activeFilter, teamFilter, deferredSearch, match, hasPlayingXI, playingXIIds, sortBy])

  const getDisabledReason = useCallback(
    (player: PlayerWithTeam): string | null => {
      if (selectedIds.has(player.id)) return null
      if (selectedIds.size >= 11) return "Team full (11/11)"
      const tc = teamCount.get(player.team_id) ?? 0
      if (tc >= 7) return `Max 7 from ${player.team.short_name}`
      if (player.credit_cost > remainingBudget) return `Need ${player.credit_cost} cr, only ${remainingBudget.toFixed(1)} left`
      return null
    },
    [selectedIds, teamCount, remainingBudget]
  )

  const handleSmartPick = useCallback(() => {
    // Auto-fill remaining slots respecting composition + budget + team limits
    const current = new Set(selectedIds)
    let budget = remainingBudget
    const rCounts = { ...roleCount }
    const tCounts = new Map(teamCount)

    // Sort available by credit_cost descending (pick best available)
    const available = players
      .filter((p) => !current.has(p.id) && (hasPlayingXI ? playingXIIds.includes(p.id) : true))
      .sort((a, b) => b.credit_cost - a.credit_cost)

    for (const role of ROLE_ORDER) {
      const [min] = ROLE_LIMITS[role]
      while (rCounts[role] < min && current.size < 11) {
        const pick = available.find(
          (p) => p.role === role && !current.has(p.id) && p.credit_cost <= budget && (tCounts.get(p.team_id) ?? 0) < 7
        )
        if (!pick) break
        current.add(pick.id)
        budget -= pick.credit_cost
        rCounts[role]++
        tCounts.set(pick.team_id, (tCounts.get(pick.team_id) ?? 0) + 1)
      }
    }

    // Fill remaining slots with best available within limits
    while (current.size < 11) {
      const pick = available.find((p) => {
        if (current.has(p.id)) return false
        if (p.credit_cost > budget) return false
        if ((tCounts.get(p.team_id) ?? 0) >= 7) return false
        const [, max] = ROLE_LIMITS[p.role]
        if (rCounts[p.role] >= max) return false
        return true
      })
      if (!pick) break
      current.add(pick.id)
      budget -= pick.credit_cost
      rCounts[pick.role]++
      tCounts.set(pick.team_id, (tCounts.get(pick.team_id) ?? 0) + 1)
    }

    setSelectedIds(current)
    setError(null)
  }, [selectedIds, remainingBudget, roleCount, teamCount, players, hasPlayingXI, playingXIIds])

  const togglePlayer = useCallback(
    (playerId: string) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(playerId)) {
          next.delete(playerId)
          // Clear captain/VC if removed
          if (captainId === playerId) setCaptainId(null)
          if (viceCaptainId === playerId) setViceCaptainId(null)
        } else {
          if (next.size >= 11) return prev
          const playerCost = players.find(p => p.id === playerId)?.credit_cost ?? 0
          if (totalCost + playerCost > TOTAL_BUDGET) return prev
          next.add(playerId)
        }
        return next
      })
      setError(null)
    },
    [captainId, viceCaptainId, totalCost, players]
  )

  const handleSubmit = () => {
    const allErrors = [...validation.errors]
    if (!captainId || !viceCaptainId) allErrors.push("Select both a captain and vice-captain")
    if (allErrors.length > 0) {
      setError(allErrors.join(" • "))
      return
    }

    startTransition(async () => {
      const result = await submitSelection(
        match.id,
        Array.from(selectedIds),
        captainId,
        viceCaptainId
      )
      if (result.error) {
        setError(result.error)
      } else {
        setShowConfetti(true)
        setShowSubmitPreview(true)
      }
    })
  }

  const handleClearAll = () => {
    setSelectedIds(new Set())
    setCaptainId(null)
    setViceCaptainId(null)
    setError(null)
  }

  const renderPlayerCompact = (player: PlayerWithTeam) => {
    const isSelected = selectedIds.has(player.id)
    const isCaptain = captainId === player.id
    const isVC = viceCaptainId === player.id
    const isInXI = playingXIIds.includes(player.id)
    const disabledReason = getDisabledReason(player)
    const isDisabled = !!disabledReason
    const formIndicator = player.form_indicator
    const matchupChip = getMatchupChip(player)

    return (
      <button
        key={player.id}
        onClick={() => {
          if (!isDisabled) togglePlayer(player.id)
        }}
        disabled={isDisabled}
        title={disabledReason ?? undefined}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-2.5 text-left transition-colors",
          ROLE_ACCENT[player.role],
          isSelected ? "bg-primary/5" : isDisabled ? "opacity-40" : "hover:bg-secondary/50",
          hasPlayingXI && !isInXI && "opacity-50"
        )}
      >
        {/* Player avatar — photo if available, else team-colored initial */}
        {player.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.image_url}
            alt={player.name}
            className="h-5 w-5 rounded-full object-cover shrink-0 ring-1 ring-border"
          />
        ) : (
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold text-white"
            style={{ backgroundColor: player.team.color }}
          >
            {player.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
        )}
        {/* Selection dot */}
        <div className={cn(
          "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
          isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}>
          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span
              className="text-xs font-medium truncate cursor-pointer underline-offset-2 hover:underline text-foreground inline-flex items-center gap-0.5"
              onClick={(e) => { e.stopPropagation(); setStatsPlayerId(player.id) }}
            >
              {player.name}
              <Info className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0 inline ml-0.5" />
            </span>
            <FormIcon indicator={formIndicator} />
            {isCaptain && <span className="text-[8px] font-bold text-amber-500">C</span>}
            {isVC && <span className="text-[8px] font-bold text-violet-400">VC</span>}
            {hasPlayingXI && isInXI && <span className="h-2 w-2 rounded-full bg-status-success shrink-0" />}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[8px] h-3 px-0.5 py-0">{player.role}</Badge>
            <span className="text-[9px] text-muted-foreground">{player.credit_cost}</span>
            {matchupChip && (
              <span className="text-[8px] text-emerald-500 truncate">{matchupChip}</span>
            )}
            {(() => {
              const scores = tiplScores[player.id] ?? []
              const avgPts = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
              const lastPts = scores.length > 0 ? scores[scores.length - 1] : null
              if (avgPts == null) return null
              return (
                <span className="text-[8px] text-muted-foreground/70 tabular-nums">
                  avg {avgPts}{lastPts != null ? ` · last ${lastPts}` : ""}
                </span>
              )
            })()}
          </div>
          {/* Selection % bar */}
          {selectionPcts[player.id] != null && selectionPcts[player.id] > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-[3px] rounded-full bg-border overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", isSelected ? "bg-primary" : "bg-muted-foreground/40")}
                  style={{ width: `${selectionPcts[player.id]}%` }}
                />
              </div>
              <span className={cn("text-[8px] tabular-nums shrink-0", isSelected ? "text-primary" : "text-muted-foreground/60")}>
                {selectionPcts[player.id]}%
              </span>
            </div>
          )}
          {isDisabled && (
            <span className="text-[10px] text-status-danger">{disabledReason}</span>
          )}
        </div>
      </button>
    )
  }

  // Role-segmented selected players list for desktop left panel
  const renderDesktopSelectedPlayers = () => (
    <div className="flex-1 overflow-y-auto space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Your Team ({selectedIds.size}/11)</h3>
        <span className="text-[10px] text-muted-foreground">
          C = 2x pts · VC = 1.5x pts
        </span>
      </div>
      {selectedPlayers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-8 text-center">
          Select players from the right panel
        </p>
      ) : (
        ROLE_ORDER.map((role) => {
          const rolePlayers = selectedPlayers.filter((p) => p.role === role)
          if (rolePlayers.length === 0) return null
          return (
            <div key={role} className="mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {ROLE_LABELS[role]}s · {rolePlayers.length}
              </p>
              <div className="space-y-1">
                {rolePlayers.map((player) => {
                  const isCaptain = captainId === player.id
                  const isVC = viceCaptainId === player.id
                  return (
                    <div key={player.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/50">
                      <div
                        className="w-1.5 h-6 rounded-full shrink-0"
                        style={{ backgroundColor: player.team.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium truncate cursor-pointer underline-offset-2 hover:underline"
                          onClick={(e) => { e.stopPropagation(); setStatsPlayerId(player.id) }}
                        >
                          {player.name}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px]" style={{ color: player.team.color }}>
                            {player.team.short_name}
                          </span>
                          <span className="text-[9px] text-muted-foreground">·</span>
                          <span className="text-[9px] text-muted-foreground">{player.credit_cost} cr</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => togglePlayer(player.id)}
                          title="Remove player"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          className={cn(
                            "h-7 w-7 rounded-full text-[9px] font-bold flex items-center justify-center border transition-all",
                            isCaptain
                              ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                              : "border-border text-muted-foreground hover:border-amber-400/50 hover:text-amber-400"
                          )}
                          onClick={() => {
                            if (viceCaptainId === player.id) setViceCaptainId(null)
                            setCaptainId(isCaptain ? null : player.id)
                          }}
                        >
                          C
                        </button>
                        <button
                          className={cn(
                            "h-7 w-7 rounded-full text-[9px] font-bold flex items-center justify-center border transition-all",
                            isVC
                              ? "bg-gradient-to-br from-violet-400 to-violet-600 text-white border-violet-400 shadow-sm shadow-violet-500/30"
                              : "border-border text-muted-foreground hover:border-violet-400/50 hover:text-violet-400"
                          )}
                          onClick={() => {
                            if (captainId === player.id) setCaptainId(null)
                            setViceCaptainId(isVC ? null : player.id)
                          }}
                        >
                          VC
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  // Post-submission preview
  if (showSubmitPreview) {
    return (
      <>
        {showConfetti && <Confetti />}
        <TeamSubmitPreview
          players={selectedPlayers}
          captainId={captainId}
          viceCaptainId={viceCaptainId}
          match={match}
          isUpdate={initialSelectedIds.length > 0}
          onDone={() => {
            router.refresh()
            router.push("/matches")
          }}
        />
      </>
    )
  }

  // Main player selection view
  return (
    <div className="min-h-dvh pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-28 lg:pb-0">
      {showConfetti && <Confetti />}
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted-foreground mb-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">Match {match.match_number}</h1>
                <div className="flex items-center gap-1.5">
                  <TeamLogo team={match.team_home} size="sm" />
                  <span className="text-xs text-muted-foreground">vs</span>
                  <TeamLogo team={match.team_away} size="sm" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatIST(match.start_time, "EEE d MMM, h:mm a")} •{" "}
                {match.venue}
              </p>
              <CountdownTimer targetTime={match.start_time} variant="compact" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <SegmentedProgressBar filled={selectedIds.size} total={11} />
              <span className={cn(
                "text-[10px] tabular-nums font-medium",
                remainingBudget < 0 ? "text-destructive" : remainingBudget < 15 ? "text-amber-500" : "text-muted-foreground"
              )}>
                {remainingBudget.toFixed(1)} credits left
              </span>
            </div>
          </div>
        </div>

        {/* Composition tracker */}
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {/* All tab */}
          <button
            onClick={() => setActiveFilter("ALL")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors whitespace-nowrap",
              activeFilter === "ALL"
                ? "border-primary bg-primary text-primary-foreground font-semibold"
                : "border-border text-muted-foreground"
            )}
          >
            <span className="font-medium">All</span>
            <span className="tabular-nums">{selectedIds.size}/{11}</span>
          </button>
          {ROLE_ORDER.map((role) => {
            const [min, max] = ROLE_LIMITS[role]
            const count = roleCount[role]
            const ok = count >= min && count <= max
            const isActive = activeFilter === role
            const roleColors: Record<PlayerRole, string> = {
              WK: "bg-role-wk", BAT: "bg-role-bat", AR: "bg-role-ar", BOWL: "bg-role-bowl",
            }
            return (
              <button
                key={role}
                onClick={() =>
                  setActiveFilter(isActive ? "ALL" : role)
                }
                className={cn(
                  "flex flex-col items-center px-2.5 py-1 rounded-md text-xs border transition-colors whitespace-nowrap gap-0.5",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-border text-muted-foreground",
                  !isActive && count > 0 && ok && "text-status-success border-status-success/30",
                  !isActive && count > 0 && !ok && "text-status-warning border-status-warning/30"
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="font-medium">{role}</span>
                  <span className="tabular-nums">
                    {count}/{max}
                  </span>
                  {count >= min && <Check className="h-2.5 w-2.5" />}
                </div>
                {/* Progress bar */}
                <div className="w-full h-[2px] rounded-full bg-border/50 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", isActive ? "bg-primary-foreground/70" : roleColors[role])}
                    style={{ width: `${Math.min((count / max) * 100, 100)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* Team filter + search + sort */}
        <div className="px-4 pb-2 flex gap-2">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(
              [
                ["ALL", "All"],
                ["HOME", match.team_home.short_name],
                ["AWAY", match.team_away.short_name],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTeamFilter(key)}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  teamFilter === key
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
              aria-label="Search players"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSortBy(sortBy === "default" ? "credits" : "default")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors shrink-0",
              sortBy === "credits" ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
            )}
            title={sortBy === "credits" ? "Sort: by credits" : "Sort: default"}
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortBy === "credits" ? "Cr" : ""}
          </button>
        </div>

        {hasPlayingXI && (
          <div className="px-4 pb-2">
            <p className="text-[10px] text-status-success flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-status-success shrink-0" /> Playing XI announced — confirmed players shown first
            </p>
          </div>
        )}
      </div>

      {/* Desktop split-panel layout */}
      <div className="lg:grid lg:grid-cols-12 lg:h-[calc(100dvh-180px)]">
        {/* Left panel — desktop only: field + C/VC + actions */}
        <div className="hidden lg:flex lg:flex-col lg:col-span-5 lg:border-r lg:border-border lg:overflow-y-auto lg:p-6 lg:gap-6">
          {renderDesktopSelectedPlayers()}

          {/* Budget & composition summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Players: {selectedIds.size}/11</span>
            <span className={cn(
              "tabular-nums font-medium",
              remainingBudget < 0 ? "text-destructive" : remainingBudget < 15 ? "text-amber-500" : ""
            )}>
              {remainingBudget.toFixed(1)} credits left
            </span>
          </div>

          {/* Desktop action buttons */}
          <div className="space-y-2">
            {selectedIds.size < 11 && (
              <button
                onClick={handleSmartPick}
                className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-primary/30 text-primary transition-colors hover:bg-primary/5 w-full"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Smart Pick
              </button>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-muted-foreground hover:text-foreground w-full text-center py-1"
              >
                Clear all
              </button>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!validation.valid || !captainId || !viceCaptainId || isPending}
            className={cn(
              "w-full",
              validation.valid && captainId && viceCaptainId && !isPending
                ? "bg-gradient-to-r from-primary to-emerald-400 text-black font-semibold"
                : ""
            )}
          >
            {isPending
              ? "Saving..."
              : initialSelectedIds.length > 0
                ? "Update Selection"
                : "Submit Selection"}
          </Button>
        </div>

        {/* Right panel — player browser (full-width on mobile) */}
        <div className="lg:col-span-7 lg:overflow-y-auto">

      {/* Player list — segmented by role */}
      {(() => {
        const rolesToShow = activeFilter === "ALL" ? ROLE_ORDER : [activeFilter]
        const showHeaders = activeFilter === "ALL"

        return (
          <div>
            {rolesToShow.map((role) => {
              const rolePlayers = filteredPlayers.filter((p) => p.role === role)
              if (rolePlayers.length === 0 && !showHeaders) return null

              const homePlayers = rolePlayers.filter((p) => p.team_id === match.team_home_id)
              const awayPlayers = rolePlayers.filter((p) => p.team_id === match.team_away_id)
              const maxLen = Math.max(homePlayers.length, awayPlayers.length)

              return (
                <div key={role}>
                  {/* Role header */}
                  {showHeaders && (
                    <div className="sticky top-0 z-10 px-4 py-1.5 bg-secondary/80 backdrop-blur-sm border-b border-border flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {ROLE_LABELS[role]}s
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {roleCount[role]}/{ROLE_LIMITS[role][1]}
                      </span>
                    </div>
                  )}

                  {teamFilter === "ALL" ? (
                    /* 2-column home/away grid */
                    <div className="grid grid-cols-2 gap-px bg-border">
                      <div className="bg-background">
                        {role === rolesToShow[0] && (
                          <div className="px-3 py-1 text-center border-b border-border">
                            <span className="text-[10px] font-semibold" style={{ color: match.team_home.color }}>
                              {match.team_home.short_name}
                            </span>
                          </div>
                        )}
                        <div className="divide-y divide-border">
                          {homePlayers.map((player) => renderPlayerCompact(player))}
                          {homePlayers.length === 0 && (
                            <div className="py-4 text-center text-[10px] text-muted-foreground">—</div>
                          )}
                        </div>
                      </div>
                      <div className="bg-background">
                        {role === rolesToShow[0] && (
                          <div className="px-3 py-1 text-center border-b border-border">
                            <span className="text-[10px] font-semibold" style={{ color: match.team_away.color }}>
                              {match.team_away.short_name}
                            </span>
                          </div>
                        )}
                        <div className="divide-y divide-border">
                          {awayPlayers.map((player) => renderPlayerCompact(player))}
                          {awayPlayers.length === 0 && (
                            <div className="py-4 text-center text-[10px] text-muted-foreground">—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Single column for HOME/AWAY filter */
                    <div className="divide-y divide-border">
                      {rolePlayers.map((player) => renderPlayerCompact(player))}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredPlayers.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No players found
              </div>
            )}
          </div>
        )
      })()}

        </div>{/* end right panel */}
      </div>{/* end split-panel grid */}

      {/* Bottom action bar — mobile only */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 md:bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {/* Captain/VC picker as Drawer */}
            <Drawer>
              <DrawerTrigger asChild>
                <button
                  disabled={selectedIds.size === 0}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
                    captainId && viceCaptainId
                      ? "border-status-success/40 bg-status-success/10 text-status-success"
                      : "border-status-warning/40 bg-status-warning/10 text-status-warning"
                  )}
                >
                  {captainId && viceCaptainId ? (
                    <>
                      <Check className="h-3 w-3" />
                      C & VC set
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Set C & VC
                    </>
                  )}
                </button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85vh]">
                <DrawerTitle className="text-center text-sm font-semibold py-2">
                  Captain & Vice-Captain
                </DrawerTitle>
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Captain gets 2x points, Vice-Captain gets 1.5x
                </p>
                <div className="px-4 pb-3 space-y-2 overflow-y-auto" data-vaul-no-drag>
                  {selectedPlayers
                    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                    .map((player) => {
                      const isCaptain = captainId === player.id
                      const isVC = viceCaptainId === player.id
                      return (
                        <Card key={player.id} className="p-3 border border-border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-[10px] w-10 justify-center shrink-0">
                                {player.role}
                              </Badge>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{player.name}</p>
                                <p className="text-[10px]" style={{ color: player.team.color }}>
                                  {player.team.short_name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant={isCaptain ? "default" : "outline"}
                                className={cn(
                                  "h-8 w-8 p-0 rounded-full",
                                  isCaptain && "bg-amber-400 text-black hover:bg-amber-400/90"
                                )}
                                onClick={() => {
                                  if (viceCaptainId === player.id) setViceCaptainId(null)
                                  setCaptainId(isCaptain ? null : player.id)
                                }}
                              >
                                <span className="text-xs font-bold">C</span>
                              </Button>
                              <Button
                                size="sm"
                                variant={isVC ? "default" : "outline"}
                                className={cn(
                                  "h-8 w-8 p-0 rounded-full",
                                  isVC && "bg-violet-400 text-black hover:bg-violet-400/90"
                                )}
                                onClick={() => {
                                  if (captainId === player.id) setCaptainId(null)
                                  setViceCaptainId(isVC ? null : player.id)
                                }}
                              >
                                <span className="text-xs font-bold">VC</span>
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                </div>
                {captainId && viceCaptainId && (
                  <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 border-t border-border flex gap-3 bg-background sticky bottom-0" data-vaul-no-drag>
                    <DrawerClose asChild>
                      <Button variant="outline" className="flex-1">
                        Done
                      </Button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Button
                        className="flex-1 bg-gradient-to-r from-primary to-emerald-400 text-black font-semibold"
                        onClick={handleSubmit}
                        disabled={!validation.valid || isPending}
                      >
                        {!validation.valid
                        ? "Fix team first"
                        : isPending
                          ? "Saving…"
                          : initialSelectedIds.length > 0
                            ? "Update"
                            : "Submit"}
                      </Button>
                    </DrawerClose>
                  </div>
                )}
              </DrawerContent>
            </Drawer>

            {/* Preview button */}
            <Drawer>
              <DrawerTrigger asChild>
                <button
                  disabled={selectedIds.size === 0}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
                    selectedIds.size > 0
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85vh]">
                <DrawerTitle className="text-center text-sm font-semibold py-2">Team Preview</DrawerTitle>
                <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto" data-vaul-no-drag>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>Players: {selectedIds.size}/11</span>
                    <span>Credits: {totalCost.toFixed(1)}/{TOTAL_BUDGET}</span>
                  </div>
                  <CricketField players={selectedPlayers} captainId={captainId} viceCaptainId={viceCaptainId} />
                </div>
              </DrawerContent>
            </Drawer>

            {/* Smart Pick */}
            {selectedIds.size < 11 && (
              <button
                onClick={handleSmartPick}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-primary/30 text-primary transition-colors hover:bg-primary/5"
              >
                <Sparkles className="h-3 w-3" />
                Smart Pick
              </button>
            )}

            <div className="flex-1" />

            {selectedIds.size > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>

          {selectedIds.size === 11 && !validation.valid && (
            <p className="text-xs text-destructive text-center mb-1.5">
              {validation.errors[0]}
            </p>
          )}
          {validation.valid && (!captainId || !viceCaptainId) && (
            <p className="text-xs text-amber-500 text-center mb-1.5">
              Set Captain &amp; Vice-Captain to submit
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!validation.valid || !captainId || !viceCaptainId || isPending}
            className={cn(
              "w-full",
              validation.valid && captainId && viceCaptainId && !isPending
                ? "bg-gradient-to-r from-primary to-emerald-400 text-black font-semibold"
                : ""
            )}
          >
            {isPending
              ? "Saving..."
              : initialSelectedIds.length > 0
                ? "Update Selection"
                : "Submit Selection"}
          </Button>
        </div>
      </div>

      {/* Player Stats Drawer */}
      <PlayerStatsDrawer
        player={statsPlayer}
        tiplScores={statsPlayerId ? tiplScores[statsPlayerId] ?? [] : []}
        venueStats={statsPlayerId ? venueStats[statsPlayerId] ?? null : null}
        vsTeamStats={statsPlayerId ? vsTeamStats[statsPlayerId] ?? null : null}
        seasonStats={statsPlayerId ? seasonStats[statsPlayerId] ?? [] : []}
        matchVenue={match.venue}
        opponentTeamName={
          statsPlayer
            ? statsPlayer.team_id === match.team_home_id
              ? match.team_away.short_name
              : match.team_home.short_name
            : ""
        }
        open={!!statsPlayerId}
        onClose={() => setStatsPlayerId(null)}
      />
    </div>
  )
}

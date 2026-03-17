"use client"

import { useState, useTransition, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CountdownTimer } from "@/components/countdown-timer"
import {
  Shield,
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { validateSelection, type ValidationResult } from "@/lib/validation"
import { submitSelection } from "@/actions/selections"
import { TOTAL_BUDGET } from "@/lib/constants"
import { SegmentedProgressBar } from "@/components/segmented-progress-bar"
import { CricketField } from "@/components/cricket-field"
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer"
import { PlayerStatsDrawer } from "@/components/player-stats-drawer"
import { Confetti } from "@/components/confetti"
import type { PlayerWithTeam, MatchWithTeams, PlayerRole } from "@/lib/types"
import { CAPTAIN_BADGE, VICE_CAPTAIN_BADGE } from "@/lib/badges"

type Props = {
  match: MatchWithTeams
  players: PlayerWithTeam[]
  playingXIIds: string[]
  initialSelectedIds: string[]
  initialCaptainId: string | null
  initialViceCaptainId: string | null
  tiplScores: Record<string, number[]>
}

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]
const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "Wicket-keeper",
  BAT: "Batsman",
  AR: "All-rounder",
  BOWL: "Bowler",
}
const ROLE_LIMITS: Record<PlayerRole, [number, number]> = {
  WK: [1, 4],
  BAT: [3, 5],
  AR: [1, 3],
  BOWL: [3, 5],
}

export function PickTeamClient({
  match,
  players,
  playingXIIds,
  initialSelectedIds,
  initialCaptainId,
  initialViceCaptainId,
  tiplScores,
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
  const [error, setError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [sortBy, setSortBy] = useState<"default" | "credits">("default")
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null)

  const statsPlayer = statsPlayerId ? players.find((p) => p.id === statsPlayerId) ?? null : null

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
    if (search.trim()) {
      const q = search.toLowerCase()
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
  }, [players, activeFilter, teamFilter, search, match, hasPlayingXI, playingXIIds, sortBy])

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
        setTimeout(() => {
          router.push("/matches")
          router.refresh()
        }, 1500)
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
          isSelected ? "bg-primary/5" : isDisabled ? "opacity-40" : "hover:bg-secondary/50",
          hasPlayingXI && !isInXI && "opacity-50"
        )}
      >
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
            {isCaptain && <span className="text-[8px] font-bold text-amber-500">C</span>}
            {isVC && <span className="text-[8px] font-bold text-violet-400">VC</span>}
            {hasPlayingXI && isInXI && <Shield className="h-2.5 w-2.5 text-status-success shrink-0" />}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[8px] h-3 px-0.5 py-0">{player.role}</Badge>
            <span className="text-[9px] text-muted-foreground">{player.credit_cost}</span>
          </div>
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
                        className="w-1 h-6 rounded-full shrink-0"
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
                          className={cn(
                            "h-6 w-6 rounded-full text-[9px] font-bold flex items-center justify-center border transition-colors",
                            isCaptain
                              ? "bg-amber-400 text-black border-amber-400"
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
                            "h-6 w-6 rounded-full text-[9px] font-bold flex items-center justify-center border transition-colors",
                            isVC
                              ? "bg-violet-400 text-black border-violet-400"
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

  // Main player selection view
  return (
    <div className="min-h-screen pb-40 md:pb-28 lg:pb-0">
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
              <h1 className="text-lg font-bold">
                Match {match.match_number}:{" "}
                <span style={{ color: match.team_home.color }}>
                  {match.team_home.short_name}
                </span>{" "}
                vs{" "}
                <span style={{ color: match.team_away.color }}>
                  {match.team_away.short_name}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {format(new Date(match.start_time), "EEE d MMM, h:mm a")} •{" "}
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
            return (
              <button
                key={role}
                onClick={() =>
                  setActiveFilter(isActive ? "ALL" : role)
                }
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-border text-muted-foreground",
                  !isActive && count > 0 && ok && "text-status-success border-status-success/30",
                  !isActive && count > 0 && !ok && "text-status-warning border-status-warning/30"
                )}
              >
                <span className="font-medium">{role}</span>
                <span className="tabular-nums">
                  {count}/{max}
                </span>
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
            <p className="text-[10px] text-status-success flex items-center gap-1">
              <Shield className="h-3 w-3" /> Playing XI announced — confirmed
              players shown first
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
                ? "bg-gradient-to-r from-primary to-blue-400 text-black font-semibold"
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

      {/* Player list */}
      {teamFilter === "ALL" ? (
        <div className="grid grid-cols-2 gap-px bg-border">
          {/* Home column */}
          <div className="bg-background">
            <div className="px-3 py-1.5 text-center border-b border-border">
              <span className="text-xs font-semibold" style={{ color: match.team_home.color }}>
                {match.team_home.short_name}
              </span>
            </div>
            <div className="divide-y divide-border">
              {filteredPlayers
                .filter(p => p.team_id === match.team_home_id)
                .map(player => renderPlayerCompact(player))}
              {filteredPlayers.filter(p => p.team_id === match.team_home_id).length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">No players found</div>
              )}
            </div>
          </div>
          {/* Away column */}
          <div className="bg-background">
            <div className="px-3 py-1.5 text-center border-b border-border">
              <span className="text-xs font-semibold" style={{ color: match.team_away.color }}>
                {match.team_away.short_name}
              </span>
            </div>
            <div className="divide-y divide-border">
              {filteredPlayers
                .filter(p => p.team_id === match.team_away_id)
                .map(player => renderPlayerCompact(player))}
              {filteredPlayers.filter(p => p.team_id === match.team_away_id).length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">No players found</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredPlayers.map((player) => {
            const isSelected = selectedIds.has(player.id)
            const isCaptain = captainId === player.id
            const isVC = viceCaptainId === player.id
            const isInXI = playingXIIds.includes(player.id)
            const isHome = player.team_id === match.team_home_id
            const teamColor = isHome
              ? match.team_home.color
              : match.team_away.color
            const disabledReason = getDisabledReason(player)
            const isDisabled = !!disabledReason

            return (
              <button
                key={player.id}
                onClick={() => {
                  if (!isDisabled) togglePlayer(player.id)
                }}
                disabled={isDisabled}
                title={disabledReason ?? undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "bg-primary/5"
                    : isDisabled
                      ? "opacity-40"
                      : "hover:bg-secondary/50",
                  hasPlayingXI && !isInXI && "opacity-50"
                )}
              >
                {/* Selection indicator */}
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>

                {/* Team color stripe */}
                <div
                  className="w-0.5 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: teamColor }}
                />

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-sm font-medium truncate cursor-pointer underline-offset-2 hover:underline text-foreground inline-flex items-center gap-0.5"
                      onClick={(e) => { e.stopPropagation(); setStatsPlayerId(player.id) }}
                    >
                      {player.name}
                      <Info className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0 inline ml-0.5" />
                    </span>
                    {isCaptain && (
                      <Badge className={`h-4 px-1 text-[9px] ${CAPTAIN_BADGE}`}>C</Badge>
                    )}
                    {isVC && (
                      <Badge className={`h-4 px-1 text-[9px] ${VICE_CAPTAIN_BADGE}`}>VC</Badge>
                    )}
                    {hasPlayingXI && isInXI && (
                      <Shield className="h-3 w-3 text-status-success shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px]" style={{ color: teamColor }}>
                      {player.team.short_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-3.5 px-1 py-0"
                    >
                      {player.role}
                    </Badge>
                  </div>
                  {isDisabled && disabledReason && (
                    <p className="text-[10px] text-status-danger mt-0.5">{disabledReason}</p>
                  )}
                </div>

                {/* Credit cost */}
                <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0 w-8 text-right">
                  {player.credit_cost}
                </span>

                {/* Star for selected */}
                {isSelected && (
                  <Star className="h-4 w-4 text-primary shrink-0 fill-primary" />
                )}
              </button>
            )
          })}

          {filteredPlayers.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No players found
            </div>
          )}
        </div>
      )}

        </div>{/* end right panel */}
      </div>{/* end split-panel grid */}

      {/* Bottom action bar — mobile only */}
      <div className="fixed bottom-14 left-0 right-0 md:bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
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
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors",
                    captainId && viceCaptainId
                      ? "border-status-success/30 text-status-success"
                      : "border-status-warning/30 text-status-warning"
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
                <div className="px-4 pb-6 space-y-2 overflow-y-auto">
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
              </DrawerContent>
            </Drawer>

            {/* Preview button */}
            <Drawer>
              <DrawerTrigger asChild>
                <button
                  disabled={selectedIds.size === 0}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors",
                    selectedIds.size > 0 ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85vh]">
                <DrawerTitle className="text-center text-sm font-semibold py-2">Team Preview</DrawerTitle>
                <div className="px-4 pb-6 overflow-y-auto">
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

          <Button
            onClick={handleSubmit}
            disabled={!validation.valid || !captainId || !viceCaptainId || isPending}
            className={cn(
              "w-full",
              validation.valid && captainId && viceCaptainId && !isPending
                ? "bg-gradient-to-r from-primary to-blue-400 text-black font-semibold"
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
        open={!!statsPlayerId}
        onClose={() => setStatsPlayerId(null)}
      />
    </div>
  )
}

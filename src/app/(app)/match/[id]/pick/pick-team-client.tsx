"use client"

import { useState, useTransition, useMemo, useCallback, useRef, useDeferredValue, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CountdownTimer } from "@/components/countdown-timer"
import {
  Star,
  Crown,
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
import { MatchHeroBand } from "@/components/match-hero-band"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn, formatIST } from "@/lib/utils"
import { validateSelection, ROLE_LIMITS, type ValidationResult } from "@/lib/validation"
import { submitSelection, adminEditSelection } from "@/actions/selections"
import { TOTAL_BUDGET } from "@/lib/constants"
import { SegmentedProgressBar } from "@/components/segmented-progress-bar"
import { CricketField } from "@/components/cricket-field"
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer"
import { PlayerStatsDrawer } from "@/components/player-stats-drawer"
import { PlayerHeadshot } from "@/components/player-headshot"
import { PlayerCardPremium } from "@/components/player-card-premium"
import { PitchView } from "@/components/pitch-view"
import { PlayerResearchTable } from "@/components/player-research-table"
import { CaptainOverlay } from "@/components/captain-overlay"
import { List as ListIcon, Map as MapIcon, Table as TableIcon } from "lucide-react"
import { Confetti } from "@/components/confetti"
import { TeamSubmitPreview } from "@/components/team-submit-preview"
import { TeamTacticalPreview } from "@/components/team-tactical-preview"
import type { PlayerWithTeam, MatchWithTeams, PlayerRole, PlayerVenueStats, PlayerVsTeamStats, TiplMatchEntry, TiplSeasonAggregates } from "@/lib/types"
import { CAPTAIN_BADGE, VICE_CAPTAIN_BADGE } from "@/lib/badges"

type Props = {
  match: MatchWithTeams
  players: PlayerWithTeam[]
  playingXIIds: string[]
  initialSelectedIds: string[]
  initialCaptainId: string | null
  initialViceCaptainId: string | null
  tiplMatchLog: Record<string, TiplMatchEntry[]>
  tiplSeasonStats: Record<string, TiplSeasonAggregates>
  venueStats: Record<string, PlayerVenueStats>
  vsTeamStats: Record<string, PlayerVsTeamStats>
  selectionPcts: Record<string, number>
  adminUserId?: string
}

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

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
  tiplMatchLog,
  tiplSeasonStats,
  venueStats,
  vsTeamStats,
  selectionPcts,
  adminUserId,
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
  const [pickMode, setPickMode] = useState<"list" | "pitch" | "research">("list")
  const [activeFilter, setActiveFilter] = useState<PlayerRole | "ALL">("ALL")
  const [teamFilter, setTeamFilter] = useState<"ALL" | "HOME" | "AWAY">("ALL")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [error, setError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSubmitPreview, setShowSubmitPreview] = useState(false)
  const [sortBy, setSortBy] = useState<"default" | "credits" | "total" | "average">("total")
  const [cvDrawerOpen, setCvDrawerOpen] = useState(false)
  const prevSelectedCount = useRef(selectedIds.size)
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null)

  const statsPlayer = statsPlayerId ? players.find((p) => p.id === statsPlayerId) ?? null : null

  // Auto-open C/VC drawer when user picks their 11th player (and C/VC not set)
  useEffect(() => {
    if (selectedIds.size === 11 && prevSelectedCount.current < 11 && (!captainId || !viceCaptainId)) {
      setCvDrawerOpen(true)
    }
    prevSelectedCount.current = selectedIds.size
  }, [selectedIds.size, captainId, viceCaptainId])

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
    // Sort
    if (sortBy === "credits") {
      list = [...list].sort((a, b) => b.credit_cost - a.credit_cost)
    } else if (sortBy === "total") {
      list = [...list].sort((a, b) => {
        const aTot = (tiplMatchLog[a.id] ?? []).reduce((x, y) => x + y.fantasyPoints, 0)
        const bTot = (tiplMatchLog[b.id] ?? []).reduce((x, y) => x + y.fantasyPoints, 0)
        return bTot - aTot
      })
    } else if (sortBy === "average") {
      list = [...list].sort((a, b) => {
        const aEntries = tiplMatchLog[a.id] ?? []
        const bEntries = tiplMatchLog[b.id] ?? []
        const aAvg = aEntries.length > 0 ? aEntries.reduce((x, y) => x + y.fantasyPoints, 0) / aEntries.length : -1
        const bAvg = bEntries.length > 0 ? bEntries.reduce((x, y) => x + y.fantasyPoints, 0) / bEntries.length : -1
        return bAvg - aAvg
      })
    }
    return list
  }, [players, activeFilter, teamFilter, deferredSearch, match, hasPlayingXI, playingXIIds, sortBy, tiplMatchLog])

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
      const result = adminUserId
        ? await adminEditSelection(match.id, adminUserId, Array.from(selectedIds), captainId, viceCaptainId)
        : await submitSelection(match.id, Array.from(selectedIds), captainId, viceCaptainId)
      if (result.error) {
        setError(result.error)
      } else {
        if (adminUserId) {
          router.push(`/admin/match/${match.id}`)
        } else {
          setShowConfetti(true)
          setShowSubmitPreview(true)
        }
      }
    })
  }

  const handleClearAll = () => {
    setSelectedIds(new Set())
    setCaptainId(null)
    setViceCaptainId(null)
    setError(null)
  }

  /**
   * Single render path for both mobile (2-col card grid) and desktop (2-col
   * card grid). Replaces the previous renderPlayerCompact (9-col row) and
   * renderPlayerMobileCard (compact card) implementations.
   */
  const renderPlayer = (player: PlayerWithTeam) => {
    const entries = tiplMatchLog[player.id] ?? []
    const totalPts = entries.length > 0 ? entries.reduce((a, e) => a + e.fantasyPoints, 0) : null
    const avgPts = entries.length > 0 ? Math.round(totalPts! / entries.length) : null
    const lastPts = entries.length > 0 ? entries[entries.length - 1].fantasyPoints : null
    const disabledReason = getDisabledReason(player)

    return (
      <PlayerCardPremium
        key={player.id}
        player={player}
        isSelected={selectedIds.has(player.id)}
        isCaptain={captainId === player.id}
        isVC={viceCaptainId === player.id}
        isInXI={playingXIIds.includes(player.id)}
        hasPlayingXI={hasPlayingXI}
        isDisabled={!!disabledReason}
        disabledReason={disabledReason}
        totalPts={totalPts}
        avgPts={avgPts}
        lastPts={lastPts}
        selectionPct={selectionPcts[player.id] ?? 0}
        onToggle={() => togglePlayer(player.id)}
        onShowStats={() => setStatsPlayerId(player.id)}
      />
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
                              : "border-border text-muted-foreground hover:border-amber-400/50 hover:text-[var(--tw-amber-text)]"
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

      {/* ── Compact hero band — non-sticky, scrolls away ───────── */}
      <div className="relative">
        <MatchHeroBand
          match={{
            match_number: match.match_number,
            status: match.status,
            result_summary: match.result_summary ?? null,
            cricapi_match_id: (match as unknown as { cricapi_match_id?: string | null }).cricapi_match_id ?? null,
            start_time: match.start_time,
            venue: match.venue,
            team_home: match.team_home,
            team_away: match.team_away,
          }}
          compact
        />
        {/* Back button + countdown overlaid on hero */}
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 hidden"
          aria-hidden
        />
      </div>

      {/* ── Sticky picker context bar ─────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background border-b border-overlay-border">

        {/* Row 1: Picker pills (X/11 · team counts · countdown) */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => router.back()}
            className="shrink-0 h-8 w-8 rounded-full glass-panel flex items-center justify-center text-muted-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Players X/11 pill */}
          <div className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 shrink-0">
            <span className="text-2xs uppercase tracking-wider text-muted-foreground font-medium">Players</span>
            <span className="text-gold-stat text-base leading-none">{selectedIds.size}<span className="text-muted-foreground text-xs">/11</span></span>
          </div>

          {/* Home team count pill */}
          <div
            className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 shrink-0"
            style={{ borderColor: `${match.team_home.color}55` }}
          >
            <TeamLogo team={match.team_home} size="sm" />
            <span className="text-2xs font-bold" style={{ color: match.team_home.color }}>
              {(match.team_home as unknown as { short_name: string }).short_name}
            </span>
            <span className="font-display font-bold text-sm tabular-nums">
              {teamCount.get(match.team_home_id) ?? 0}
            </span>
          </div>

          {/* Away team count pill */}
          <div
            className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 shrink-0"
            style={{ borderColor: `${match.team_away.color}55` }}
          >
            <TeamLogo team={match.team_away} size="sm" />
            <span className="text-2xs font-bold" style={{ color: match.team_away.color }}>
              {(match.team_away as unknown as { short_name: string }).short_name}
            </span>
            <span className="font-display font-bold text-sm tabular-nums">
              {teamCount.get(match.team_away_id) ?? 0}
            </span>
          </div>

          {/* Countdown pill */}
          <div className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 shrink-0 ml-auto">
            <CountdownTimer targetTime={match.start_time} variant="compact" />
          </div>
        </div>

        {/* Segmented composition bar (Dream11 style) */}
        <div className="px-4 pb-2">
          <div className="flex gap-[2px] h-2 rounded-full overflow-hidden bg-border/30">
            {Array.from({ length: 11 }).map((_, i) => {
              const player = selectedPlayers[i]
              const roleColor = player ? ({
                WK: "bg-role-wk", BAT: "bg-role-bat", AR: "bg-role-ar", BOWL: "bg-role-bowl"
              })[player.role] : ""
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm transition-colors",
                    player ? roleColor : "bg-border/50"
                  )}
                />
              )
            })}
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1">Max 7 from a team</p>
        </div>

        {/* Mode toggle: List · Pitch · Research */}
        <div className="px-3 pb-2">
          <div role="tablist" aria-label="Pick view mode" className="flex gap-1 p-0.5 rounded-lg bg-secondary/50 border border-overlay-border w-fit mx-auto">
            {(
              [
                { key: "list", label: "List", Icon: ListIcon },
                { key: "pitch", label: "Pitch", Icon: MapIcon },
                { key: "research", label: "Research", Icon: TableIcon },
              ] as const
            ).map(({ key, label, Icon }) => {
              const active = pickMode === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPickMode(key)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Row 2: Role tabs (underline style) — only visible in List mode */}
        {pickMode === "list" && (
        <div className="flex border-b border-overlay-border">
          <button
            onClick={() => setActiveFilter("ALL")}
            className={cn(
              "flex-1 py-2 text-xs font-medium text-center transition-colors relative",
              activeFilter === "ALL" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            All ({selectedIds.size})
            {activeFilter === "ALL" && <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary rounded-full" />}
          </button>
          {ROLE_ORDER.map((role) => {
            const count = roleCount[role]
            const [min, max] = ROLE_LIMITS[role]
            const isActive = activeFilter === role
            return (
              <button
                key={role}
                onClick={() => setActiveFilter(isActive ? "ALL" : role)}
                className={cn(
                  "flex-1 py-2 text-xs font-medium text-center transition-colors relative",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {role} ({count})
                {isActive && <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary rounded-full" />}
              </button>
            )
          })}
        </div>
        )}

        {/* Row 3: Team filter + search + sort — only in List mode */}
        {pickMode === "list" && (
        <div className="px-4 py-2 flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-overlay-border text-xs">
            {(
              [
                ["ALL", "All"],
                ["HOME", (match.team_home as unknown as { short_name: string }).short_name],
                ["AWAY", (match.team_away as unknown as { short_name: string }).short_name],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTeamFilter(key)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  teamFilter === key
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs rounded-lg border-overlay-border bg-secondary/50"
              aria-label="Search players"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSortBy(
              sortBy === "default" ? "total"
                : sortBy === "total" ? "average"
                : sortBy === "average" ? "credits"
                : "default"
            )}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors shrink-0",
              sortBy !== "default" ? "border-primary/30 text-primary" : "border-overlay-border text-muted-foreground"
            )}
            aria-label={`Sort: ${sortBy}`}
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortBy === "total" ? "Pts" : sortBy === "average" ? "Avg" : sortBy === "credits" ? "Cr" : ""}
          </button>
        </div>
        )}

        {hasPlayingXI && (
          <div className="px-4 pb-2">
            <p className="text-2xs text-status-success flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success shrink-0" /> Playing XI announced
            </p>
          </div>
        )}
      </div>

      {/* Desktop split-panel layout */}
      <div className="lg:grid lg:grid-cols-12 lg:h-[calc(100dvh-180px)]">
        {/* Left panel — desktop only: field + C/VC + actions */}
        <div className="hidden lg:flex lg:flex-col lg:col-span-5 lg:border-r lg:border-overlay-border lg:overflow-y-auto lg:p-6 lg:gap-6 bg-surface">
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
                ? "bg-primary hover:bg-primary/90 text-white font-semibold glow-card"
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

      {/* Pitch mode — visualize current XI on the field */}
      {pickMode === "pitch" && (
        <div className="px-3 py-4 max-w-md mx-auto">
          <PitchView
            selectedPlayers={selectedPlayers}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
            totalSlots={11}
            onPlayerClick={(player) => setStatsPlayerId(player.id)}
            onRemove={(playerId) => togglePlayer(playerId)}
            onEmptyClick={() => setPickMode("list")}
          />
        </div>
      )}

      {/* Research mode — sortable, dense candidate table */}
      {pickMode === "research" && (
        <div className="px-3 py-3">
          <PlayerResearchTable
            players={filteredPlayers}
            tiplMatchLog={tiplMatchLog}
            selectionPcts={selectionPcts}
            playingXIIds={playingXIIds}
            selectedIds={selectedIds}
            onToggle={(playerId) => togglePlayer(playerId)}
            onShowStats={(playerId) => setStatsPlayerId(playerId)}
            getDisabledReason={getDisabledReason}
            hasPlayingXI={hasPlayingXI}
          />
        </div>
      )}

      {/* List mode — segmented by role with team-split 2-col card grid */}
      {pickMode === "list" && (() => {
        const rolesToShow = activeFilter === "ALL" ? ROLE_ORDER : [activeFilter]
        const showHeaders = activeFilter === "ALL"

        return (
          <div>
            {rolesToShow.map((role) => {
              const rolePlayers = filteredPlayers.filter((p) => p.role === role)
              if (rolePlayers.length === 0 && !showHeaders) return null

              const homePlayers = rolePlayers.filter((p) => p.team_id === match.team_home_id)
              const awayPlayers = rolePlayers.filter((p) => p.team_id === match.team_away_id)

              return (
                <div key={role}>
                  {/* Role header */}
                  {showHeaders && (
                    <div className="sticky top-0 z-10 px-4 py-2 bg-secondary/80 border-b border-overlay-border flex items-center justify-between">
                      <span className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {ROLE_LABELS[role]}s
                      </span>
                      <span className="text-2xs text-muted-foreground tabular-nums">
                        Select {ROLE_LIMITS[role][0]}-{ROLE_LIMITS[role][1]} &middot; {roleCount[role]} picked
                      </span>
                    </div>
                  )}

                  {teamFilter === "ALL" ? (
                    rolePlayers.length === 0 ? (
                      <div className="py-8 text-center text-2xs text-muted-foreground">No players</div>
                    ) : (
                      /* Unified 2-col card grid — same on mobile and desktop.
                         Left column = home team, right = away team. */
                      <div className="grid grid-cols-2 gap-2 px-2 py-2 md:gap-3 md:px-3">
                        <div className="space-y-2">
                          <div
                            className="px-2 py-1.5 flex items-center gap-1.5 border-l-[3px] rounded-r bg-overlay-muted"
                            style={{ borderColor: match.team_home.color }}
                          >
                            <TeamLogo team={match.team_home} size="sm" />
                            <span className="font-display font-bold text-2xs uppercase tracking-widest truncate">
                              {match.team_home.short_name}
                            </span>
                            <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
                              {homePlayers.length}
                            </span>
                          </div>
                          {homePlayers.length > 0 ? (
                            homePlayers.map((player) => renderPlayer(player))
                          ) : (
                            <div className="py-4 text-center text-2xs text-muted-foreground">No players</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div
                            className="px-2 py-1.5 flex items-center gap-1.5 border-l-[3px] rounded-r bg-overlay-muted"
                            style={{ borderColor: match.team_away.color }}
                          >
                            <TeamLogo team={match.team_away} size="sm" />
                            <span className="font-display font-bold text-2xs uppercase tracking-widest truncate">
                              {match.team_away.short_name}
                            </span>
                            <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
                              {awayPlayers.length}
                            </span>
                          </div>
                          {awayPlayers.length > 0 ? (
                            awayPlayers.map((player) => renderPlayer(player))
                          ) : (
                            <div className="py-4 text-center text-2xs text-muted-foreground">No players</div>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    /* Single column for HOME/AWAY filter */
                    <div className="px-2 py-2 space-y-2">
                      {rolePlayers.map((player) => renderPlayer(player))}
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
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 md:bottom-0 z-40 border-t border-overlay-border bg-background lg:hidden">
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {/* Captain/VC picker as Drawer (auto-opens when 11 selected) */}
            <Drawer open={cvDrawerOpen} onOpenChange={setCvDrawerOpen}>
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
                <DrawerTitle className="text-center font-display text-base font-bold uppercase tracking-wider py-2">
                  Captain & Vice-Captain
                </DrawerTitle>
                <p className="text-xs text-muted-foreground text-center mb-3 px-4">
                  <Crown className="inline h-3 w-3 -mt-0.5 text-[var(--captain-gold)]" /> Captain
                  <span className="font-display font-bold text-foreground"> ×2</span>
                  <span className="mx-2 text-muted-foreground/40">·</span>
                  <Star className="inline h-3 w-3 -mt-0.5 text-[var(--vice-silver)] fill-current" /> Vice-Captain
                  <span className="font-display font-bold text-foreground"> ×1.5</span>
                </p>
                <div className="px-3 pb-3 space-y-1.5 overflow-y-auto" data-vaul-no-drag>
                  {selectedPlayers
                    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                    .map((player) => {
                      const isCaptain = captainId === player.id
                      const isVC = viceCaptainId === player.id
                      return (
                        <div
                          key={player.id}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl border transition-all stripe-team-left",
                            isCaptain
                              ? "border-[var(--captain-gold)]/50 bg-[var(--captain-gold)]/5"
                              : isVC
                              ? "border-[var(--vice-silver)]/50 bg-[var(--vice-silver)]/5"
                              : "border-overlay-border bg-card"
                          )}
                          style={{ "--team-color": player.team.color } as React.CSSProperties}
                        >
                          {/* Headshot — bigger, with C/VC ring + corner overlay when selected */}
                          <span className={cn("relative inline-flex shrink-0 rounded-full", isCaptain && "ring-captain", isVC && "ring-vice")}>
                            <PlayerHeadshot player={player} size="lg" ring={isCaptain || isVC ? "none" : "team"} shadow />
                            {isCaptain && <CaptainOverlay variant="captain" size="md" position="tr" />}
                            {isVC && <CaptainOverlay variant="vice" size="md" position="tr" />}
                          </span>

                          {/* Name + meta */}
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-sm truncate leading-tight">{player.name}</p>
                            <p className="text-[11px] truncate mt-0.5">
                              <span className="font-semibold uppercase tracking-wider" style={{ color: player.team.color }}>
                                {player.team.short_name}
                              </span>
                              <span className="text-muted-foreground/40 mx-1">·</span>
                              <span className="text-muted-foreground uppercase tracking-wider">{player.role}</span>
                            </p>
                          </div>

                          {/* C / VC pills — bigger, animated, color-tied to overlay tokens */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (viceCaptainId === player.id) setViceCaptainId(null)
                                setCaptainId(isCaptain ? null : player.id)
                              }}
                              aria-label={isCaptain ? "Remove captain" : "Set as captain"}
                              aria-pressed={isCaptain}
                              className={cn(
                                "relative h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-xs transition-all border-2",
                                isCaptain
                                  ? "bg-[var(--captain-gold)] border-[var(--captain-gold)] text-[oklch(0.18_0.02_86)] shadow-[0_0_14px_var(--captain-gold-glow)] scale-105"
                                  : "border-overlay-border-hover text-muted-foreground hover:border-[var(--captain-gold)]/60 hover:text-[var(--captain-gold)]"
                              )}
                            >
                              <Crown className={cn("h-4 w-4", isCaptain && "fill-current")} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (captainId === player.id) setCaptainId(null)
                                setViceCaptainId(isVC ? null : player.id)
                              }}
                              aria-label={isVC ? "Remove vice-captain" : "Set as vice-captain"}
                              aria-pressed={isVC}
                              className={cn(
                                "relative h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-xs transition-all border-2",
                                isVC
                                  ? "bg-[var(--vice-silver)] border-[var(--vice-silver)] text-[oklch(0.15_0.01_60)] shadow-[0_0_14px_var(--vice-silver-glow)] scale-105"
                                  : "border-overlay-border-hover text-muted-foreground hover:border-[var(--vice-silver)]/60 hover:text-foreground"
                              )}
                            >
                              <Star className={cn("h-4 w-4", isVC && "fill-current")} />
                            </button>
                          </div>
                        </div>
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
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold glow-card"
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
              <DrawerContent className="max-h-[90vh]">
                <DrawerTitle className="text-center text-sm font-semibold py-2 border-b border-overlay-border">Team Preview</DrawerTitle>
                <div className="px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto" data-vaul-no-drag>
                  <TeamTacticalPreview
                    selectedPlayers={selectedPlayers}
                    captainId={captainId}
                    viceCaptainId={viceCaptainId}
                    match={match}
                    totalCost={totalCost}
                    totalBudget={TOTAL_BUDGET}
                    tiplMatchLog={tiplMatchLog}
                  />
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
                ? "bg-primary hover:bg-primary/90 text-white font-semibold glow-card"
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
        tiplMatchLog={statsPlayerId ? tiplMatchLog[statsPlayerId] ?? [] : []}
        tiplSeasonStats={statsPlayerId ? tiplSeasonStats[statsPlayerId] ?? null : null}
        venueStats={statsPlayerId ? venueStats[statsPlayerId] ?? null : null}
        vsTeamStats={statsPlayerId ? vsTeamStats[statsPlayerId] ?? null : null}
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

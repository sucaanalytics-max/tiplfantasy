"use client"

import { useState, useTransition, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Shield,
  Star,
  Check,
  ChevronLeft,
  AlertCircle,
  Search,
  X,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { validateSelection, type ValidationResult } from "@/lib/validation"
import { submitSelection } from "@/actions/selections"
import { TOTAL_BUDGET } from "@/lib/constants"
import { SegmentedProgressBar } from "@/components/segmented-progress-bar"
import { CricketField } from "@/components/cricket-field"
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer"
import type { PlayerWithTeam, MatchWithTeams, PlayerRole } from "@/lib/types"

type Props = {
  match: MatchWithTeams
  players: PlayerWithTeam[]
  playingXIIds: string[]
  initialSelectedIds: string[]
  initialCaptainId: string | null
  initialViceCaptainId: string | null
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
  const [showCaptainPicker, setShowCaptainPicker] = useState(false)

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
    return list
  }, [players, activeFilter, teamFilter, search, match, hasPlayingXI, playingXIIds])

  const togglePlayer = useCallback(
    (playerId: string) => {
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
    if (!validation.valid) {
      setError(validation.errors[0])
      return
    }
    if (!captainId || !viceCaptainId) {
      setError("Select both a captain and vice-captain")
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
        router.push("/matches")
        router.refresh()
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
    const currentTeamCt = teamCount.get(player.team_id) ?? 0
    const wouldExceedTeam = !isSelected && currentTeamCt >= 7
    const isFull = !isSelected && selectedIds.size >= 11
    const cantAfford = !isSelected && player.credit_cost > remainingBudget

    return (
      <button
        key={player.id}
        onClick={() => {
          if (!wouldExceedTeam && !isFull && !cantAfford) togglePlayer(player.id)
        }}
        disabled={wouldExceedTeam || isFull || cantAfford}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-2.5 text-left transition-colors",
          isSelected ? "bg-primary/5" : (wouldExceedTeam || isFull || cantAfford) ? "opacity-40" : "hover:bg-secondary/50",
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
            <span className="text-xs font-medium truncate">{player.name}</span>
            {isCaptain && <span className="text-[8px] font-bold text-amber-500">C</span>}
            {isVC && <span className="text-[8px] font-bold text-violet-400">VC</span>}
            {hasPlayingXI && isInXI && <Shield className="h-2.5 w-2.5 text-green-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[8px] h-3 px-0.5 py-0">{player.role}</Badge>
            <span className="text-[9px] text-muted-foreground">{player.credit_cost}</span>
          </div>
        </div>
      </button>
    )
  }

  // Captain picker view
  if (showCaptainPicker) {
    return (
      <div className="min-h-screen pb-24 md:pb-6">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
          <button
            onClick={() => setShowCaptainPicker(false)}
            className="flex items-center gap-1 text-sm text-muted-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" /> Back to players
          </button>
          <h2 className="text-lg font-bold">Choose Captain & Vice-Captain</h2>
          <p className="text-xs text-muted-foreground">
            Captain gets 2x points, Vice-Captain gets 1.5x
          </p>
        </div>

        <div className="p-4 space-y-2">
          {selectedPlayers
            .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
            .map((player) => {
              const isCaptain = captainId === player.id
              const isVC = viceCaptainId === player.id
              return (
                <Card key={player.id} className="p-3 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] w-10 justify-center shrink-0"
                      >
                        {player.role}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {player.name}
                        </p>
                        <p
                          className="text-[10px]"
                          style={{ color: player.team.color }}
                        >
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
                          if (viceCaptainId === player.id)
                            setViceCaptainId(null)
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

        {/* Bottom bar */}
        <div className="fixed bottom-14 left-0 right-0 md:bottom-0 z-40 border-t border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
            <div className="text-xs text-muted-foreground">
              {captainId && viceCaptainId ? (
                <span className="text-green-500">C & VC selected</span>
              ) : (
                <span>
                  {!captainId && "Pick captain"}{" "}
                  {!captainId && !viceCaptainId && "&"}{" "}
                  {!viceCaptainId && "Pick VC"}
                </span>
              )}
            </div>
            <Button
              onClick={() => setShowCaptainPicker(false)}
              disabled={!captainId || !viceCaptainId}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Main player selection view
  return (
    <div className="min-h-screen pb-40 md:pb-28">
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
                  !isActive && count > 0 && ok && "text-green-500 border-green-500/30",
                  !isActive && count > 0 && !ok && "text-amber-500 border-amber-500/30"
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

        {/* Team filter + search */}
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
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
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
        </div>

        {hasPlayingXI && (
          <div className="px-4 pb-2">
            <p className="text-[10px] text-green-500 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Playing XI announced — confirmed
              players shown first
            </p>
          </div>
        )}
      </div>

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

            // Check if adding this player would violate max team rule
            const currentTeamCount = teamCount.get(player.team_id) ?? 0
            const wouldExceedTeam =
              !isSelected && currentTeamCount >= 7
            const isFull = !isSelected && selectedIds.size >= 11
            const cantAfford = !isSelected && player.credit_cost > remainingBudget

            return (
              <button
                key={player.id}
                onClick={() => {
                  if (!wouldExceedTeam && !isFull && !cantAfford) togglePlayer(player.id)
                }}
                disabled={wouldExceedTeam || isFull || cantAfford}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "bg-primary/5"
                    : wouldExceedTeam || isFull || cantAfford
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
                    <span className="text-sm font-medium truncate">
                      {player.name}
                    </span>
                    {isCaptain && (
                      <Badge className="h-4 px-1 text-[9px] bg-amber-500/20 text-amber-500 border-amber-500/30">
                        C
                      </Badge>
                    )}
                    {isVC && (
                      <Badge className="h-4 px-1 text-[9px] bg-violet-500/20 text-violet-400 border-violet-500/30">
                        VC
                      </Badge>
                    )}
                    {hasPlayingXI && isInXI && (
                      <Shield className="h-3 w-3 text-green-500 shrink-0" />
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

      {/* Bottom action bar */}
      <div className="fixed bottom-14 left-0 right-0 md:bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {/* Captain/VC status */}
            <button
              onClick={() => {
                if (selectedIds.size > 0) setShowCaptainPicker(true)
              }}
              disabled={selectedIds.size === 0}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors",
                captainId && viceCaptainId
                  ? "border-green-500/30 text-green-500"
                  : "border-amber-500/30 text-amber-500"
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
    </div>
  )
}

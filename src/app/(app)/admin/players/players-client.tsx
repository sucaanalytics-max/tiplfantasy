"use client"

import { useState, useTransition, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updatePlayer, syncPlayerStats, previewCricapiIdBackfill, confirmCricapiIdBackfill } from "@/actions/players"
import type { CricapiIdProposal } from "@/actions/players"
import type { PlayerWithTeam, PlayerRole, Team } from "@/lib/types"
import { ROLE_COLORS } from "@/lib/badges"

const ROLES: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

type Props = {
  players: PlayerWithTeam[]
}

export function PlayersClient({ players: initialPlayers }: Props) {
  const [players, setPlayers] = useState(initialPlayers)
  const [search, setSearch] = useState("")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [editingCost, setEditingCost] = useState<string | null>(null)
  const [costValue, setCostValue] = useState("")
  const [editingHowstat, setEditingHowstat] = useState<string | null>(null)
  const [howstatValue, setHowstatValue] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillProposals, setBackfillProposals] = useState<CricapiIdProposal[] | null>(null)
  const [backfillConfirming, setBackfillConfirming] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const costInputRef = useRef<HTMLInputElement>(null)
  const howstatInputRef = useRef<HTMLInputElement>(null)

  // Derive unique teams from players
  const teams = Array.from(
    new Map(players.map((p) => [p.team.id, p.team])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  // Filter players
  const filtered = players.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (teamFilter !== "all" && p.team_id !== teamFilter) return false
    return true
  })

  // Group by team
  const grouped = new Map<string, { team: Team; players: PlayerWithTeam[] }>()
  for (const player of filtered) {
    const existing = grouped.get(player.team_id)
    if (existing) {
      existing.players.push(player)
    } else {
      grouped.set(player.team_id, { team: player.team, players: [player] })
    }
  }

  // Sort groups by team name
  const sortedGroups = Array.from(grouped.values()).sort((a, b) =>
    a.team.name.localeCompare(b.team.name)
  )

  function handleToggleActive(playerId: string, currentActive: boolean) {
    const newActive = !currentActive
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, is_active: newActive } : p))
    )
    startTransition(async () => {
      const result = await updatePlayer(playerId, { is_active: newActive })
      if (result.error) {
        // Revert on error
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, is_active: currentActive } : p))
        )
      }
    })
  }

  function handleRoleChange(playerId: string, newRole: PlayerRole) {
    const oldRole = players.find((p) => p.id === playerId)?.role
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, role: newRole } : p))
    )
    startTransition(async () => {
      const result = await updatePlayer(playerId, { role: newRole })
      if (result.error && oldRole) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, role: oldRole } : p))
        )
      }
    })
  }

  function handleCostClick(playerId: string, currentCost: number) {
    setEditingCost(playerId)
    setCostValue(String(currentCost))
    setTimeout(() => costInputRef.current?.select(), 0)
  }

  function handleCostSave(playerId: string) {
    const newCost = parseFloat(costValue)
    if (isNaN(newCost) || newCost < 0) {
      setEditingCost(null)
      return
    }

    const oldCost = players.find((p) => p.id === playerId)?.credit_cost
    setEditingCost(null)
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, credit_cost: newCost } : p))
    )
    startTransition(async () => {
      const result = await updatePlayer(playerId, { credit_cost: newCost })
      if (result.error && oldCost !== undefined) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, credit_cost: oldCost } : p))
        )
      }
    })
  }

  function handleCostKeyDown(e: React.KeyboardEvent, playerId: string) {
    if (e.key === "Enter") {
      handleCostSave(playerId)
    } else if (e.key === "Escape") {
      setEditingCost(null)
    }
  }

  function handleHowstatClick(playerId: string, currentId: number | null) {
    setEditingHowstat(playerId)
    setHowstatValue(currentId !== null ? String(currentId) : "")
    setTimeout(() => howstatInputRef.current?.select(), 0)
  }

  function handleHowstatSave(playerId: string) {
    const newId = howstatValue.trim() === "" ? null : parseInt(howstatValue, 10)
    if (howstatValue.trim() !== "" && (isNaN(newId!) || newId! < 0)) {
      setEditingHowstat(null)
      return
    }

    setEditingHowstat(null)
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, howstat_id: newId } : p))
    )
    startTransition(async () => {
      const result = await updatePlayer(playerId, { howstat_id: newId })
      if (result.error) {
        // Revert — just refetch would be better but keep simple
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, howstat_id: p.howstat_id } : p))
        )
      }
    })
  }

  function handleHowstatKeyDown(e: React.KeyboardEvent, playerId: string) {
    if (e.key === "Enter") handleHowstatSave(playerId)
    else if (e.key === "Escape") setEditingHowstat(null)
  }

  async function handleSyncStats() {
    setSyncing(true)
    setSyncResult(null)
    const result = await syncPlayerStats()
    setSyncing(false)
    if (result.error) {
      setSyncResult(`Error: ${result.error}`)
    } else {
      const data = result.data as { synced: number; results: { name: string; status: string }[] }
      const ok = data.results.filter((r) => r.status === "ok").length
      setSyncResult(`Synced ${ok}/${data.synced} players`)
    }
  }

  async function handleMapCricapiIds() {
    setBackfillLoading(true)
    setBackfillProposals(null)
    setBackfillResult(null)
    const result = await previewCricapiIdBackfill()
    setBackfillLoading(false)
    if (result.error) {
      setBackfillResult(`Error: ${result.error}`)
    } else {
      setBackfillProposals(result.proposals ?? [])
    }
  }

  async function handleConfirmBackfill() {
    if (!backfillProposals || backfillProposals.length === 0) return
    setBackfillConfirming(true)
    const result = await confirmCricapiIdBackfill(backfillProposals)
    setBackfillConfirming(false)
    setBackfillProposals(null)
    if (result.error) {
      setBackfillResult(`Error: ${result.error}`)
    } else {
      setBackfillResult(`Mapped ${result.updated} players`)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Players</h1>
          <p className="text-muted-foreground mt-1">
            {players.length} players across {teams.length} teams
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleMapCricapiIds}
            disabled={backfillLoading || backfillConfirming}
            variant="outline"
            size="sm"
          >
            {backfillLoading ? "Searching... (~30s)" : "Map CricAPI IDs"}
          </Button>
          <Button
            onClick={handleSyncStats}
            disabled={syncing}
            variant="outline"
            size="sm"
          >
            {syncing ? "Syncing..." : "Sync Stats"}
          </Button>
          {syncResult && (
            <span className="text-xs text-muted-foreground">{syncResult}</span>
          )}
          {backfillResult && (
            <span className="text-xs text-muted-foreground">{backfillResult}</span>
          )}
        </div>
      </div>

      {/* CricAPI ID backfill proposals */}
      {backfillProposals !== null && (
        <Card className="border border-border">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {backfillProposals.length === 0
                  ? "All players already have CricAPI IDs mapped."
                  : `Found ${backfillProposals.length} player mappings — review and confirm:`}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setBackfillProposals(null)}>
                Dismiss
              </Button>
            </div>
            {backfillProposals.length > 0 && (
              <>
                <div className="max-h-64 overflow-y-auto space-y-1 text-xs font-mono border border-border rounded-md p-2">
                  {backfillProposals.map((p) => (
                    <div key={p.playerId} className="flex gap-3 py-0.5">
                      <span className="text-muted-foreground w-40 truncate shrink-0">{p.playerName}</span>
                      <span className="text-green-400">→</span>
                      <span className="truncate">{p.apiName}</span>
                      <span className="text-muted-foreground shrink-0">[{p.country}]</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleConfirmBackfill}
                  disabled={backfillConfirming}
                  size="sm"
                >
                  {backfillConfirming ? "Saving..." : `Confirm ${backfillProposals.length} Mappings`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {(search || teamFilter !== "all") && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {players.length} players
        </p>
      )}

      {/* Player groups by team */}
      <div className="space-y-6">
        {sortedGroups.map(({ team, players: teamPlayers }) => (
          <div key={team.id} className="space-y-2">
            {/* Team header */}
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <h2 className="text-lg font-semibold">{team.name}</h2>
              <span className="text-sm text-muted-foreground">
                ({teamPlayers.length})
              </span>
            </div>

            {/* Player rows */}
            <div className="space-y-1.5">
              {teamPlayers.map((player) => (
                <Card key={player.id} className={!player.is_active ? "opacity-50" : ""}>
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    {/* Left: name + role */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-medium truncate">{player.name}</span>
                      <div className="relative">
                        <Badge
                          variant="outline"
                          className={`${ROLE_COLORS[player.role]} cursor-pointer`}
                        >
                          {player.role}
                        </Badge>
                        <select
                          value={player.role}
                          onChange={(e) =>
                            handleRoleChange(player.id, e.target.value as PlayerRole)
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Right: howstat + cost + active toggle */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Howstat ID - click to edit */}
                      {editingHowstat === player.id ? (
                        <Input
                          ref={howstatInputRef}
                          type="number"
                          min="0"
                          value={howstatValue}
                          onChange={(e) => setHowstatValue(e.target.value)}
                          onBlur={() => handleHowstatSave(player.id)}
                          onKeyDown={(e) => handleHowstatKeyDown(e, player.id)}
                          className="w-20 h-7 text-sm text-center"
                          placeholder="ID"
                        />
                      ) : (
                        <button
                          onClick={() => handleHowstatClick(player.id, player.howstat_id)}
                          className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
                          title={player.stats_updated_at ? `Stats updated: ${new Date(player.stats_updated_at).toLocaleDateString()}` : "Click to set howstat ID"}
                        >
                          {player.howstat_id !== null ? `#${player.howstat_id}` : "—"}
                        </button>
                      )}

                      {/* Credit cost - click to edit */}
                      {editingCost === player.id ? (
                        <Input
                          ref={costInputRef}
                          type="number"
                          step="0.5"
                          min="0"
                          value={costValue}
                          onChange={(e) => setCostValue(e.target.value)}
                          onBlur={() => handleCostSave(player.id)}
                          onKeyDown={(e) => handleCostKeyDown(e, player.id)}
                          className="w-20 h-7 text-sm text-center"
                        />
                      ) : (
                        <button
                          onClick={() => handleCostClick(player.id, player.credit_cost)}
                          className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-accent"
                          title="Click to edit credit cost"
                        >
                          {player.credit_cost}cr
                        </button>
                      )}

                      {/* Active toggle */}
                      <Button
                        variant={player.is_active ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs w-16"
                        onClick={() => handleToggleActive(player.id, player.is_active)}
                        disabled={isPending}
                      >
                        {player.is_active ? "Active" : "Off"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No players found matching your filters.
        </div>
      )}
    </div>
  )
}

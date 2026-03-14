"use client"

import { useState, useTransition, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updatePlayer } from "@/actions/players"
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
  const [isPending, startTransition] = useTransition()
  const costInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Players</h1>
        <p className="text-muted-foreground mt-1">
          {players.length} players across {teams.length} teams
        </p>
      </div>

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

                    {/* Right: cost + active toggle */}
                    <div className="flex items-center gap-3 shrink-0">
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

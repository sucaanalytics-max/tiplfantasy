"use client"

import { useState, useMemo, useTransition } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CountdownTimer } from "@/components/countdown-timer"
import { TeamLogo } from "@/components/team-logo"
import { submitPrediction } from "@/actions/predictions"
import { useRouter } from "next/navigation"
import { Award, Target, Zap, Search, Check, Lock, Users } from "lucide-react"
import type { PredictionCategory, AwardStanding } from "@/lib/types"

type Player = {
  id: string
  name: string
  role: string
  team_id: string
  team: { short_name: string; color: string } | null
}

type PredictionRecord = {
  category: PredictionCategory
  player_id: string
  player: {
    name: string
    role: string
    team: { short_name: string; color: string } | null
  } | null
}

type CommunityVote = { player_id: string; count: number }

const CATEGORIES: {
  key: PredictionCategory
  label: string
  icon: typeof Award
  color: string
  bgColor: string
  statLabel: string
  description: string
}[] = [
  {
    key: "purple_cap",
    label: "Purple Cap",
    icon: Award,
    color: "text-purple-400",
    bgColor: "from-purple-500/10",
    statLabel: "wkts",
    description: "Highest wicket-taker",
  },
  {
    key: "orange_cap",
    label: "Orange Cap",
    icon: Target,
    color: "text-orange-400",
    bgColor: "from-orange-500/10",
    statLabel: "runs",
    description: "Top run-scorer",
  },
  {
    key: "mvp",
    label: "MVP",
    icon: Zap,
    color: "text-yellow-400",
    bgColor: "from-yellow-500/10",
    statLabel: "pts",
    description: "Most fantasy points",
  },
]

export function PredictionsClient({
  players,
  myPredictions,
  deadline,
  standings,
  communityVotes,
}: {
  players: Player[]
  myPredictions: PredictionRecord[]
  deadline: string | null
  standings: Record<PredictionCategory, AwardStanding[]>
  communityVotes: Record<PredictionCategory, CommunityVote[]>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isLocked = deadline ? new Date() >= new Date(deadline) : false
  const predictionMap = new Map(myPredictions.map((p) => [p.category, p]))

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display">Season Predictions</h1>
        <p className="text-primary/60 mt-0.5">
          {isLocked
            ? "Predictions are locked"
            : "Pick your winners before Match 11"}
        </p>
      </div>

      {/* Deadline countdown */}
      {deadline && !isLocked && (
        <Card className="border border-border bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Deadline: Match 11 start</span>
              </div>
              <CountdownTimer targetTime={deadline} variant="full" />
            </div>
          </CardContent>
        </Card>
      )}

      {isLocked && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Predictions locked since Match 11. Check standings below!
          </span>
        </div>
      )}

      {/* Prediction cards */}
      {CATEGORIES.map((cat) => (
        <PredictionCard
          key={cat.key}
          category={cat}
          players={players}
          currentPick={predictionMap.get(cat.key) ?? null}
          standings={standings[cat.key]}
          votes={communityVotes[cat.key]}
          isLocked={isLocked}
          isPending={isPending}
          onSubmit={(playerId) => {
            startTransition(async () => {
              const result = await submitPrediction(cat.key, playerId)
              if (result.error) {
                alert(result.error)
              } else {
                router.refresh()
              }
            })
          }}
        />
      ))}

      {/* Prediction summary */}
      <div className="text-center text-sm text-muted-foreground">
        {myPredictions.length}/3 predictions made
      </div>
    </div>
  )
}

function PredictionCard({
  category,
  players,
  currentPick,
  standings,
  votes,
  isLocked,
  isPending,
  onSubmit,
}: {
  category: (typeof CATEGORIES)[number]
  players: Player[]
  currentPick: PredictionRecord | null
  standings: AwardStanding[]
  votes: CommunityVote[]
  isLocked: boolean
  isPending: boolean
  onSubmit: (playerId: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [search, setSearch] = useState("")
  const Icon = category.icon

  const filtered = useMemo(() => {
    if (!search.trim()) return players.slice(0, 20)
    const q = search.toLowerCase()
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.team?.short_name.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [search, players])

  // Merge votes with standings to build poll rows
  const pollRows = useMemo(() => {
    const totalVotes = votes.reduce((sum, v) => sum + v.count, 0)
    const voteMap = new Map(votes.map((v) => [v.player_id, v.count]))
    const standingMap = new Map(standings.map((s) => [s.player_id, s]))

    // Collect all player IDs: standings + voted players not in top 5 standings
    const allIds = new Set([
      ...standings.map((s) => s.player_id),
      ...votes.map((v) => v.player_id),
    ])

    const rows = Array.from(allIds).map((pid) => {
      const standing = standingMap.get(pid)
      const voteCount = voteMap.get(pid) ?? 0
      const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
      return {
        player_id: pid,
        player_name: standing?.player_name ?? "Unknown",
        team_short_name: standing?.team_short_name ?? null,
        team_color: standing?.team_color ?? null,
        stat_value: standing?.stat_value ?? null,
        vote_count: voteCount,
        pct,
      }
    })

    // Sort by vote count desc, then by stat value desc
    rows.sort((a, b) =>
      b.vote_count !== a.vote_count
        ? b.vote_count - a.vote_count
        : (b.stat_value ?? 0) - (a.stat_value ?? 0)
    )

    // Show top 5 (or all if fewer)
    return { rows: rows.slice(0, 5), total: totalVotes }
  }, [votes, standings])

  return (
    <Card className={`border border-border bg-gradient-to-br ${category.bgColor} via-transparent to-transparent`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`h-5 w-5 ${category.color}`} />
            {category.label}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{category.description}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current pick / picker */}
        {currentPick && !isEditing ? (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/20 p-1">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{currentPick.player?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentPick.player?.team?.short_name} · {currentPick.player?.role}
                </p>
              </div>
            </div>
            {!isLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                Change
              </Button>
            )}
          </div>
        ) : !isLocked ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search player or team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
              {filtered.map((player) => (
                <button
                  key={player.id}
                  disabled={isPending}
                  onClick={() => {
                    onSubmit(player.id)
                    setIsEditing(false)
                    setSearch("")
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    {player.team && (
                      <TeamLogo team={player.team} size="sm" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{player.name}</p>
                      <p className="text-xs text-muted-foreground">{player.role}</p>
                    </div>
                  </div>
                  {player.team && (
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{ borderColor: player.team.color, color: player.team.color }}
                    >
                      {player.team.short_name}
                    </Badge>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No players found</p>
              )}
            </div>
            {isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsEditing(false); setSearch("") }}
                className="text-xs"
              >
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No prediction made</p>
        )}

        {/* Opinion poll */}
        {(pollRows.rows.length > 0 || standings.length > 0) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>
                  {pollRows.total > 0
                    ? `${pollRows.total} pick${pollRows.total !== 1 ? "s" : ""}`
                    : "No picks yet"}
                </span>
              </div>
              {standings.length > 0 && standings[0] && (
                <span className="text-xs text-muted-foreground">
                  Leading: {standings[0].player_name} — {standings[0].stat_value} {category.statLabel}
                </span>
              )}
            </div>

            {/* Show standings if no votes yet */}
            {pollRows.total === 0 && standings.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const maxStat = Math.max(...standings.map((s) => s.stat_value ?? 0), 1)
                  const myPickRank = currentPick
                    ? standings.findIndex((s) => s.player_id === currentPick.player_id) + 1
                    : 0
                  return standings.map((s, i) => {
                    const isMyPick = currentPick?.player_id === s.player_id
                    const barPct = Math.round(((s.stat_value ?? 0) / maxStat) * 100)
                    const statusLabel =
                      isMyPick && myPickRank === 1
                        ? "Leading 🏆"
                        : isMyPick && myPickRank <= 2
                        ? "Close 📈"
                        : isMyPick
                        ? "Off track"
                        : null
                    return (
                      <div key={s.player_id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-4 text-center text-xs text-muted-foreground font-mono">{i + 1}</span>
                          {s.team_color && (
                            <TeamLogo
                              team={{ short_name: s.team_short_name ?? "", color: s.team_color }}
                              size="sm"
                            />
                          )}
                          <span className={`flex-1 text-sm truncate ${isMyPick ? "font-semibold" : ""}`}>
                            {s.player_name}
                            {isMyPick && <Check className="inline h-3 w-3 text-primary ml-1.5" />}
                          </span>
                          {statusLabel && (
                            <span className="text-[10px] text-primary font-medium">{statusLabel}</span>
                          )}
                          <span className="text-xs font-semibold tabular-nums">
                            {s.stat_value} {category.statLabel}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden ml-6">
                          <motion.div
                            className={`h-full rounded-full ${isMyPick ? "bg-primary" : "bg-muted-foreground/30"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }}
                          />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <div className="space-y-2">
                {pollRows.rows.map((row) => {
                  const isMyPick = currentPick?.player_id === row.player_id
                  const standing = standings.find((s) => s.player_id === row.player_id)
                  return (
                    <div key={row.player_id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        {row.team_color && (
                          <TeamLogo
                            team={{ short_name: row.team_short_name ?? "", color: row.team_color }}
                            size="sm"
                          />
                        )}
                        <span className={`flex-1 text-sm truncate ${isMyPick ? "font-semibold" : ""}`}>
                          {row.player_name}
                          {isMyPick && (
                            <Check className="inline h-3 w-3 text-primary ml-1.5" />
                          )}
                        </span>
                        {standing && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {standing.stat_value} {category.statLabel}
                          </span>
                        )}
                        <span className={`text-xs font-semibold tabular-nums w-8 text-right ${isMyPick ? "text-primary" : ""}`}>
                          {row.pct}%
                        </span>
                      </div>
                      {/* Animated progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${isMyPick ? "bg-primary" : "bg-muted-foreground/40"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${row.pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

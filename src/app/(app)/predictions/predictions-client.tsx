"use client"

import { useState, useMemo, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CountdownTimer } from "@/components/countdown-timer"
import { submitPrediction } from "@/actions/predictions"
import { useRouter } from "next/navigation"
import { Award, Target, Zap, Search, Check, Lock, ChevronDown, ChevronUp } from "lucide-react"
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

const CATEGORIES: {
  key: PredictionCategory
  label: string
  icon: typeof Award
  color: string
  statLabel: string
  description: string
}[] = [
  {
    key: "purple_cap",
    label: "Purple Cap",
    icon: Award,
    color: "text-purple-400",
    statLabel: "Wickets",
    description: "Highest wicket-taker",
  },
  {
    key: "orange_cap",
    label: "Orange Cap",
    icon: Target,
    color: "text-orange-400",
    statLabel: "Runs",
    description: "Top run-scorer",
  },
  {
    key: "mvp",
    label: "MVP",
    icon: Zap,
    color: "text-yellow-400",
    statLabel: "Fantasy Pts",
    description: "Most fantasy points",
  },
]

export function PredictionsClient({
  players,
  myPredictions,
  deadline,
  standings,
}: {
  players: Player[]
  myPredictions: PredictionRecord[]
  deadline: string | null
  standings: Record<PredictionCategory, AwardStanding[]>
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
  isLocked,
  isPending,
  onSubmit,
}: {
  category: (typeof CATEGORIES)[number]
  players: Player[]
  currentPick: PredictionRecord | null
  standings: AwardStanding[]
  isLocked: boolean
  isPending: boolean
  onSubmit: (playerId: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [search, setSearch] = useState("")
  const [showStandings, setShowStandings] = useState(false)
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

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`h-5 w-5 ${category.color}`} />
            {category.label}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{category.description}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current pick */}
        {currentPick && !isEditing ? (
          <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Check className="h-4 w-4 text-status-success" />
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
                className="text-xs"
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
                  <div>
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">{player.role}</p>
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

        {/* Standings toggle */}
        {standings.length > 0 && (
          <div>
            <button
              onClick={() => setShowStandings(!showStandings)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {showStandings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Current Standings
            </button>
            {showStandings && (
              <div className="mt-2 space-y-1">
                {standings.map((s, i) => (
                  <div
                    key={s.player_id}
                    className="flex items-center justify-between py-1.5 px-3 rounded-md bg-secondary/30 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs text-muted-foreground">
                        {i + 1}.
                      </span>
                      <span className="font-medium">{s.player_name}</span>
                      <span className="text-xs text-muted-foreground" style={{ color: s.team_color }}>
                        {s.team_short_name}
                      </span>
                    </div>
                    <span className="font-semibold text-xs">
                      {s.stat_value} {category.statLabel.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

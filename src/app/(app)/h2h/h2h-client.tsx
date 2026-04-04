"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createChallenge, acceptChallenge, cancelChallenge } from "@/actions/h2h"
import { useRouter } from "next/navigation"
import { Coins, Swords, Plus, Trophy, Clock, X, Users } from "lucide-react"
import { formatIST } from "@/lib/utils"

type UpcomingMatch = {
  id: string
  match_number: number
  start_time: string
  home: string
  away: string
}

type UserOption = {
  id: string
  display_name: string
}

type ChallengeRow = {
  id: string
  match_id: string
  challenger_id: string
  opponent_id: string | null
  wager: number
  status: string
  winner_id: string | null
  created_at: string
  challenger: { display_name: string } | null
  opponent: { display_name: string } | null
  match: { match_number: number; start_time: string } | null
}

export function H2HClient({
  userId,
  balance,
  openChallenges,
  myChallenges,
  upcomingMatches,
  allUsers,
}: {
  userId: string
  balance: number
  openChallenges: ChallengeRow[]
  myChallenges: ChallengeRow[]
  upcomingMatches: UpcomingMatch[]
  allUsers: UserOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [selectedMatch, setSelectedMatch] = useState("")
  const [selectedOpponent, setSelectedOpponent] = useState("")
  const [wager, setWager] = useState("")

  const handleCreate = () => {
    const w = parseInt(wager)
    if (!selectedMatch || !w || w <= 0) return
    startTransition(async () => {
      const result = await createChallenge(selectedMatch, w, selectedOpponent || undefined)
      if (result.error) alert(result.error)
      else {
        setWager("")
        setSelectedMatch("")
        setSelectedOpponent("")
        router.refresh()
      }
    })
  }

  const handleAccept = (challengeId: string) => {
    startTransition(async () => {
      const result = await acceptChallenge(challengeId)
      if (result.error) alert(result.error)
      else router.refresh()
    })
  }

  const handleCancel = (challengeId: string) => {
    startTransition(async () => {
      const result = await cancelChallenge(challengeId)
      if (result.error) alert(result.error)
      else router.refresh()
    })
  }

  const statusColors: Record<string, string> = {
    open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    accepted: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled: "bg-muted text-muted-foreground",
    expired: "bg-muted text-muted-foreground",
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display flex items-center gap-2">
          <Swords className="h-6 w-6" /> H2H Challenges
        </h1>
        <p className="text-primary/60 mt-0.5">Challenge friends to 1v1 matches</p>
      </div>

      {/* Token balance */}
      <Card className="border border-white/[0.06] bg-gradient-to-br from-amber-500/8 via-transparent to-transparent">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-500/15 p-3">
              <Coins className="h-8 w-8 text-yellow-500" />
            </div>
            <div>
              <p className="text-3xl font-bold font-display tabular-nums">{balance}</p>
              <p className="text-xs text-muted-foreground">Tokens Available</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="open" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
          <TabsTrigger value="mine" className="flex-1">My Challenges</TabsTrigger>
          <TabsTrigger value="create" className="flex-1">Create</TabsTrigger>
        </TabsList>

        {/* Open Challenges */}
        <TabsContent value="open" className="space-y-3 mt-4">
          {openChallenges.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Swords className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No open challenges right now</p>
            </div>
          ) : (
            openChallenges.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                userId={userId}
                statusColors={statusColors}
                isPending={isPending}
                onAccept={() => handleAccept(c.id)}
              />
            ))
          )}
        </TabsContent>

        {/* My Challenges */}
        <TabsContent value="mine" className="space-y-3 mt-4">
          {myChallenges.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Trophy className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No challenges yet. Create one!</p>
            </div>
          ) : (
            myChallenges.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                userId={userId}
                statusColors={statusColors}
                isPending={isPending}
                onCancel={
                  c.status === "open" && c.challenger_id === userId
                    ? () => handleCancel(c.id)
                    : undefined
                }
              />
            ))
          )}
        </TabsContent>

        {/* Create Challenge */}
        <TabsContent value="create" className="mt-4">
          <Card className="border border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Challenge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Match picker */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Match</label>
                <select
                  value={selectedMatch}
                  onChange={(e) => setSelectedMatch(e.target.value)}
                  className="w-full rounded-md border border-white/[0.06] bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a match...</option>
                  {upcomingMatches.map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.match_number} {m.home} vs {m.away} — {formatIST(m.start_time, "MMM d, h:mm a")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opponent picker (optional) */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Opponent <span className="text-muted-foreground font-normal">(optional — leave empty for open challenge)</span>
                </label>
                <select
                  value={selectedOpponent}
                  onChange={(e) => setSelectedOpponent(e.target.value)}
                  className="w-full rounded-md border border-white/[0.06] bg-background px-3 py-2 text-sm"
                >
                  <option value="">Anyone can accept</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wager */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Wager (tokens)</label>
                <Input
                  type="number"
                  min={1}
                  max={balance}
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                  placeholder={`Max: ${balance}`}
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={isPending || !selectedMatch || !wager || parseInt(wager) <= 0}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold glow-card"
              >
                {isPending ? "Creating..." : `Challenge (${wager || 0} tokens)`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ChallengeCard({
  challenge: c,
  userId,
  statusColors,
  isPending,
  onAccept,
  onCancel,
}: {
  challenge: ChallengeRow
  userId: string
  statusColors: Record<string, string>
  isPending: boolean
  onAccept?: () => void
  onCancel?: () => void
}) {
  const isChallenger = c.challenger_id === userId
  const isWinner = c.winner_id === userId
  const isDraw = c.status === "completed" && !c.winner_id

  return (
    <Card className="border border-white/[0.06]">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Badge className={statusColors[c.status] ?? "bg-muted"}>
                {c.status}
              </Badge>
              {c.match && (
                <span className="text-xs text-muted-foreground">
                  Match #{c.match.match_number}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className={isChallenger ? "font-semibold" : ""}>
                {c.challenger?.display_name ?? "Unknown"}
              </span>
              <Swords className="h-3 w-3 text-muted-foreground" />
              <span className={!isChallenger && c.opponent_id === userId ? "font-semibold" : ""}>
                {c.opponent?.display_name ?? (c.opponent_id ? "Unknown" : "Open")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Coins className="h-3 w-3" /> {c.wager} tokens each
              </span>
              {c.match?.start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatIST(c.match.start_time, "MMM d")}
                </span>
              )}
            </div>
            {c.status === "completed" && (
              <p className="text-xs font-medium mt-1">
                {isDraw ? (
                  <span className="text-muted-foreground">Draw — tokens refunded</span>
                ) : isWinner ? (
                  <span className="text-status-success">You won {c.wager * 2} tokens!</span>
                ) : (
                  <span className="text-red-400">You lost {c.wager} tokens</span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {onAccept && c.challenger_id !== userId && (
              <Button size="sm" onClick={onAccept} disabled={isPending} className="text-xs">
                Accept
              </Button>
            )}
            {onCancel && (
              <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending} className="text-xs">
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

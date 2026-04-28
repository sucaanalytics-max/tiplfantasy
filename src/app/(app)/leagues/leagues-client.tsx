"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, UserPlus, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LeagueCard } from "@/components/league-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createLeague, joinLeague } from "@/actions/leagues"
import type { LeagueWithMemberCount } from "@/lib/types"

type LeaguesClientProps = {
  leagues: LeagueWithMemberCount[]
}

export function LeaguesClient({ leagues }: LeaguesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [leagueName, setLeagueName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")

  function handleCreate() {
    if (!leagueName.trim()) return
    setError("")
    startTransition(async () => {
      const result = await createLeague(leagueName.trim())
      if (result.error) {
        setError(result.error)
        return
      }
      setLeagueName("")
      setCreateOpen(false)
      router.refresh()
    })
  }

  function handleJoin() {
    const code = inviteCode.trim().toUpperCase()
    if (code.length !== 6) {
      setError("Invite code must be 6 characters")
      return
    }
    setError("")
    startTransition(async () => {
      const result = await joinLeague(code)
      if (result.error) {
        setError(result.error)
        return
      }
      setInviteCode("")
      setJoinOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leagues</h1>
        <p className="text-primary/60 mt-0.5">
          Compete with friends in private leagues
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); setError(""); setLeagueName("") }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create League
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create League</DialogTitle>
              <DialogDescription>
                Give your league a name. You'll get an invite code to share.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="League name"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                maxLength={40}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
              />
              {error && <p className="text-sm text-status-danger">{error}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isPending || !leagueName.trim()}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={joinOpen} onOpenChange={(open) => { setJoinOpen(open); setError(""); setInviteCode("") }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Join League
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join League</DialogTitle>
              <DialogDescription>
                Enter the 6-character invite code shared by the league creator.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                className="uppercase tracking-widest text-center font-mono text-lg"
                onKeyDown={(e) => { if (e.key === "Enter") handleJoin() }}
              />
              {error && <p className="text-sm text-status-danger">{error}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleJoin} disabled={isPending || inviteCode.trim().length !== 6}>
                {isPending ? "Joining..." : "Join"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* League cards */}
      {leagues.length === 0 ? (
        <Card className="border border-dashed border-overlay-border">
          <CardContent className="pt-6 pb-6 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              You're not in any leagues yet. Create one or join with an invite
              code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {leagues.map((league) => (
            <LeagueCard
              key={league.id}
              id={league.id}
              name={league.name}
              inviteCode={league.invite_code}
              memberCount={league.member_count}
            />
          ))}
        </div>
      )}
    </div>
  )
}

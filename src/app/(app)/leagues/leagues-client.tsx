"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, UserPlus, Users, Copy, Check, Crown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  function handleCopyCode(leagueId: string, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(leagueId)
    setTimeout(() => setCopiedId(null), 2000)
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
        <Card className="border border-dashed border-white/[0.06]">
          <CardContent className="pt-6 pb-6 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              You're not in any leagues yet. Create one or join with an invite
              code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {leagues.map((league) => (
            <Link key={league.id} href={`/leagues/${league.id}`}>
              <Card className="glass hover:bg-accent/50 transition-colors">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{league.name}</h3>
                        {league.creator_id && (
                          <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {league.member_count} {league.member_count === 1 ? "member" : "members"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleCopyCode(league.id, league.invite_code)
                          }}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Badge variant="outline" className="font-mono text-xs gap-1 cursor-pointer">
                            {league.invite_code}
                            {copiedId === league.id ? (
                              <Check className="h-3 w-3 text-status-success" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Badge>
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

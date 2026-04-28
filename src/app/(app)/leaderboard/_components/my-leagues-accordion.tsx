"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Plus, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { LeagueCard } from "@/components/league-card"
import { createLeague, joinLeague } from "@/actions/leagues"
import { cn } from "@/lib/utils"
import type { LeagueWithMemberCount } from "@/lib/types"

type Props = {
  leagues: LeagueWithMemberCount[]
  /** Defaults to closed. Pass `defaultOpen` if you want the accordion expanded
   *  on first paint (e.g. when the user has no leagues, prompt them to act). */
  defaultOpen?: boolean
}

/**
 * Collapsible "Your leagues" accordion mounted at the top of /leaderboard.
 * Replaces the standalone /leagues page in the bottom nav. Surfaces the
 * existing <LeagueCard/> grid + create/join CTAs without leaving the
 * leaderboard context.
 *
 * /leagues and /leagues/[id] routes still resolve — invite-link UX
 * (someone shares a 6-char code) is unchanged. This is purely a nav
 * surface consolidation.
 */
export function MyLeaguesAccordion({ leagues, defaultOpen }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(defaultOpen ?? leagues.length === 0)

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
    <section className="rounded-2xl border border-overlay-border bg-card overflow-hidden">
      {/* Header — clickable accordion toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-overlay-subtle"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your leagues
          </span>
          <span className="text-2xs tabular-nums text-muted-foreground/70 font-display font-bold">
            {leagues.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground/60 transition-transform shrink-0",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-overlay-border px-4 py-4 space-y-4">
          {leagues.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              You&apos;re not in any leagues yet. Create one or join with an invite code.
            </p>
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

          {/* Create / Join action row */}
          <div className="flex flex-wrap items-center gap-2 justify-center pt-1">
            <Dialog
              open={createOpen}
              onOpenChange={(o) => { setCreateOpen(o); setError(""); setLeagueName("") }}
            >
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
                    Give your league a name. You&apos;ll get an invite code to share.
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

            <Dialog
              open={joinOpen}
              onOpenChange={(o) => { setJoinOpen(o); setError(""); setInviteCode("") }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Join with code
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
        </div>
      )}
    </section>
  )
}

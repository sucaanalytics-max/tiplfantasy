"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Copy, Check, Share2, Trash2, ArrowLeft, Users, Trophy, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { leaveLeague, deleteLeague } from "@/actions/leagues"
import type { League, LeagueLeaderboardEntry } from "@/lib/types"
import { getInitials, getAvatarHexColor } from "@/lib/avatar"

type MemberProfile = {
  user_id: string
  joined_at: string
  profile: { display_name: string; avatar_url: string | null }[] | { display_name: string; avatar_url: string | null } | null
}

type Props = {
  league: League
  members: MemberProfile[]
  isCreator: boolean
  leaderboard: LeagueLeaderboardEntry[]
}

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"]

export function LeagueDetailClient({ league, members, isCreator, leaderboard }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleShare(): void {
    const shareData = {
      title: "Join my TIPL league!",
      text: `Join "${league.name}" on TIPL! Use invite code: ${league.invite_code}`,
    }

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        copyCode()
      })
    } else {
      copyCode()
    }
  }

  function copyCode(): void {
    navigator.clipboard.writeText(league.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleLeave(): void {
    startTransition(async () => {
      const result = await leaveLeague(league.id)
      if (result.error) {
        alert(result.error)
        return
      }
      router.push("/leagues")
      router.refresh()
    })
  }

  function handleDelete(): void {
    startTransition(async () => {
      const result = await deleteLeague(league.id)
      if (result.error) {
        alert(result.error)
        return
      }
      setDeleteOpen(false)
      router.push("/leagues")
      router.refresh()
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/leagues">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{league.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {members.length} {members.length === 1 ? "member" : "members"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Invite Code */}
      <Card className="border border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Invite Code</p>
              <p className="font-mono text-lg font-bold tracking-widest">{league.invite_code}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Leaderboard
            </CardTitle>
            <Link href={`/leagues/${league.id}/h2h`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <Swords className="h-3.5 w-3.5" />
                Head-to-Head
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No scores yet. Play some matches!
            </p>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-[2rem_1fr_4rem_3rem_3.5rem] gap-2 text-xs text-muted-foreground px-3 pb-1">
                <span>#</span>
                <span>Player</span>
                <span className="text-right">Pts</span>
                <span className="text-right">M</span>
                <span className="text-right">Avg</span>
              </div>

              {leaderboard.map((entry, i) => {
                const rank = i + 1
                const displayName = entry.display_name ?? "Unknown"
                const color = getAvatarHexColor(displayName)
                const initials = getInitials(displayName)

                return (
                  <div
                    key={entry.user_id}
                    className="grid grid-cols-[2rem_1fr_4rem_3rem_3.5rem] gap-2 items-center py-2.5 px-3 rounded-lg bg-secondary/50"
                  >
                    <span className="text-sm text-center">
                      {rank <= 3 ? MEDALS[rank - 1] : rank}
                    </span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {initials}
                      </div>
                      <span className="text-sm truncate">{displayName}</span>
                    </div>
                    <span className="text-sm font-bold text-right">{entry.total_points}</span>
                    <span className="text-xs text-muted-foreground text-right">
                      {entry.matches_played}
                    </span>
                    <span className="text-xs text-muted-foreground text-right">
                      {entry.avg_points.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((member) => {
              const prof = Array.isArray(member.profile) ? member.profile[0] : member.profile
              const name = prof?.display_name ?? "Unknown"
              const color = getAvatarHexColor(name)
              const initials = getInitials(name)
              const joinDate = new Date(member.joined_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm truncate block">{name}</span>
                      {member.user_id === league.creator_id && (
                        <span className="text-[10px] text-muted-foreground">Creator</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    Joined {joinDate}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        {!isCreator && (
          <Button
            variant="outline"
            onClick={handleLeave}
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? "Leaving..." : "Leave League"}
          </Button>
        )}
        {isCreator && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="flex-1 gap-2">
                <Trash2 className="h-4 w-4" />
                Delete League
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete League</DialogTitle>
                <DialogDescription>
                  This will permanently delete &quot;{league.name}&quot; and remove all members.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                  {isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

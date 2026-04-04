"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ROLE_COLORS, CAPTAIN_BADGE, VICE_CAPTAIN_BADGE } from "@/lib/badges"
import { getMyTeamForMatch } from "@/actions/selections"
import type { PlayerWithTeam, PlayerRole } from "@/lib/types"

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

type TeamData = {
  players: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
}

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5]

type Props = {
  matchId: string
  matchLabel: string
  status: string
}

export function TeamPreviewSheet({ matchId, matchLabel, status }: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<TeamData | null | "loading">("loading")

  function handleOpen() {
    setOpen(true)
    setData("loading")
    getMyTeamForMatch(matchId).then(setData)
  }

  const sortedPlayers =
    data !== "loading" && data !== null
      ? [...data.players].sort(
          (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
        )
      : []

  return (
    <>
      <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={handleOpen}>
        <Eye className="h-3.5 w-3.5" />
        Preview
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[85dvh] flex flex-col">
          <div className="max-w-lg mx-auto w-full flex flex-col flex-1 min-h-0">
            <SheetHeader className="px-4 pt-5 pb-3">
              <SheetTitle>Your Team</SheetTitle>
              <SheetDescription>{matchLabel}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {data === "loading" ? (
                <div className="px-4 space-y-2 pb-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-lg" />
                  ))}
                </div>
              ) : data === null ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No team submitted for this match.
                </p>
              ) : (
                <div className="pb-2">
                  {sortedPlayers.map((player) => {
                    const isC = player.id === data.captainId
                    const isVC = player.id === data.viceCaptainId
                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 py-2.5 px-4 border-b border-white/[0.04] last:border-0"
                      >
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 w-10 text-center",
                            ROLE_COLORS[player.role]
                          )}
                        >
                          {player.role}
                        </span>
                        <span className="flex-1 text-sm truncate">{player.name}</span>
                        {isC && (
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", CAPTAIN_BADGE)}>
                            C
                          </span>
                        )}
                        {isVC && (
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", VICE_CAPTAIN_BADGE)}>
                            VC
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-right shrink-0"
                          style={{ color: player.team.color, backgroundColor: `${player.team.color}18` }}
                        >
                          {player.team.short_name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {status === "upcoming" && data !== "loading" && data !== null && (
              <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/[0.06]">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  asChild
                >
                  <Link href={`/match/${matchId}/pick`} onClick={() => setOpen(false)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Team
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Badge } from "@/components/ui/badge"
import { TeamLogo } from "@/components/team-logo"
import { cn } from "@/lib/utils"
import type { PlayerScoreRow, TeamInfo } from "../scores-client"

const ROLE_COLORS: Record<string, string> = {
  WK: "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]",
  BAT: "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]",
  AR: "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]",
  BOWL: "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]",
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  myXI: Array<PlayerScoreRow & { isC: boolean; isVC: boolean; mult: number; effective: number }>
  allPlayerScores: PlayerScoreRow[]
  myPlayerSet: Set<string>
  home: TeamInfo
  away: TeamInfo
}

export function MyXIDrawer({ open, onOpenChange, myXI, allPlayerScores, myPlayerSet, home, away }: Props) {
  const [tab, setTab] = useState<"mine" | "all">("mine")
  const [viewportH, setViewportH] = useState(0)
  useEffect(() => {
    if (typeof window === "undefined") return
    const update = () => setViewportH(window.innerHeight)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  const dialogH = Math.max(360, Math.floor(viewportH * 0.9))
  const scrollH = Math.max(220, dialogH - 96)   // minus drag handle + segmented toggle row

  const myTotal = useMemo(
    () => Math.round(myXI.reduce((s, p) => s + p.effective, 0)),
    [myXI],
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          data-build="myxi-dlg-pxh-v1"
          style={{ height: dialogH > 0 ? `${dialogH}px` : "90vh" }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl flex flex-col bg-background border-t border-x rounded-t-xl shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
        >
          <DialogPrimitive.Title className="sr-only">My XI</DialogPrimitive.Title>
          <div className="mx-auto mt-3 mb-1 h-1 w-12 rounded-full bg-muted-foreground/30 shrink-0" />

          <div className="flex flex-col overflow-hidden px-4 pb-6 pt-2">
          {/* Segmented toggle */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-lg bg-secondary/40 self-center">
            <button
              onClick={() => setTab("mine")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors tabular-nums",
                tab === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              My XI · {myTotal}
            </button>
            <button
              onClick={() => setTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                tab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              All Players · {allPlayerScores.length}
            </button>
          </div>

          <div
            style={{ height: scrollH > 0 ? `${scrollH}px` : undefined }}
            className="overflow-y-auto overscroll-contain"
          >
            {tab === "mine" ? (
              myXI.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  You didn&apos;t pick a team for this match.
                </p>
              ) : (
                <MyXITable rows={myXI} />
              )
            ) : (
              <AllPlayersTables
                allPlayerScores={allPlayerScores}
                myPlayerSet={myPlayerSet}
                home={home}
                away={away}
              />
            )}
          </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ─── My XI table (compact dense) ─────────────────────────────────────────

function MyXITable({ rows }: { rows: Array<PlayerScoreRow & { isC: boolean; isVC: boolean; mult: number; effective: number }> }) {
  const totalCatches = rows.reduce((s, p) => s + p.catches, 0)
  const totalStumpings = rows.reduce((s, p) => s + p.stumpings, 0)
  const totalRunOuts = rows.reduce((s, p) => s + p.run_outs, 0)
  const hasField = totalCatches + totalStumpings + totalRunOuts > 0

  return (
    <div className="rounded-xl border border-overlay-border overflow-x-auto">
      <div className="grid grid-cols-[2.5rem_1fr_1.5rem_1.5rem_1.5rem_1.5rem_1px_1.5rem_1.8rem_1.8rem_1.5rem_3.2rem] gap-px px-3 py-2 text-[9px] text-muted-foreground/70 uppercase tracking-widest font-semibold border-b border-overlay-border bg-secondary/40 min-w-[420px]">
        <span /><span>Player</span>
        <span className="text-right">R</span><span className="text-right">B</span>
        <span className="text-right">4s</span><span className="text-right">6s</span>
        <span /><span className="text-right">W</span><span className="text-right">Ov</span>
        <span className="text-right">RC</span><span className="text-right">M</span>
        <span className="text-right">Pts</span>
      </div>
      {rows.map((ps, idx) => {
        const isLast = idx === rows.length - 1
        const bowled = Number(ps.overs_bowled) > 0
        return (
          <div
            key={ps.player_id}
            className={cn(
              "grid grid-cols-[2.5rem_1fr_1.5rem_1.5rem_1.5rem_1.5rem_1px_1.5rem_1.8rem_1.8rem_1.5rem_3.2rem] gap-px items-center px-3 py-1.5 min-w-[420px]",
              !isLast && "border-b border-overlay-border",
            )}
          >
            <div className="flex items-center gap-0.5">
              {ps.isC && <span className="text-[8px] font-bold text-[var(--tw-amber-text)] mr-px">C</span>}
              {ps.isVC && <span className="text-[8px] font-bold text-[var(--tw-sky-text)] mr-px">VC</span>}
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] border leading-none", ROLE_COLORS[ps.player.role])}>
                {ps.player.role}
              </Badge>
            </div>
            <span className="text-[13px] font-medium truncate text-foreground">{ps.player.name}</span>
            <span className="text-[13px] text-right tabular-nums">{ps.runs > 0 ? ps.runs : "-"}</span>
            <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.balls_faced > 0 ? ps.balls_faced : "-"}</span>
            <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.fours > 0 ? ps.fours : "-"}</span>
            <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{ps.sixes > 0 ? ps.sixes : "-"}</span>
            <span className="h-4 bg-border/20" />
            <span className="text-[13px] text-right tabular-nums">{bowled ? ps.wickets : "-"}</span>
            <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{bowled ? ps.overs_bowled : "-"}</span>
            <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{bowled ? ps.runs_conceded : "-"}</span>
            <span className="text-[13px] text-right tabular-nums text-muted-foreground/60">{bowled ? ps.maidens : "-"}</span>
            <div className="text-right">
              <span className="text-[13px] font-bold font-display tabular-nums">{ps.effective}</span>
              {ps.mult > 1 && <p className="text-[8px] text-muted-foreground/50">{Number(ps.fantasy_points)}×{ps.mult}</p>}
            </div>
          </div>
        )
      })}
      {hasField && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-muted-foreground/50 border-t border-border/20 bg-secondary/10">
          <span className="font-semibold uppercase tracking-widest text-muted-foreground/40">Field</span>
          {totalCatches > 0 && <span>{totalCatches}c</span>}
          {totalStumpings > 0 && <span>{totalStumpings}st</span>}
          {totalRunOuts > 0 && <span>{totalRunOuts}ro</span>}
        </div>
      )}
    </div>
  )
}

// ─── All players (per-team tables) ───────────────────────────────────────

function AllPlayersTables({
  allPlayerScores, myPlayerSet, home, away,
}: { allPlayerScores: PlayerScoreRow[]; myPlayerSet: Set<string>; home: TeamInfo; away: TeamInfo }) {
  const homePlayers = allPlayerScores.filter((ps) => ps.player.team.short_name === home.short_name)
  const awayPlayers = allPlayerScores.filter((ps) => ps.player.team.short_name === away.short_name)

  return (
    <div className="space-y-4">
      {[
        { team: away, players: awayPlayers, label: away.short_name },
        { team: home, players: homePlayers, label: home.short_name },
      ].map(({ team, players, label }) => {
        const sorted = [...players].sort((a, b) => Number(b.fantasy_points) - Number(a.fantasy_points))
        return (
          <div key={team.short_name} className="rounded-xl border border-overlay-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-overlay-border bg-overlay-subtle">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: team.color }} />
              <TeamLogo team={team} size="sm" />
              <span className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: team.color }}>{label}</span>
            </div>
            {sorted.map((ps, idx) => {
              const isMine = myPlayerSet.has(ps.player_id)
              const isLast = idx === sorted.length - 1
              return (
                <div key={ps.player_id} className={cn("px-3 py-2", !isLast && "border-b border-overlay-border", isMine && "bg-primary/5")}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] border leading-none shrink-0", ROLE_COLORS[ps.player.role])}>{ps.player.role}</Badge>
                    <span className="text-[13px] font-semibold truncate min-w-0 flex-1">
                      {ps.player.name}
                      {isMine && <span className="text-[8px] text-primary ml-1">●</span>}
                    </span>
                    <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">
                      {ps.runs > 0 || ps.balls_faced > 0 ? `${ps.runs}(${ps.balls_faced})` : ""}
                      {ps.runs > 0 && Number(ps.overs_bowled) > 0 ? " · " : ""}
                      {Number(ps.overs_bowled) > 0 ? `${ps.wickets}/${ps.runs_conceded}` : ""}
                    </span>
                    <span className="text-base font-bold font-display tabular-nums shrink-0 ml-2 min-w-[2.5rem] text-right">{Number(ps.fantasy_points)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

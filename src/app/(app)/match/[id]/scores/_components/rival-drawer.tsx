"use client"

import { useMemo } from "react"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import {
  buildCaptainDuel,
  buildHeadToHead,
  computePointsInPlay,
  computeXiOverlap,
  generateInsight,
  type PlayerLite,
  type PlayerScore,
  type Selection,
} from "@/lib/rivalry"

const ROLE_COLORS: Record<string, string> = {
  WK: "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]",
  BAT: "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]",
  AR: "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]",
  BOWL: "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]",
}

type Rival = {
  user_id: string
  display_name: string
  total_points: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  me: { display_name: string; total_points: number } | null
  rival: Rival | null
  mySelection: Selection | null
  rivalSelection: Selection | null
  psMap: Map<string, PlayerScore>
  rosterMap: Map<string, PlayerLite>
  matchStatus: string
}

export function RivalDrawer({
  open, onOpenChange,
  me, rival,
  mySelection, rivalSelection,
  psMap, rosterMap, matchStatus,
}: Props) {
  const data = useMemo(() => {
    if (!me || !rival || !mySelection || !rivalSelection) return null
    const h2h = buildHeadToHead(mySelection, rivalSelection, psMap, rosterMap)
    const captainDuel = buildCaptainDuel(mySelection, rivalSelection, psMap, rosterMap)
    const overlap = computeXiOverlap(mySelection, rivalSelection)
    const myInPlay = computePointsInPlay(mySelection, psMap, rosterMap)
    const theirInPlay = computePointsInPlay(rivalSelection, psMap, rosterMap)
    const insight = generateInsight({
      pointsDelta: me.total_points - rival.total_points,
      captainDuel,
      myInPlay, theirInPlay,
      myEdgeCount: h2h.myEdge.length,
      theirEdgeCount: h2h.theirEdge.length,
      overlapPct: overlap.pct,
      matchStatus,
    })
    return { h2h, captainDuel, overlap, myInPlay, theirInPlay, insight }
  }, [me, rival, mySelection, rivalSelection, psMap, rosterMap, matchStatus])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerTitle className="sr-only">Rival comparison</DrawerTitle>

        {!data || !me || !rival ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comparison available — opponent has no team selected yet.
          </p>
        ) : (
          <div className="flex flex-col overflow-y-auto px-4 pb-6 pt-2 gap-4" data-vaul-no-drag>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Side
                name={me.display_name}
                points={me.total_points}
                align="left"
                isMe
              />
              <SignedDelta delta={me.total_points - rival.total_points} />
              <Side
                name={rival.display_name}
                points={rival.total_points}
                align="right"
              />
            </div>

            {/* Captain duel */}
            <CaptainDuelBlock
              myCaptain={data.captainDuel.myCaptain}
              theirCaptain={data.captainDuel.theirCaptain}
              myVC={data.captainDuel.myVC}
              theirVC={data.captainDuel.theirVC}
              captainDelta={data.captainDuel.captainDelta}
              vcDelta={data.captainDuel.vcDelta}
            />

            {/* Insight */}
            {data.insight && (
              <div className="rounded-lg border border-overlay-border bg-overlay-subtle px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Insight</p>
                <p className="text-xs text-foreground/90">{data.insight}</p>
              </div>
            )}

            {/* Footer metrics row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric
                label="Shared"
                value={`${data.overlap.count}/11`}
                sub={`${data.overlap.pct}%`}
              />
              <Metric
                label="My edge"
                value={`+${sumEffective(data.h2h.myEdge)}`}
                sub={`${data.h2h.myEdge.length} picks`}
                tone="good"
              />
              <Metric
                label="Their edge"
                value={`+${sumEffective(data.h2h.theirEdge)}`}
                sub={`${data.h2h.theirEdge.length} picks`}
                tone="bad"
              />
            </div>

            {(data.myInPlay != null || data.theirInPlay != null) && matchStatus === "live" && (
              <div className="rounded-lg border border-overlay-border px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Points in play (est.)</span>
                <span className="tabular-nums">
                  <span className="text-[var(--tw-emerald-text)] font-semibold">~{data.myInPlay ?? "—"}</span>
                  <span className="text-muted-foreground/60 mx-1.5">vs</span>
                  <span className="text-[var(--tw-red-text)] font-semibold">~{data.theirInPlay ?? "—"}</span>
                </span>
              </div>
            )}

            {/* Edge picks */}
            <EdgeList
              title="Your edge"
              tone="good"
              entries={data.h2h.myEdge}
              emptyText="No unique picks"
            />
            <EdgeList
              title="Their edge"
              tone="bad"
              entries={data.h2h.theirEdge}
              emptyText="No unique picks"
            />

            {/* Shared XI overlap */}
            {data.h2h.shared.length > 0 && (
              <SharedList entries={data.h2h.shared} />
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

// ─── Pieces ──────────────────────────────────────────────────────────────

function Side({ name, points, align, isMe }: { name: string; points: number; align: "left" | "right"; isMe?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", align === "right" && "flex-row-reverse")}>
      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", getAvatarColor(name))}>
        <span className="text-white text-[11px] font-semibold">{getInitials(name)}</span>
      </div>
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="text-xs font-semibold truncate max-w-[110px]">
          {name}{isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
        </p>
        <p className="text-base font-display font-bold tabular-nums">{points}</p>
      </div>
    </div>
  )
}

function SignedDelta({ delta }: { delta: number }) {
  const tone =
    delta > 0 ? "text-[var(--tw-emerald-text)]" :
    delta < 0 ? "text-[var(--tw-red-text)]" :
    "text-muted-foreground"
  return (
    <div className={cn("flex flex-col items-center justify-center font-display", tone)}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Diff</p>
      <p className="text-lg font-bold tabular-nums">
        {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "0"}
      </p>
    </div>
  )
}

type CaptainSlot = { name: string; role: string; basePoints: number; effective: number } | null

function CaptainDuelBlock({
  myCaptain, theirCaptain, myVC, theirVC, captainDelta, vcDelta,
}: {
  myCaptain: CaptainSlot
  theirCaptain: CaptainSlot
  myVC: CaptainSlot
  theirVC: CaptainSlot
  captainDelta: number
  vcDelta: number
}) {
  return (
    <div className="rounded-xl border border-overlay-border overflow-hidden">
      <CaptainRow
        label="C"
        mult="2×"
        my={myCaptain}
        their={theirCaptain}
        delta={captainDelta}
      />
      {(myVC || theirVC) && (
        <>
          <div className="h-px bg-overlay-border" />
          <CaptainRow
            label="VC"
            mult="1.5×"
            my={myVC}
            their={theirVC}
            delta={vcDelta}
          />
        </>
      )}
    </div>
  )
}

function CaptainRow({
  label, mult, my, their, delta,
}: { label: string; mult: string; my: CaptainSlot; their: CaptainSlot; delta: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 bg-overlay-subtle/40">
      <CaptainSide slot={my} align="left" />
      <div className="flex flex-col items-center text-center">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label} {mult}</span>
        <span className={cn(
          "text-sm font-bold font-display tabular-nums",
          delta > 0 ? "text-[var(--tw-emerald-text)]" :
          delta < 0 ? "text-[var(--tw-red-text)]" :
          "text-muted-foreground",
        )}>
          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "—"}
        </span>
      </div>
      <CaptainSide slot={their} align="right" />
    </div>
  )
}

function CaptainSide({ slot, align }: { slot: CaptainSlot; align: "left" | "right" }) {
  if (!slot) {
    return <span className={cn("text-xs text-muted-foreground/50", align === "right" && "text-right")}>—</span>
  }
  return (
    <div className={cn(align === "right" && "text-right")}>
      <p className="text-[12px] font-medium truncate">{slot.name}</p>
      <p className="text-[10px] tabular-nums text-muted-foreground">
        {slot.basePoints} → <span className="text-foreground font-semibold">{slot.effective}</span>
      </p>
    </div>
  )
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-overlay-border px-2 py-2">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn(
        "text-sm font-bold font-display tabular-nums",
        tone === "good" && "text-[var(--tw-emerald-text)]",
        tone === "bad" && "text-[var(--tw-red-text)]",
      )}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  )
}

type EdgeEntry = ReturnType<typeof buildHeadToHead>["myEdge"][number]

function EdgeList({ title, tone, entries, emptyText }: {
  title: string
  tone: "good" | "bad"
  entries: EdgeEntry[]
  emptyText: string
}) {
  const dotColor = tone === "good" ? "bg-emerald-400" : "bg-red-400"
  const headerColor = tone === "good" ? "text-[var(--tw-emerald-text)]" : "text-[var(--tw-red-text)]"
  const borderColor = tone === "good" ? "border-emerald-400/40" : "border-red-400/40"
  const valueColor = tone === "good" ? "text-foreground" : "text-[var(--tw-red-text)]"

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <p className={cn("text-xs font-semibold uppercase tracking-wide", headerColor)}>
          {title}
          <Badge variant="secondary" className="ml-1.5 text-[10px]">{entries.length}</Badge>
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-4">{emptyText}</p>
      ) : (
        <div className={cn("space-y-1 border-l-2 pl-3", borderColor)}>
          {entries.map((p) => (
            <div key={p.player_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/40 text-xs">
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] shrink-0", ROLE_COLORS[p.player.role])}>
                {p.player.role}
              </Badge>
              <span className="font-medium truncate">{p.player.name}</span>
              {p.isMultEdge ? (
                <Badge variant="outline" className={cn(
                  "text-[8px] px-1.5 py-0 h-[14px] shrink-0 border-amber-500/30",
                  tone === "good" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                  "bg-red-500/15 text-red-700 dark:text-red-300",
                )}>
                  {p.isC ? "2×" : "1.5×"} vs {p.theirIsC ? "2×" : p.theirIsVC ? "1.5×" : p.myIsC ? "2×" : p.myIsVC ? "1.5×" : "1×"}
                </Badge>
              ) : (p.isC || p.isVC) ? (
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-[14px] shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                  {p.isC ? "C" : "VC"}
                </Badge>
              ) : null}
              <span className={cn("ml-auto font-bold tabular-nums shrink-0", valueColor)}>
                +{p.effective}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type SharedEntry = ReturnType<typeof buildHeadToHead>["shared"][number]

function SharedList({ entries }: { entries: SharedEntry[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Shared <Badge variant="secondary" className="ml-1.5 text-[10px]">{entries.length}</Badge>
        </p>
      </div>
      <div className="space-y-1 border-l-2 border-muted-foreground/30 pl-3">
        {entries.map((p) => {
          const bothC = p.myMult === 2 && p.theirMult === 2
          const bothVC = p.myMult === 1.5 && p.theirMult === 1.5
          return (
            <div key={p.player_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/40 text-xs">
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-[14px] shrink-0", ROLE_COLORS[p.player.role])}>{p.player.role}</Badge>
              <span className="font-medium truncate">{p.player.name}</span>
              {(bothC || bothVC) && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-[14px] shrink-0 text-muted-foreground">
                  {bothC ? "C·C" : "VC·VC"}
                </Badge>
              )}
              <span className="ml-auto text-muted-foreground tabular-nums shrink-0">{p.myEff}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function sumEffective(entries: { effective: number }[]): number {
  return Math.round(entries.reduce((s, e) => s + e.effective, 0))
}

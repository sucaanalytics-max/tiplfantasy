"use client"

import { useMemo } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import {
  buildCaptainDuel,
  buildHeadToHead,
  computePointsInPlay,
  computeXiOverlap,
  generateInsight,
  type HeadToHead,
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
    const roster = buildAlignedRoster(h2h)
    return { h2h, captainDuel, insight, roster }
  }, [me, rival, mySelection, rivalSelection, psMap, rosterMap, matchStatus])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl h-[90vh] flex flex-col bg-background border-t border-x rounded-t-xl shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
        >
          <DialogPrimitive.Title className="sr-only">Rival comparison</DialogPrimitive.Title>
          {/* Drag-handle affordance */}
          <div className="mx-auto mt-3 mb-1 h-1 w-12 rounded-full bg-muted-foreground/30 shrink-0" />

        {!data || !me || !rival ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comparison available — opponent has no team selected yet.
          </p>
        ) : (
          <div
            className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain px-4 pb-6 pt-2 gap-4"
          >
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

            {/* Aligned roster table — replaces 3-tile metrics, points-in-play, edge lists, shared list */}
            <RosterTable
              rows={data.roster}
              myTotal={me.total_points}
              theirTotal={rival.total_points}
            />
          </div>
        )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ─── Header pieces ──────────────────────────────────────────────────────

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

// ─── Aligned roster table ────────────────────────────────────────────────

type RosterCell = {
  name: string
  role: string
  mult: number       // 1, 1.5, 2
  eff: number
  basePoints: number
}

type RosterRow = {
  player_id: string
  role: string
  my: RosterCell | null
  their: RosterCell | null
  isCaptaincyEdge: boolean
  isMyOnly: boolean
  isTheirOnly: boolean
}

function buildAlignedRoster(h2h: HeadToHead): RosterRow[] {
  const rows: RosterRow[] = []

  // Pure shared (equal multipliers on both sides)
  for (const s of h2h.shared) {
    rows.push({
      player_id: s.player_id,
      role: s.player.role,
      my: { name: s.player.name, role: s.player.role, mult: s.myMult, eff: s.myEff, basePoints: s.fantasyPoints },
      their: { name: s.player.name, role: s.player.role, mult: s.theirMult, eff: s.theirEff, basePoints: s.fantasyPoints },
      isCaptaincyEdge: false,
      isMyOnly: false,
      isTheirOnly: false,
    })
  }

  // myEdge: my-only OR shared-with-my-higher-mult (captaincy edge)
  for (const e of h2h.myEdge) {
    if (e.isMultEdge) {
      const myMult = e.isC ? 2 : e.isVC ? 1.5 : 1
      const theirMult = e.theirIsC ? 2 : e.theirIsVC ? 1.5 : 1
      rows.push({
        player_id: e.player_id,
        role: e.player.role,
        my: { name: e.player.name, role: e.player.role, mult: myMult, eff: round2(e.fantasyPoints * myMult), basePoints: e.fantasyPoints },
        their: { name: e.player.name, role: e.player.role, mult: theirMult, eff: round2(e.fantasyPoints * theirMult), basePoints: e.fantasyPoints },
        isCaptaincyEdge: true,
        isMyOnly: false,
        isTheirOnly: false,
      })
    } else {
      const mult = e.isC ? 2 : e.isVC ? 1.5 : 1
      rows.push({
        player_id: e.player_id,
        role: e.player.role,
        my: { name: e.player.name, role: e.player.role, mult, eff: e.effective, basePoints: e.fantasyPoints },
        their: null,
        isCaptaincyEdge: false,
        isMyOnly: true,
        isTheirOnly: false,
      })
    }
  }

  // theirEdge: their-only OR shared-with-their-higher-mult
  for (const e of h2h.theirEdge) {
    if (e.isMultEdge) {
      const myMult = e.myIsC ? 2 : e.myIsVC ? 1.5 : 1
      const theirMult = e.isC ? 2 : e.isVC ? 1.5 : 1
      rows.push({
        player_id: e.player_id,
        role: e.player.role,
        my: { name: e.player.name, role: e.player.role, mult: myMult, eff: round2(e.fantasyPoints * myMult), basePoints: e.fantasyPoints },
        their: { name: e.player.name, role: e.player.role, mult: theirMult, eff: round2(e.fantasyPoints * theirMult), basePoints: e.fantasyPoints },
        isCaptaincyEdge: true,
        isMyOnly: false,
        isTheirOnly: false,
      })
    } else {
      const mult = e.isC ? 2 : e.isVC ? 1.5 : 1
      rows.push({
        player_id: e.player_id,
        role: e.player.role,
        my: null,
        their: { name: e.player.name, role: e.player.role, mult, eff: e.effective, basePoints: e.fantasyPoints },
        isCaptaincyEdge: false,
        isMyOnly: false,
        isTheirOnly: true,
      })
    }
  }

  // 3-tier sort: edge differentials → uncommon (one-side-only) → common.
  // Within each tier, descending by max effective so the most impactful
  // row in the tier sits at the top.
  rows.sort((a, b) => {
    const ta = tier(a)
    const tb = tier(b)
    if (ta !== tb) return ta - tb
    const maxA = Math.max(a.my?.eff ?? -Infinity, a.their?.eff ?? -Infinity)
    const maxB = Math.max(b.my?.eff ?? -Infinity, b.their?.eff ?? -Infinity)
    return maxB - maxA
  })

  return rows
}

// Tier 0: My Edge — my-only picks AND captaincy edges where I have the
//                    higher multiplier (i.e. my side wins the duel).
// Tier 1: Their Edge — symmetric on the other side.
// Tier 2: Common — shared with equal multipliers.
function tier(r: RosterRow): number {
  if (r.isMyOnly) return 0
  if (r.isTheirOnly) return 1
  if (r.isCaptaincyEdge) {
    return (r.my?.mult ?? 0) > (r.their?.mult ?? 0) ? 0 : 1
  }
  return 2
}

const TIER_LABEL: Record<number, string> = {
  0: "My Edge",
  1: "Their Edge",
  2: "Common Players",
}

function RosterTable({
  rows, myTotal, theirTotal,
}: { rows: RosterRow[]; myTotal: number; theirTotal: number }) {
  if (rows.length === 0) return null

  // Group rows by tier so we can render section labels between tiers.
  const grouped: Array<{ tier: number; rows: RosterRow[] }> = []
  let current: { tier: number; rows: RosterRow[] } | null = null
  for (const r of rows) {
    const t = tier(r)
    if (!current || current.tier !== t) {
      current = { tier: t, rows: [] }
      grouped.push(current)
    }
    current.rows.push(r)
  }

  return (
    <div className="rounded-xl border border-overlay-border overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-2 bg-overlay-subtle border-b border-overlay-border">
        <HeaderCell label="ME" total={myTotal} align="left" />
        <HeaderCell label="THEM" total={theirTotal} align="right" />
      </div>

      <div>
        {grouped.map((group, idx) => (
          <div key={group.tier} className={cn(idx > 0 && "border-t border-overlay-border")}>
            <div className="px-3 py-1.5 bg-overlay-subtle/40 border-b border-overlay-border">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {TIER_LABEL[group.tier]}
              </span>
              <span className="text-[10px] text-muted-foreground/60 ml-1.5 tabular-nums">
                {group.rows.length}
              </span>
            </div>
            <div className="divide-y divide-overlay-border">
              {group.rows.map((row) => (
                <Row key={row.player_id} row={row} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeaderCell({ label, total, align }: { label: string; total: number; align: "left" | "right" }) {
  return (
    <div className={cn(
      "flex items-baseline gap-2 px-3 py-2",
      align === "right" && "flex-row-reverse text-right",
    )}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-display font-bold tabular-nums">{total}</span>
    </div>
  )
}

function Row({ row }: { row: RosterRow }) {
  const rowTint =
    row.isCaptaincyEdge ? "bg-amber-500/5" :
    null

  return (
    <div className={cn("grid grid-cols-2", rowTint)}>
      <Cell
        cell={row.my}
        side="left"
        edgeTint={row.isMyOnly ? "bg-emerald-500/5" : null}
      />
      <Cell
        cell={row.their}
        side="right"
        edgeTint={row.isTheirOnly ? "bg-red-500/5" : null}
      />
    </div>
  )
}

function Cell({ cell, side, edgeTint }: {
  cell: RosterCell | null
  side: "left" | "right"
  edgeTint: string | null
}) {
  const borderClass = side === "left" ? "border-r border-overlay-border" : null

  if (!cell) {
    return (
      <div className={cn(
        "flex items-center justify-center px-2 py-2 text-muted-foreground/30 text-xs min-h-[36px]",
        borderClass,
        edgeTint,
      )}>
        —
      </div>
    )
  }

  const captainChip = cell.mult === 2 ? "C" : cell.mult === 1.5 ? "VC" : null

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1.5 min-w-0 min-h-[36px]",
      borderClass,
      edgeTint,
    )}>
      <Badge variant="outline" className={cn(
        "text-[8px] px-1 py-0 h-[14px] border leading-none shrink-0",
        ROLE_COLORS[cell.role],
      )}>
        {cell.role}
      </Badge>
      <span className="text-[11px] font-medium truncate flex-1 leading-tight">
        {cell.name}
      </span>
      {captainChip && (
        <Badge variant="outline" className="shrink-0 text-[8px] px-1 py-0 h-[14px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
          {captainChip}
        </Badge>
      )}
      <span className="text-[11px] font-bold font-display tabular-nums shrink-0">
        {cell.eff}
      </span>
    </div>
  )
}

// ─── Util ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

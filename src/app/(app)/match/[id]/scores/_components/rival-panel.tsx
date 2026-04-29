"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import {
  buildCaptainDuel,
  buildHeadToHead,
  computePointsInPlay,
  computeXiOverlap,
  generateInsight,
  type EdgeEntry,
  type SharedEntry,
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
  me: { display_name: string; total_points: number } | null
  rival: Rival | null
  mySelection: Selection | null
  rivalSelection: Selection | null
  psMap: Map<string, PlayerScore>
  rosterMap: Map<string, PlayerLite>
  matchStatus: string
}

export function RivalPanel({
  me, rival, mySelection, rivalSelection, psMap, rosterMap, matchStatus,
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
    return { h2h, captainDuel, insight }
  }, [me, rival, mySelection, rivalSelection, psMap, rosterMap, matchStatus])

  if (!data || !me || !rival) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No comparison available — opponent has no team selected yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col px-4 pt-3 pb-5 gap-4 bg-overlay-subtle/40">
      <div className="flex items-center justify-between gap-3">
        <Side name={me.display_name} points={me.total_points} align="left" isMe />
        <SignedDelta delta={me.total_points - rival.total_points} />
        <Side name={rival.display_name} points={rival.total_points} align="right" />
      </div>

      <CaptainDuelBlock
        myCaptain={data.captainDuel.myCaptain}
        theirCaptain={data.captainDuel.theirCaptain}
        myVC={data.captainDuel.myVC}
        theirVC={data.captainDuel.theirVC}
        captainDelta={data.captainDuel.captainDelta}
        vcDelta={data.captainDuel.vcDelta}
      />

      {data.insight && (
        <div className="rounded-lg border border-overlay-border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Insight</p>
          <p className="text-xs text-foreground/90">{data.insight}</p>
        </div>
      )}

      <EdgeRoster
        myEdge={data.h2h.myEdge}
        theirEdge={data.h2h.theirEdge}
        shared={data.h2h.shared}
      />
    </div>
  )
}

// ─── Header pieces ───────────────────────────────────────────────────────

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
    <div className="rounded-xl border border-overlay-border overflow-hidden bg-background">
      <CaptainRow label="C" mult="2×" my={myCaptain} their={theirCaptain} delta={captainDelta} />
      {(myVC || theirVC) && (
        <>
          <div className="h-px bg-overlay-border" />
          <CaptainRow label="VC" mult="1.5×" my={myVC} their={theirVC} delta={vcDelta} />
        </>
      )}
    </div>
  )
}

function CaptainRow({
  label, mult, my, their, delta,
}: { label: string; mult: string; my: CaptainSlot; their: CaptainSlot; delta: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5">
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

// ─── Edge Roster ─────────────────────────────────────────────────────────

function EdgeRoster({
  myEdge,
  theirEdge,
  shared,
}: {
  myEdge: EdgeEntry[]
  theirEdge: EdgeEntry[]
  shared: SharedEntry[]
}) {
  const myTotal = Math.round(myEdge.reduce((sum, e) => sum + e.effective, 0) * 10) / 10
  const theirTotal = Math.round(theirEdge.reduce((sum, e) => sum + e.effective, 0) * 10) / 10

  return (
    <div className="flex flex-col gap-2">
      {myEdge.length > 0 && (
        <EdgeSection title="EDGE" icon="▲" count={myEdge.length} netPoints={myTotal} tone="green">
          {myEdge.map((e) => (
            <PlayerEdgeRow
              key={e.player_id}
              name={e.player.name}
              role={e.player.role}
              isC={e.isC}
              isVC={e.isVC}
              effectivePts={e.effective}
              tone="green"
            />
          ))}
        </EdgeSection>
      )}

      {theirEdge.length > 0 && (
        <EdgeSection title="NEGATIVE EDGE" icon="▼" count={theirEdge.length} netPoints={theirTotal} tone="red">
          {theirEdge.map((e) => (
            <PlayerEdgeRow
              key={e.player_id}
              name={e.player.name}
              role={e.player.role}
              isC={e.isC}
              isVC={e.isVC}
              effectivePts={e.effective}
              tone="red"
            />
          ))}
        </EdgeSection>
      )}

      {shared.length > 0 && (
        <EdgeSection
          title="SAME PICKS"
          icon="="
          count={shared.length}
          netPoints={null}
          tone="neutral"
          collapsible
          defaultCollapsed
        >
          {shared.map((e) => (
            <PlayerEdgeRow
              key={e.player_id}
              name={e.player.name}
              role={e.player.role}
              isC={e.myMult === 2}
              isVC={e.myMult === 1.5}
              effectivePts={e.myEff}
              tone="neutral"
            />
          ))}
        </EdgeSection>
      )}
    </div>
  )
}

function EdgeSection({
  title,
  icon,
  count,
  netPoints,
  tone,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: {
  title: string
  icon: string
  count: number
  netPoints: number | null
  tone: "green" | "red" | "neutral"
  collapsible?: boolean
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const headerTone = {
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-rose-600 dark:text-rose-400",
    neutral: "text-muted-foreground",
  }[tone]

  const headerBg = {
    green: "bg-emerald-500/10",
    red: "bg-rose-500/10",
    neutral: "bg-overlay-subtle/40",
  }[tone]

  const inner = (
    <>
      <span className={cn("text-[10px] font-bold mr-1", headerTone)}>{icon}</span>
      <span className={cn("text-[10px] font-semibold uppercase tracking-widest", headerTone)}>
        {title}
      </span>
      <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1.5">{count}</span>
      {netPoints !== null && (
        <>
          <span className="text-[10px] text-muted-foreground/40 mx-1.5">·</span>
          <span className={cn("text-[11px] font-bold font-display tabular-nums", headerTone)}>
            {tone === "green" && netPoints > 0 ? `+${netPoints}` : netPoints}
          </span>
          <span className={cn("text-[10px] ml-0.5", headerTone)}>pts</span>
        </>
      )}
    </>
  )

  return (
    <div className="rounded-xl border border-overlay-border overflow-hidden bg-background">
      {collapsible ? (
        <button
          type="button"
          className={cn("w-full flex items-center px-3 py-2 text-left", headerBg)}
          onClick={() => setCollapsed((c) => !c)}
        >
          {inner}
          <ChevronRight className={cn(
            "ml-auto h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
            !collapsed && "rotate-90",
          )} />
        </button>
      ) : (
        <div className={cn("flex items-center px-3 py-2", headerBg)}>
          {inner}
        </div>
      )}
      {!collapsed && (
        <div className="divide-y divide-overlay-border">
          {children}
        </div>
      )}
    </div>
  )
}

function PlayerEdgeRow({
  name,
  role,
  isC,
  isVC,
  effectivePts,
  tone,
}: {
  name: string
  role: string
  isC: boolean
  isVC: boolean
  effectivePts: number
  tone: "green" | "red" | "neutral"
}) {
  const rowBg = {
    green: "bg-emerald-500/5",
    red: "bg-rose-500/5",
    neutral: "",
  }[tone]

  const ptsTone = {
    green: "text-[var(--tw-emerald-text)]",
    red: "text-[var(--tw-red-text)]",
    neutral: "text-muted-foreground",
  }[tone]

  const captainChip = isC ? "C" : isVC ? "VC" : null
  const captainChipClass = isC
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2.5 min-h-[44px]", rowBg)}>
      <Badge variant="outline" className={cn(
        "text-[8px] px-1 py-0 h-[14px] border leading-none shrink-0",
        ROLE_COLORS[role],
      )}>
        {role}
      </Badge>
      <span className="text-[13px] font-medium truncate flex-1 leading-tight">
        {name}
      </span>
      {captainChip && (
        <Badge variant="outline" className={cn(
          "shrink-0 text-[8px] px-1 py-0 h-[14px]",
          captainChipClass,
        )}>
          {captainChip}
        </Badge>
      )}
      <span className={cn("text-sm font-bold font-display tabular-nums shrink-0", ptsTone)}>
        {effectivePts}
      </span>
    </div>
  )
}

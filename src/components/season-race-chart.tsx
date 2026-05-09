"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { RaceChart, type RaceMarker, type RaceSnapshot } from "@/components/race-chart"

type Mode = "rank" | "points"

type Props = {
  userIds: string[]
  userNames: Record<string, string>
  currentUserId: string
  leaderUserId: string
  snapshots: RaceSnapshot[]
  winners: RaceMarker[]
}

export function SeasonRaceChart({
  userIds,
  userNames,
  currentUserId,
  leaderUserId,
  snapshots,
  winners,
}: Props) {
  const [mode, setMode] = useState<Mode>("rank")

  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-overlay-border bg-overlay-subtle gap-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Season Race
        </span>
        <div className="flex items-center gap-1 rounded-full bg-overlay-muted/40 p-0.5">
          <ToggleChip active={mode === "rank"} onClick={() => setMode("rank")}>Rank</ToggleChip>
          <ToggleChip active={mode === "points"} onClick={() => setMode("points")}>Points</ToggleChip>
        </div>
      </div>

      <div className="px-4 py-3">
        <RaceChart
          userIds={userIds}
          userNames={userNames}
          currentUserId={currentUserId}
          leaderUserId={leaderUserId}
          snapshots={snapshots}
          markers={winners}
          mode={mode}
          emphasis="leader-and-me"
          xLabel="Match"
          xFormatter={(n) => `M${n}`}
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <LegendDot color="var(--captain-gold, #d4a017)" label="League leader" />
          <LegendDot color="var(--primary, #6366f1)" label="You" />
          <LegendDot mutedDot label="Other members" />
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full ring-1 ring-background"
              style={{ background: "var(--captain-gold, #d4a017)" }}
            />
            <span>Match winner</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function ToggleChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function LegendDot({ color, mutedDot, label }: { color?: string; mutedDot?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", mutedDot && "bg-overlay-border")}
        style={mutedDot ? undefined : { background: color }}
      />
      <span>{label}</span>
    </span>
  )
}

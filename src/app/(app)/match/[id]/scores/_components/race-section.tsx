"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { RaceChart } from "@/components/race-chart"

type Snapshot = { over_number: number; scores: Record<string, number> }
type Mode = "rank" | "points"

type Props = {
  userIds: string[]
  snapshots: Snapshot[]
  userNames: Record<string, string>
  currentUserId: string
}

const STORAGE_KEY = "tipl:race-open"

export function RaceSection({
  userIds, snapshots, userNames, currentUserId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("rank")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY)
      if (v === "1") setOpen(true)
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0") } catch { /* ignore */ }
  }, [open, hydrated])

  const overCount = new Set(snapshots.map((s) => s.over_number)).size
  const enoughData = overCount >= 2
  const userCount = userIds.length

  const raceSnapshots = useMemo(
    () => snapshots.map((s) => ({ stepNumber: s.over_number, scores: s.scores })),
    [snapshots],
  )

  return (
    <div className="border-b border-overlay-border bg-background">
      <button
        type="button"
        onClick={() => enoughData && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!enoughData}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors",
          enoughData ? "hover:bg-overlay-subtle active:bg-overlay-muted" : "opacity-60 cursor-default",
        )}
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
        <span className="text-[13px] font-semibold tracking-wide">Race over time</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {enoughData
            ? `${overCount} overs · ${userCount} ${userCount === 1 ? "user" : "users"}`
            : "Race begins after over 1"}
        </span>
      </button>

      {open && enoughData && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-center gap-1 mb-3 rounded-full bg-overlay-subtle p-0.5 w-fit">
            <ToggleChip active={mode === "rank"} onClick={() => setMode("rank")}>
              Rank
            </ToggleChip>
            <ToggleChip active={mode === "points"} onClick={() => setMode("points")}>
              Points
            </ToggleChip>
          </div>
          <RaceChart
            userIds={userIds}
            snapshots={raceSnapshots}
            userNames={userNames}
            currentUserId={currentUserId}
            mode={mode}
          />
        </div>
      )}
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

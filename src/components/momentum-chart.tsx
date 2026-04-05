"use client"

import { LineChart } from "@/components/charts/line-chart"
import { getAvatarColor } from "@/lib/avatar"

type Snapshot = {
  over_number: number
  scores: Record<string, number>
}

type Props = {
  snapshots: Snapshot[]
  userNames: Record<string, string> // userId → display name
  currentUserId: string
}

const CHART_COLORS = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#10b981", // emerald
  "#a855f7", // purple
  "#ef4444", // red
  "#eab308", // yellow
  "#ec4899", // pink
  "#06b6d4", // cyan
]

export function MomentumChart({ snapshots, userNames, currentUserId }: Props) {
  if (snapshots.length < 2) return null

  const sorted = [...snapshots].sort((a, b) => a.over_number - b.over_number)
  const userIds = Object.keys(sorted[0].scores)

  // Sort: current user first, then by latest score descending
  const lastSnap = sorted[sorted.length - 1].scores
  const sortedUserIds = [...userIds].sort((a, b) => {
    if (a === currentUserId) return -1
    if (b === currentUserId) return 1
    return (lastSnap[b] ?? 0) - (lastSnap[a] ?? 0)
  })

  const series = sortedUserIds.map((uid, i) => ({
    label: userNames[uid] ?? "?",
    values: sorted.map((s) => s.scores[uid] ?? 0),
    color: uid === currentUserId ? "#f97316" : CHART_COLORS[(i + 1) % CHART_COLORS.length],
  }))

  const xLabels = sorted.map((s) => `${s.over_number}`)

  return (
    <div className="rounded-lg border border-overlay-border bg-[hsl(var(--background))] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Fantasy Momentum</span>
      </div>
      <LineChart
        series={series}
        xLabels={xLabels}
        height={180}
        showDots={false}
        showArea={false}
        className="w-full"
      />
    </div>
  )
}

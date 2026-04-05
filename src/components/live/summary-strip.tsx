"use client"

import { cn } from "@/lib/utils"

type Props = {
  activeTab: string
  leaderName: string | null
  leaderPoints: number
  edgeCount: number
  threatCount: number
}

export function SummaryStrip({ activeTab, leaderName, leaderPoints, edgeCount, threatCount }: Props) {
  const items = [
    { key: "board", label: leaderName ? `#1 ${leaderName} ${leaderPoints}` : "No scores" },
    { key: "compare", label: `${edgeCount} edge · ${threatCount} threat` },
  ]

  // Only show summaries for non-active tabs
  const visible = items.filter((i) => i.key !== activeTab)
  if (visible.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-white/[0.02] border-b border-white/[0.06] overflow-x-auto">
      {visible.map((item) => (
        <span key={item.key} className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
          <span className="font-semibold text-muted-foreground">{item.key === "board" ? "Board" : "Compare"}:</span>{" "}
          {item.label}
        </span>
      ))}
    </div>
  )
}

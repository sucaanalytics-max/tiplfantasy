"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type InsightsTab = "standings" | "captain" | "season" | "differential"

const TABS: { id: InsightsTab; label: string }[] = [
  { id: "standings", label: "Standings" },
  { id: "captain", label: "Captain" },
  { id: "season", label: "Season" },
  { id: "differential", label: "Differential" },
]

interface Props {
  currentTab: InsightsTab
  leagueId: string
}

export function InsightsTabs({ currentTab, leagueId }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function switchTab(tab: InsightsTab) {
    const params = new URLSearchParams()
    params.set("league", leagueId)
    if (tab !== "standings") params.set("tab", tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 p-1 rounded-xl glass overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => switchTab(t.id)}
          className={cn(
            "flex-1 min-w-[72px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
            t.id === currentTab
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-overlay-subtle"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

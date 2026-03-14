/** Shared badge color mappings for roles and match statuses */

import type { PlayerRole } from "./types"

export const ROLE_COLORS: Record<PlayerRole, string> = {
  WK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  BAT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  AR: "bg-green-500/10 text-green-400 border-green-500/20",
  BOWL: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

export const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "WK",
  BAT: "BAT",
  AR: "AR",
  BOWL: "BOWL",
}

export const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  upcoming: { label: "Upcoming", class: "bg-primary/10 text-primary" },
  live: { label: "Live", class: "bg-red-500/15 text-red-400 animate-pulse" },
  completed: { label: "Completed", class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  no_result: { label: "No Result", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  abandoned: { label: "Abandoned", class: "bg-red-500/10 text-red-400 border-red-500/20" },
}

export const CAPTAIN_BADGE = "bg-amber-500/20 text-amber-500 border-amber-500/30"
export const VICE_CAPTAIN_BADGE = "bg-violet-500/20 text-violet-400 border-violet-500/30"

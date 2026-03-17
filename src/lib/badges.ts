/** Shared badge color mappings for roles and match statuses */

import type { PlayerRole } from "./types"

export const ROLE_COLORS: Record<PlayerRole, string> = {
  WK: "bg-role-wk/10 text-role-wk border-role-wk/20",
  BAT: "bg-role-bat/10 text-role-bat border-role-bat/20",
  AR: "bg-role-ar/10 text-role-ar border-role-ar/20",
  BOWL: "bg-role-bowl/10 text-role-bowl border-role-bowl/20",
}

export const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "WK",
  BAT: "BAT",
  AR: "AR",
  BOWL: "BOWL",
}

export type StatusVariant = "outline" | "live" | "completed" | "danger"

export const STATUS_CONFIG: Record<string, { label: string; variant: StatusVariant }> = {
  upcoming: { label: "Upcoming", variant: "outline" },
  live: { label: "Live", variant: "live" },
  completed: { label: "Completed", variant: "completed" },
  no_result: { label: "No Result", variant: "danger" },
  abandoned: { label: "Abandoned", variant: "danger" },
}

export const CAPTAIN_BADGE = "bg-status-warning-bg text-status-warning border-status-warning/30"
export const VICE_CAPTAIN_BADGE = "bg-status-completed-bg text-status-completed border-status-completed/30"

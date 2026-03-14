/** Shared avatar utilities — initials + deterministic colors */

export const AVATAR_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-orange-500",
]

/** Hex colors for use in inline styles (e.g. SVG, canvas) */
export const AVATAR_HEX_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#f43f5e", "#06b6d4", "#6366f1", "#f97316",
]

export function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function getAvatarHexColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_HEX_COLORS[Math.abs(hash) % AVATAR_HEX_COLORS.length]
}

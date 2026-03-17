import Image from "next/image"

type TeamBadgeSize = "sm" | "md" | "lg"

const sizeClasses: Record<TeamBadgeSize, string> = {
  sm: "h-7 w-7 text-[9px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
}

/** Returns true if the color is light enough to need dark text */
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "")
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  // Relative luminance (simplified)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

export function TeamBadge({
  shortName,
  color,
  logoUrl,
  size = "md",
}: {
  shortName: string
  color: string
  logoUrl?: string | null
  size?: TeamBadgeSize
}) {
  const textColor = isLightColor(color) ? "text-gray-900" : "text-white"

  return (
    <div
      className={`${sizeClasses[size]} relative flex items-center justify-center rounded-full font-bold font-display shrink-0 ring-1 ring-white/10 transition-transform hover:scale-105`}
      style={{ backgroundColor: color }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={shortName}
          fill
          className="rounded-full object-cover"
        />
      ) : (
        <span className={textColor}>{shortName}</span>
      )}
    </div>
  )
}

export function VsBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold font-display h-6 w-6 ring-1 ring-primary/20 ${className}`}
    >
      VS
    </span>
  )
}

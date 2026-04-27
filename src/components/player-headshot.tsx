import Image from "next/image"
import { cn } from "@/lib/utils"
import type { PlayerWithTeam, Player, Team } from "@/lib/types"

const SIZE = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
  hero: 128,
} as const

const RING_BY_ROLE: Record<string, string> = {
  WK: "ring-role-wk",
  BAT: "ring-role-bat",
  AR: "ring-role-ar",
  BOWL: "ring-role-bowl",
}

type Size = keyof typeof SIZE
type Ring = "team" | "role" | "captain" | "vice" | "none"

type Props = {
  player: PlayerWithTeam | (Player & { team: Pick<Team, "color" | "short_name"> })
  size?: Size
  ring?: Ring
  shadow?: boolean
  className?: string
  priority?: boolean
}

export function PlayerHeadshot({
  player,
  size = "md",
  ring = "none",
  shadow = false,
  className,
  priority = false,
}: Props) {
  const px = SIZE[size]
  const ringCls =
    ring === "team"
      ? "ring-team"
      : ring === "role"
      ? RING_BY_ROLE[player.role] ?? ""
      : ring === "captain"
      ? "ring-captain"
      : ring === "vice"
      ? "ring-vice"
      : ""

  const shadowCls = shadow ? (size === "hero" || size === "xl" ? "shadow-headshot-lg" : "shadow-headshot") : ""

  const initials = player.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")

  const teamColor = player.team.color
  const wrapperStyle = ring === "team" ? ({ "--team-color": teamColor } as React.CSSProperties) : undefined

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        ringCls,
        shadowCls,
        className
      )}
      style={{ width: px, height: px, ...wrapperStyle }}
    >
      {player.image_url ? (
        <Image
          src={player.image_url}
          alt={player.name}
          width={px}
          height={px}
          sizes={`${px}px`}
          priority={priority}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="font-display font-bold tabular-nums select-none"
          style={{
            color: teamColor,
            backgroundColor: `${teamColor}1f`,
            width: "100%",
            height: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(px * 0.36),
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      )}
    </span>
  )
}

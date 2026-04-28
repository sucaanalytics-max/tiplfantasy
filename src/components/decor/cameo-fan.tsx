import { PlayerHeadshot, type HeadshotPlayer } from "@/components/player-headshot"
import { cn } from "@/lib/utils"

type Props = {
  /** 1–3 players to compose into the fan. Order: front, mid, back. */
  players: HeadshotPlayer[]
  /** Side determines tilt direction (home leans right, away leans left). */
  side: "home" | "away"
  className?: string
}

/**
 * Cinematic 3-headshot fan composition. Substitutes for team / crowd
 * photography on the dashboard hero (no such assets exist in the
 * codebase). Reuses Sportmonks player headshots with z-stacked overlap,
 * slight rotation per index, and a soft elliptical fade on the trailing
 * edge so the fan reads as one composed shape rather than three discs.
 *
 * Mounted inside <CinematicHero/>. Mobile shrinks to 2 chips; desktop
 * shows 3.
 */
export function CameoFan({ players, side, className }: Props) {
  if (players.length === 0) return null

  const tilt = side === "home" ? 1 : -1
  // Show up to 3 on desktop, up to 2 on small screens
  const visible = players.slice(0, 3)

  return (
    <div
      className={cn(
        "relative inline-flex items-end pointer-events-none select-none",
        side === "home" ? "flex-row" : "flex-row-reverse",
        className
      )}
      style={{
        // Soft elliptical fade-out at the trailing edge — keeps the fan
        // anchored visually rather than floating as 3 disks.
        WebkitMaskImage: side === "home"
          ? "radial-gradient(ellipse 100% 95% at 25% 60%, oklch(0 0 0) 60%, transparent 100%)"
          : "radial-gradient(ellipse 100% 95% at 75% 60%, oklch(0 0 0) 60%, transparent 100%)",
        maskImage: side === "home"
          ? "radial-gradient(ellipse 100% 95% at 25% 60%, oklch(0 0 0) 60%, transparent 100%)"
          : "radial-gradient(ellipse 100% 95% at 75% 60%, oklch(0 0 0) 60%, transparent 100%)",
      }}
    >
      {visible.map((player, i) => {
        // Index 0 is the largest / frontmost. Each subsequent player tucks
        // behind, smaller, more rotated, lower opacity.
        const isFront = i === 0
        const sizePx = i === 0 ? 96 : i === 1 ? 80 : 64
        const rotateDeg = (i === 0 ? 0 : i === 1 ? 6 : 12) * tilt
        const offsetX = side === "home" ? -18 * i : 18 * i
        const offsetY = i * 6
        const opacity = i === 0 ? 1 : i === 1 ? 0.85 : 0.55
        return (
          <div
            key={player.image_url ?? `${player.name}-${i}`}
            className={cn(
              i > 0 && "hidden md:inline-block", // mobile shows just the front headshot
              "transition-transform"
            )}
            style={{
              transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotateDeg}deg)`,
              zIndex: visible.length - i,
              opacity,
              animation: `team-art-zoom 800ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms backwards`,
            }}
          >
            <PlayerHeadshot
              player={player}
              size={isFront ? "xl" : i === 1 ? "lg" : "md"}
              ring="team"
              shadow
            />
            {/* Front headshot only: explicit width/height to anchor the size */}
            {isFront && (
              <span aria-hidden style={{ display: "inline-block", width: sizePx, height: sizePx }} className="absolute inset-0 -z-10" />
            )}
          </div>
        )
      })}
    </div>
  )
}

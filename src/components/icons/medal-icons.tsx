import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

/**
 * Medal / trophy / streak / MVP icons. All inline SVG using currentColor
 * so they tint via Tailwind text-* utilities and adapt to light/dark.
 *
 * Use these for:
 *   - Awards section on /leaderboard ("Highest score", "Most wins", etc.)
 *   - Achievements grid on /profile (milestones earned)
 *   - Standings top-3 (MedalGold for #1 instead of plain Crown if desired)
 *   - Match recap "MVP" callout
 */

export function TrophyOutline({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Cup body */}
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3z" />
      {/* Handles */}
      <path d="M7 5H4a3 3 0 0 0 3 5" />
      <path d="M17 5h3a3 3 0 0 1-3 5" />
      {/* Stem & base */}
      <path d="M12 14v3" />
      <path d="M9 20h6" />
      <path d="M9 17h6" />
    </svg>
  )
}

export function MedalGold({ className, ...props }: IconProps) {
  return <Medal className={className} {...props} ribbonColor="#facc15" discColor="#fbbf24" rimColor="#a16207" />
}

export function MedalSilver({ className, ...props }: IconProps) {
  return <Medal className={className} {...props} ribbonColor="#cbd5e1" discColor="#e5e7eb" rimColor="#94a3b8" />
}

export function MedalBronze({ className, ...props }: IconProps) {
  return <Medal className={className} {...props} ribbonColor="#c2410c" discColor="#ea580c" rimColor="#7c2d12" />
}

function Medal({
  className,
  ribbonColor,
  discColor,
  rimColor,
  ...props
}: IconProps & { ribbonColor: string; discColor: string; rimColor: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Ribbon */}
      <path d="M7 2l3 8" stroke={ribbonColor} strokeWidth="2" strokeLinecap="round" />
      <path d="M17 2l-3 8" stroke={ribbonColor} strokeWidth="2" strokeLinecap="round" />
      {/* Disc */}
      <circle cx="12" cy="15" r="6" fill={discColor} stroke={rimColor} strokeWidth="1.2" />
      {/* Highlight */}
      <circle cx="10" cy="13" r="1.5" fill="white" fillOpacity="0.4" />
      {/* Inner star */}
      <path
        d="M12 11.5l1.05 2.13 2.35.34-1.7 1.66.4 2.34L12 16.86 9.9 17.97l.4-2.34-1.7-1.66 2.35-.34L12 11.5z"
        fill={rimColor}
        fillOpacity="0.5"
      />
    </svg>
  )
}

export function FlameStreak({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Outer flame */}
      <path
        d="M12 2c0 4-4 5-4 9a4 4 0 0 0 8 0c0-2-2-3-2-5 0 2 2 3 2 6a6 6 0 0 1-12 0c0-5 4-7 4-10 0 2 2 3 4 0z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      {/* Inner flame */}
      <path
        d="M12 9c0 2-2 3-2 5a2 2 0 0 0 4 0c0-1.5-1.5-2-2-5z"
        fill="white"
        fillOpacity="0.5"
      />
    </svg>
  )
}

export function MvpStar({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Outer star */}
      <path d="M12 1.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 15l-5.25 2.66 1-5.86L3.5 7.66l5.9-.86L12 1.5z" />
      {/* Inner highlight */}
      <path
        d="M12 5.2l1.5 3 3.4.5-2.45 2.4.58 3.4L12 12.86l-3.03 1.64.58-3.4L7.1 8.7l3.4-.5L12 5.2z"
        fill="white"
        fillOpacity="0.25"
      />
    </svg>
  )
}

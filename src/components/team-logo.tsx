"use client"

import Image from "next/image"
import { useState } from "react"
import type { Team } from "@/lib/types"

const SIZES = {
  sm: 24,
  md: 40,
  lg: 64,
  xl: 96,
} as const

export function TeamLogo({
  team,
  size = "md",
  className = "",
}: {
  team: Pick<Team, "short_name" | "color"> & { name?: string | null }
  size?: keyof typeof SIZES
  className?: string
}) {
  const [imgError, setImgError] = useState(false)
  const px = SIZES[size]
  const slug = team.short_name.toLowerCase()
  const label = team.name ?? team.short_name

  if (imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold font-display shrink-0 ${className}`}
        style={{
          width: px,
          height: px,
          backgroundColor: team.color + "22",
          border: `2px solid ${team.color}66`,
          color: team.color,
          fontSize: px * 0.32,
        }}
        title={label}
      >
        {team.short_name.slice(0, 2).toUpperCase()}
      </span>
    )
  }

  return (
    <Image
      src={`/icons/teams/${slug}.png`}
      alt={label}
      width={px}
      height={px}
      className={`object-contain shrink-0 ${className}`}
      style={{ width: px, height: px }}
      onError={() => setImgError(true)}
      title={label}
    />
  )
}

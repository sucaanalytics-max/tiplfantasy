"use client"

import type { MomentumPoint } from "@/lib/rivalry"

type Props = {
  series: MomentumPoint[] | null
  width?: number
  height?: number
  color?: string
  className?: string
}

/**
 * Tiny SVG sparkline. Draws the points-over-time series with min-max
 * normalisation so each row's curve fills the available height.
 *
 * Returns a placeholder muted line if there's no data so the column
 * still occupies its grid cell and the table doesn't reflow.
 */
export function MomentumSparkline({
  series,
  width = 56,
  height = 18,
  color,
  className,
}: Props) {
  if (!series || series.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden="true">
        <line
          x1={0} y1={height / 2}
          x2={width} y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
          className="text-muted-foreground/20"
        />
      </svg>
    )
  }

  const points = series.map((p) => p.points)
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const stepX = series.length > 1 ? width / (series.length - 1) : 0
  const path = series.map((p, i) => {
    const x = i * stepX
    const y = height - ((p.points - min) / range) * height
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")

  // Direction tint: last point higher than first → green-ish, lower → red-ish, equal → neutral
  const last = points[points.length - 1]
  const first = points[0]
  const stroke = color ?? (
    last > first ? "var(--tw-emerald-text, #10b981)" :
    last < first ? "var(--tw-red-text, #ef4444)" :
    "currentColor"
  )

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

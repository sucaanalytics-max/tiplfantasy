'use client'

import { cn } from '@/lib/utils'

type Segment = { label: string; value: number; color: string }

type DonutChartProps = {
  segments: Segment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}

export function DonutChart({
  segments,
  size = 120,
  strokeWidth = 12,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  let accumulated = 0
  const circles = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const fraction = total > 0 ? segment.value / total : 0
      const dashLength = fraction * circumference
      const dashOffset = -(accumulated * circumference) + circumference * 0.25
      accumulated += fraction

      return {
        ...segment,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset,
      }
    })

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="shrink-0"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />

        {circles.map((c, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={c.color}
            strokeWidth={strokeWidth}
            strokeDasharray={c.dashArray}
            strokeDashoffset={c.dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        ))}

        {/* Center text */}
        {(centerValue || centerLabel) && (
          <>
            {centerValue && (
              <text
                x={size / 2}
                y={centerLabel ? size / 2 - 4 : size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground font-display text-lg font-bold"
                fontSize={size * 0.18}
              >
                {centerValue}
              </text>
            )}
            {centerLabel && (
              <text
                x={size / 2}
                y={centerValue ? size / 2 + 12 : size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-muted-foreground"
                fontSize={size * 0.09}
              >
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-display font-medium text-foreground">
                {s.value}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

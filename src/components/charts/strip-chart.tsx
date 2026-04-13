'use client'

import { cn } from '@/lib/utils'

type StripChartProps = {
  scores: number[]
  mean?: number
  median?: number
  color?: string
  width?: number
  height?: number
  className?: string
  labels?: string[] // optional label per dot (e.g. "vs CSK")
}

export function StripChart({
  scores,
  mean,
  median,
  color = '#3b82f6',
  width = 220,
  height = 36,
  className,
  labels,
}: StripChartProps) {
  if (scores.length === 0) return null

  const padding = { left: 4, right: 4, top: 6, bottom: 6 }
  const chartW = width - padding.left - padding.right
  const cy = height / 2

  const min = Math.min(...scores, 0)
  const max = Math.max(...scores, 100)
  const range = max - min || 1

  function toX(value: number): number {
    return padding.left + ((value - min) / range) * chartW
  }

  return (
    <div className={cn('inline-flex items-center', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        {/* Baseline */}
        <line
          x1={padding.left}
          y1={cy}
          x2={width - padding.right}
          y2={cy}
          stroke="hsl(var(--muted))"
          strokeWidth={1}
        />

        {/* Zero marker if range includes negative */}
        {min < 0 && (
          <line
            x1={toX(0)}
            y1={cy - 6}
            x2={toX(0)}
            y2={cy + 6}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
        )}

        {/* Mean line */}
        {mean != null && (
          <line
            x1={toX(mean)}
            y1={cy - 10}
            x2={toX(mean)}
            y2={cy + 10}
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.6}
          />
        )}

        {/* Median line */}
        {median != null && (
          <line
            x1={toX(median)}
            y1={cy - 8}
            x2={toX(median)}
            y2={cy + 8}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 2"
            strokeOpacity={0.4}
          />
        )}

        {/* Score dots */}
        {scores.map((s, i) => (
          <circle
            key={i}
            cx={toX(s)}
            cy={cy}
            r={4}
            fill={color}
            fillOpacity={0.7}
            stroke="hsl(var(--background))"
            strokeWidth={1}
          >
            {labels?.[i] && <title>{labels[i]}: {s}</title>}
            {!labels?.[i] && <title>{s}</title>}
          </circle>
        ))}
      </svg>
    </div>
  )
}

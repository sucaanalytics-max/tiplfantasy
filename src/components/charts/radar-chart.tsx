'use client'

import { cn } from '@/lib/utils'

type RadarAxis = { label: string; max: number }

type RadarSeries = {
  label: string
  values: number[] // one per axis, raw (not normalized)
  color: string
}

type RadarChartProps = {
  axes: RadarAxis[]
  series: RadarSeries[] // 2-3 players
  size?: number
  className?: string
}

export function RadarChart({ axes, series, size = 260, className }: RadarChartProps) {
  if (axes.length < 3 || series.length === 0) return null

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 36 // leave room for labels
  const n = axes.length
  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2 // start from top

  function polarToXY(angle: number, r: number): [number, number] {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }

  // Grid rings (3 concentric)
  const rings = [0.33, 0.66, 1]

  // Axis endpoints
  const axisPoints = axes.map((_, i) => {
    const angle = startAngle + i * angleStep
    return polarToXY(angle, radius)
  })

  // Label positions (pushed slightly outward)
  const labelPoints = axes.map((_, i) => {
    const angle = startAngle + i * angleStep
    return polarToXY(angle, radius + 18)
  })

  // Data polygons
  const seriesPolygons = series.map((s) => {
    const points = s.values.map((v, i) => {
      const normalized = Math.min(v / (axes[i].max || 1), 1)
      const angle = startAngle + i * angleStep
      return polarToXY(angle, normalized * radius)
    })
    return points.map(([x, y]) => `${x},${y}`).join(' ')
  })

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Grid rings */}
        {rings.map((r, ri) => {
          const ringPoints = axes
            .map((_, i) => {
              const angle = startAngle + i * angleStep
              return polarToXY(angle, r * radius)
            })
            .map(([x, y]) => `${x},${y}`)
            .join(' ')
          return (
            <polygon
              key={ri}
              points={ringPoints}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={0.5}
              strokeDasharray={ri < rings.length - 1 ? '3 3' : undefined}
            />
          )
        })}

        {/* Axis lines */}
        {axisPoints.map(([x, y], i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="hsl(var(--muted))"
            strokeWidth={0.5}
          />
        ))}

        {/* Data polygons */}
        {seriesPolygons.map((points, si) => (
          <polygon
            key={si}
            points={points}
            fill={series[si].color}
            fillOpacity={0.15}
            stroke={series[si].color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}

        {/* Data points */}
        {series.map((s, si) =>
          s.values.map((v, i) => {
            const normalized = Math.min(v / (axes[i].max || 1), 1)
            const angle = startAngle + i * angleStep
            const [x, y] = polarToXY(angle, normalized * radius)
            return (
              <circle
                key={`${si}-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill={s.color}
                stroke="hsl(var(--background))"
                strokeWidth={1.5}
              />
            )
          })
        )}

        {/* Axis labels */}
        {labelPoints.map(([x, y], i) => {
          const isTop = y < cy - radius * 0.5
          const isBottom = y > cy + radius * 0.5
          const isLeft = x < cx - 10
          const isRight = x > cx + 10
          const anchor = isLeft ? 'end' : isRight ? 'start' : 'middle'
          const dy = isTop ? -2 : isBottom ? 8 : 3

          return (
            <text
              key={i}
              x={x}
              y={y + dy}
              textAnchor={anchor}
              className="fill-muted-foreground text-[9px] font-medium"
            >
              {axes[i].label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

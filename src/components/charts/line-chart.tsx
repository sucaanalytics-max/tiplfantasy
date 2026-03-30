'use client'

import { cn } from '@/lib/utils'
import { useId } from 'react'

type DataSeries = { label: string; values: number[]; color: string }

type LineChartProps = {
  series: DataSeries[]
  xLabels?: string[]
  width?: number
  height?: number
  invertY?: boolean
  showDots?: boolean
  showArea?: boolean
  className?: string
}

export function LineChart({
  series,
  xLabels,
  width = 300,
  height = 160,
  invertY = false,
  showDots = true,
  showArea = false,
  className,
}: LineChartProps) {
  const id = useId()

  const padding = { top: 12, right: 12, bottom: xLabels ? 24 : 12, left: 32 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Compute bounds across all series
  const allValues = series.flatMap((s) => s.values)
  if (allValues.length === 0) return null

  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const yMin = rawMin === rawMax ? rawMin - 1 : rawMin
  const yMax = rawMin === rawMax ? rawMax + 1 : rawMax

  const maxPoints = Math.max(...series.map((s) => s.values.length))

  function toX(index: number): number {
    if (maxPoints <= 1) return padding.left + chartW / 2
    return padding.left + (index / (maxPoints - 1)) * chartW
  }

  function toY(value: number): number {
    const normalized = (value - yMin) / (yMax - yMin)
    const flipped = invertY ? normalized : 1 - normalized
    return padding.top + flipped * chartH
  }

  // Grid lines (4 horizontal)
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const value = yMin + (i / 4) * (yMax - yMin)
    return { y: toY(value), label: Math.round(value).toString() }
  })

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <defs>
          {series.map((s, si) => (
            <linearGradient
              key={si}
              id={`${id}-grad-${si}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={line.y}
              x2={width - padding.right}
              y2={line.y}
              stroke="hsl(var(--muted))"
              strokeWidth={0.5}
              strokeDasharray="4 3"
            />
            <text
              x={padding.left - 6}
              y={line.y}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-muted-foreground text-[8px]"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* Series */}
        {series.map((s, si) => {
          const points = s.values.map((v, i) => `${toX(i)},${toY(v)}`)
          const polylinePoints = points.join(' ')

          // Area path
          const areaPath =
            showArea && s.values.length > 1
              ? `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(' ')} L${toX(s.values.length - 1)},${padding.top + chartH} L${toX(0)},${padding.top + chartH} Z`
              : null

          return (
            <g key={si}>
              {areaPath && (
                <path
                  d={areaPath}
                  fill={`url(#${id}-grad-${si})`}
                  className="transition-all duration-500"
                />
              )}
              <polyline
                points={polylinePoints}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />
              {showDots &&
                s.values.map((v, i) => (
                  <circle
                    key={i}
                    cx={toX(i)}
                    cy={toY(v)}
                    r={3}
                    fill={s.color}
                    stroke="hsl(var(--background))"
                    strokeWidth={1.5}
                  />
                ))}
            </g>
          )
        })}

        {/* X-axis labels */}
        {xLabels?.map((label, i) => (
          <text
            key={i}
            x={toX(i)}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[8px]"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-0.5 w-3 rounded-full"
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

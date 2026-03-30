'use client'

import { cn } from '@/lib/utils'

type HeatmapProps = {
  values: number[]
  labels?: string[]
  maxValue?: number
  className?: string
}

function getCellColor(value: number, max: number): string {
  if (max === 0) return 'rgb(107 114 128)' // gray-500
  const ratio = value / max
  if (ratio >= 0.6) return 'rgb(52 211 153)' // emerald-400
  if (ratio >= 0.3) return 'rgb(251 191 36)' // amber-400
  return 'rgb(248 113 113)' // red-400
}

function getCellTextColor(value: number, max: number): string {
  if (max === 0) return 'rgb(255 255 255)'
  const ratio = value / max
  if (ratio >= 0.6) return 'rgb(6 78 59)' // emerald-950
  if (ratio >= 0.3) return 'rgb(120 53 15)' // amber-950
  return 'rgb(127 29 29)' // red-950
}

export function Heatmap({ values, labels, maxValue, className }: HeatmapProps) {
  const max = maxValue ?? Math.max(...values, 1)
  const cellSize = 24
  const gap = 2
  const totalWidth = values.length * (cellSize + gap) - gap
  const totalHeight = labels ? cellSize + 14 : cellSize

  return (
    <div className={cn('inline-flex', className)}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        className="shrink-0"
      >
        {values.map((value, i) => {
          const x = i * (cellSize + gap)
          return (
            <g key={i}>
              <rect
                x={x}
                y={0}
                width={cellSize}
                height={cellSize}
                rx={4}
                fill={getCellColor(value, max)}
                className="transition-colors duration-300"
              />
              {value >= 10 && (
                <text
                  x={x + cellSize / 2}
                  y={cellSize / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={getCellTextColor(value, max)}
                  className="font-display text-[9px] font-bold"
                >
                  {value}
                </text>
              )}
              {labels?.[i] && (
                <text
                  x={x + cellSize / 2}
                  y={cellSize + 11}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[8px]"
                >
                  {labels[i]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

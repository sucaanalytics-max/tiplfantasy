'use client'

import { cn } from '@/lib/utils'

type Bar = { label: string; value: number; color: string }

type GroupedBarGroup = {
  label: string
  bars: Bar[]
}

type GroupedBarProps = {
  groups: GroupedBarGroup[]
  height?: number
  barWidth?: number
  showValues?: boolean
  showLegend?: boolean
  className?: string
}

export function GroupedBar({
  groups,
  height = 200,
  barWidth = 20,
  showValues = true,
  showLegend = true,
  className,
}: GroupedBarProps) {
  if (groups.length === 0) return null

  const maxBarsPerGroup = Math.max(...groups.map((g) => g.bars.length))
  const groupGap = 24
  const barGap = 3
  const groupWidth = maxBarsPerGroup * barWidth + (maxBarsPerGroup - 1) * barGap
  const totalWidth = groups.length * groupWidth + (groups.length - 1) * groupGap

  const padding = { top: 20, right: 12, bottom: 32, left: 8 }
  const svgWidth = totalWidth + padding.left + padding.right
  const chartH = height - padding.top - padding.bottom

  const allValues = groups.flatMap((g) => g.bars.map((b) => b.value))
  const maxValue = Math.max(...allValues, 1)

  function barHeight(value: number): number {
    return (value / maxValue) * chartH
  }

  // Collect unique bar labels for legend
  const legendItems = groups[0]?.bars.map((b) => ({ label: b.label, color: b.color })) ?? []

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${height}`} width={svgWidth} height={height}>
          {/* Baseline */}
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={svgWidth - padding.right}
            y2={padding.top + chartH}
            stroke="hsl(var(--muted))"
            strokeWidth={0.5}
          />

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padding.top + chartH - pct * chartH
            return (
              <line
                key={i}
                x1={padding.left}
                y1={y}
                x2={svgWidth - padding.right}
                y2={y}
                stroke="hsl(var(--muted))"
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
            )
          })}

          {groups.map((group, gi) => {
            const groupX = padding.left + gi * (groupWidth + groupGap)

            return (
              <g key={gi}>
                {group.bars.map((bar, bi) => {
                  const x = groupX + bi * (barWidth + barGap)
                  const h = barHeight(bar.value)
                  const y = padding.top + chartH - h

                  return (
                    <g key={bi}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={h}
                        rx={2}
                        fill={bar.color}
                        fillOpacity={0.8}
                      />
                      {showValues && bar.value > 0 && (
                        <text
                          x={x + barWidth / 2}
                          y={y - 4}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[8px] font-medium"
                        >
                          {bar.value % 1 === 0 ? bar.value : bar.value.toFixed(1)}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Group label */}
                <text
                  x={groupX + groupWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px] font-medium"
                >
                  {group.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      {showLegend && legendItems.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {legendItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils'

type Segment = { label: string; value: number; color: string }

type StackedBarProps = {
  segments: Segment[]
  height?: number
  showLabels?: boolean
  showLegend?: boolean
  className?: string
}

export function StackedBar({
  segments,
  height = 24,
  showLabels = false,
  showLegend = false,
  className,
}: StackedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return null

  const nonEmpty = segments.filter((s) => s.value > 0)
  const radius = height / 3

  let xOffset = 0
  const rects = nonEmpty.map((segment, i) => {
    const width = (segment.value / total) * 100
    const isFirst = i === 0
    const isLast = i === nonEmpty.length - 1
    const x = xOffset
    xOffset += width

    return { ...segment, width, x, isFirst, isLast }
  })

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex w-full overflow-hidden rounded-md" style={{ height }}>
        {rects.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-center transition-all duration-500"
            style={{
              width: `${r.width}%`,
              backgroundColor: r.color,
              height,
              borderTopLeftRadius: r.isFirst ? radius : 0,
              borderBottomLeftRadius: r.isFirst ? radius : 0,
              borderTopRightRadius: r.isLast ? radius : 0,
              borderBottomRightRadius: r.isLast ? radius : 0,
            }}
          >
            {showLabels && r.width > 15 && (
              <span className="text-[10px] font-semibold text-black/80">{r.value}</span>
            )}
          </div>
        ))}
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {nonEmpty.map((s, i) => (
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
      )}
    </div>
  )
}

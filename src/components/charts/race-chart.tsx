"use client"

import { useMemo, useRef, useState } from "react"
import type { RaceData } from "@/lib/race-data"
import { cn } from "@/lib/utils"

type View = "rank" | "points"

type RaceChartProps = {
  data: RaceData
  className?: string
}

// Avoid yellow/amber/orange so the current-user gold line stays unique.
const PALETTE = [
  "#3b82f6", // blue-500
  "#a855f7", // purple-500
  "#10b981", // emerald-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#94a3b8", // slate-400
]

const PRIMARY = "#fbbf24" // gold — reserved for the current user

const PX_PER_MATCH = 36
const MIN_WIDTH = 320
const HEIGHT = 260
const PAD = { top: 14, right: 14, bottom: 26, left: 36 }

export function RaceChart({ data, className }: RaceChartProps) {
  const [view, setView] = useState<View>("rank")
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const N = data.matchNumbers.length
  const width = Math.max(MIN_WIDTH, PAD.left + PAD.right + Math.max(2, N - 1) * PX_PER_MATCH)
  const chartW = width - PAD.left - PAD.right
  const chartH = HEIGHT - PAD.top - PAD.bottom

  const { yMin, yMax, invert } = useMemo(() => {
    if (view === "rank") {
      // Rank 1 should sit at the TOP of the chart (leader at top).
      const allRanks = data.users.flatMap((u) => u.cumRanks)
      return { yMin: 1, yMax: Math.max(...allRanks, 2), invert: true }
    }
    // Points: 0 at the bottom, max at the top — lines rise over time.
    const allPts = data.users.flatMap((u) => u.cumPoints)
    return { yMin: 0, yMax: Math.max(...allPts, 10) * 1.05, invert: false }
  }, [view, data])

  function toX(i: number) {
    if (N <= 1) return PAD.left
    return PAD.left + (i / (N - 1)) * chartW
  }
  function toY(v: number) {
    const n = (v - yMin) / (yMax - yMin || 1)
    const flipped = invert ? n : 1 - n
    return PAD.top + flipped * chartH
  }

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (view === "rank") {
      const ticks = [1, Math.ceil(yMax / 2), Math.ceil(yMax)].filter((v, i, a) => a.indexOf(v) === i)
      return ticks.map((v) => ({ y: toY(v), label: String(v) }))
    }
    return Array.from({ length: 5 }, (_, i) => {
      const v = yMin + (i / 4) * (yMax - yMin)
      return { y: toY(v), label: Math.round(v).toLocaleString() }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, yMin, yMax, chartH])

  // X-axis ticks (label thinning)
  const xLabelStride = Math.max(1, Math.ceil(N / 10))

  function handlePointer(clientX: number) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * width
    const rel = (x - PAD.left) / Math.max(1, chartW)
    const idx = Math.round(rel * (N - 1))
    setHoverIdx(Math.max(0, Math.min(N - 1, idx)))
  }

  const meUser = data.users.find((u) => u.isCurrentUser)
  const leaderUser = view === "rank"
    ? data.users.reduce((best, u) => (u.cumRanks[hoverIdx ?? N - 1] < (best?.cumRanks[hoverIdx ?? N - 1] ?? 99) ? u : best), data.users[0])
    : data.users.reduce((best, u) => (u.cumPoints[hoverIdx ?? N - 1] > (best?.cumPoints[hoverIdx ?? N - 1] ?? -Infinity) ? u : best), data.users[0])

  function colorFor(u: RaceData["users"][number]) {
    if (u.isCurrentUser) return PRIMARY
    return PALETTE[(u.finalRank - 1) % PALETTE.length]
  }

  return (
    <div className={cn("rounded-lg glass overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-overlay-border bg-overlay-subtle">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Season Race
        </span>
        <div className="inline-flex rounded-md bg-overlay-subtle border border-overlay-border p-0.5 text-[11px]">
          {(["rank", "points"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 rounded-sm font-medium transition-colors",
                view === v ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              {v === "rank" ? "Rank" : "Points"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="overflow-x-auto"
          data-vaul-no-drag
        >
          <svg
            ref={svgRef}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          className="block"
          onPointerMove={(e) => handlePointer(e.clientX)}
          onPointerLeave={() => setHoverIdx(null)}
          onTouchStart={(e) => handlePointer(e.touches[0].clientX)}
          onTouchMove={(e) => handlePointer(e.touches[0].clientX)}
        >
          {/* Y-axis grid + labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={t.y}
                x2={width - PAD.right}
                y2={t.y}
                stroke="hsl(var(--muted))"
                strokeWidth={0.5}
                strokeDasharray="4 4"
                opacity={0.5}
              />
              <text
                x={PAD.left - 6}
                y={t.y}
                textAnchor="end"
                dominantBaseline="central"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {data.matchNumbers.map((mn, i) => {
            if (i % xLabelStride !== 0 && i !== N - 1) return null
            return (
              <text
                key={mn}
                x={toX(i)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                M{mn}
              </text>
            )
          })}

          {/* Hover guide */}
          {hoverIdx !== null && (
            <line
              x1={toX(hoverIdx)}
              y1={PAD.top}
              x2={toX(hoverIdx)}
              y2={HEIGHT - PAD.bottom}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
          )}

          {/* Lines: render others first, current user last so it's on top */}
          {data.users
            .slice()
            .sort((a, b) => Number(a.isCurrentUser) - Number(b.isCurrentUser))
            .map((u) => {
              const values = view === "rank" ? u.cumRanks : u.cumPoints
              const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ")
              const isActive = activeUserId === u.userId
              const isMe = u.isCurrentUser
              const stroke = colorFor(u)
              const sw = isMe ? 2.6 : isActive ? 2.2 : 1.6
              const op = isMe ? 1 : isActive ? 1 : 0.55
              return (
                <polyline
                  key={u.userId}
                  points={points}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeOpacity={op}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            })}

          {/* Hover dots */}
          {hoverIdx !== null &&
            data.users.map((u) => {
              const v = view === "rank" ? u.cumRanks[hoverIdx] : u.cumPoints[hoverIdx]
              const isMe = u.isCurrentUser
              return (
                <circle
                  key={u.userId}
                  cx={toX(hoverIdx)}
                  cy={toY(v)}
                  r={isMe ? 4 : 3}
                  fill={colorFor(u)}
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                  fillOpacity={isMe ? 1 : 0.85}
                />
              )
            })}
          </svg>
        </div>
        {/* Right-edge fade hints horizontal scroll exists */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-background to-transparent opacity-70"
        />
      </div>

      {/* Hover summary */}
      <div className="px-4 py-2 border-t border-overlay-border bg-overlay-subtle min-h-[44px] flex items-center">
        {hoverIdx !== null ? (
          <div className="flex items-center gap-3 text-[11px] w-full">
            <span className="font-mono font-semibold text-foreground">
              M{data.matchNumbers[hoverIdx]}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(leaderUser) }} />
              <span className="text-muted-foreground">Lead:</span>
              <span className="font-medium truncate max-w-[100px]">{leaderUser.displayName}</span>
              <span className="font-display tabular-nums font-bold">
                {view === "rank" ? `#${leaderUser.cumRanks[hoverIdx]}` : `${leaderUser.cumPoints[hoverIdx]} pts`}
              </span>
            </span>
            {meUser && meUser.userId !== leaderUser.userId && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIMARY }} />
                  <span className="text-muted-foreground">You:</span>
                  <span className="font-display tabular-nums font-bold text-primary">
                    {view === "rank" ? `#${meUser.cumRanks[hoverIdx]}` : `${meUser.cumPoints[hoverIdx]} pts`}
                  </span>
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Hover or tap the chart to see standings at any match
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 border-t border-overlay-border">
        {data.users.map((u) => {
          const isMe = u.isCurrentUser
          const isActive = activeUserId === u.userId
          return (
            <button
              key={u.userId}
              type="button"
              onMouseEnter={() => setActiveUserId(u.userId)}
              onMouseLeave={() => setActiveUserId(null)}
              onClick={() => setActiveUserId(isActive ? null : u.userId)}
              className={cn(
                "flex items-center gap-2 text-left rounded-sm px-1 py-1 -mx-1 min-h-[28px]",
                isActive && "bg-overlay-subtle"
              )}
            >
              <span
                className="inline-block h-0.5 w-4 rounded-full shrink-0"
                style={{
                  backgroundColor: colorFor(u),
                  height: isMe ? 3 : 2,
                }}
              />
              <span
                className={cn(
                  "text-xs truncate",
                  isMe ? "font-bold text-primary" : "text-foreground"
                )}
              >
                {u.displayName}
                {isMe && <span className="text-[10px] ml-1 opacity-80">(you)</span>}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                #{u.finalRank}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

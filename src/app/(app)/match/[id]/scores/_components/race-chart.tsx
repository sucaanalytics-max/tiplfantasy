"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Trophy } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { getAvatarHexColor } from "@/lib/avatar"
import { computeRaceSeries, type RacePoint } from "@/lib/rivalry"

type Snapshot = { over_number: number; scores: Record<string, number> }

type Props = {
  userIds: string[]
  snapshots: Snapshot[]
  userNames: Record<string, string>
  currentUserId: string
  mode: "rank" | "points"
  className?: string
}

const PAD_TOP = 16
const PAD_BOTTOM = 28
const PAD_LEFT = 32
const PAD_RIGHT = 12
const HEIGHT = 320

export function RaceChart({
  userIds, snapshots, userNames, currentUserId, mode, className,
}: Props) {
  const series = useMemo(
    () => computeRaceSeries(userIds, snapshots),
    [userIds, snapshots],
  )

  const overs = useMemo(() => {
    const set = new Set<number>()
    for (const snap of snapshots) set.add(snap.over_number)
    return [...set].sort((a, b) => a - b)
  }, [snapshots])

  const minOver = overs[0] ?? 0
  const maxOver = overs[overs.length - 1] ?? 0
  const overSpan = Math.max(1, maxOver - minOver)
  const N = userIds.length

  const maxPoints = useMemo(() => {
    let m = 0
    for (const id of userIds) {
      for (const p of series[id] ?? []) {
        if (p.points > m) m = p.points
      }
    }
    return m
  }, [series, userIds])

  const yMaxPoints = niceCeil(maxPoints)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const innerW = Math.max(0, width - PAD_LEFT - PAD_RIGHT)
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM

  // Position helpers ─────────────────────────────────────────────────────
  const xFor = (over: number) =>
    PAD_LEFT + (overSpan === 0 ? 0 : ((over - minOver) / overSpan) * innerW)

  const yForRank = (rank: number) =>
    N <= 1
      ? PAD_TOP + innerH / 2
      : PAD_TOP + ((rank - 1) / (N - 1)) * innerH

  const yForPoints = (pts: number) =>
    yMaxPoints === 0
      ? PAD_TOP + innerH
      : PAD_TOP + innerH - (pts / yMaxPoints) * innerH

  const yFor = (p: RacePoint) =>
    mode === "rank" ? yForRank(p.rank) : yForPoints(p.points)

  // Build paths once per (mode, series, width)
  const paths = useMemo(() => {
    if (width === 0) return [] as Array<{ userId: string; d: string; isMe: boolean; color: string; name: string; lastY: number }>
    return userIds.map((id) => {
      const points = series[id] ?? []
      const name = userNames[id] ?? "?"
      const isMe = id === currentUserId
      const color = isMe ? "var(--primary, #6366f1)" : getAvatarHexColor(name)
      let d = ""
      let lastY = 0
      points.forEach((p, i) => {
        const x = xFor(p.over)
        const y = yFor(p)
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `
        lastY = y
      })
      return { userId: id, d: d.trim(), isMe, color, name, lastY }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds, series, userNames, currentUserId, mode, width, yMaxPoints, N, overSpan, minOver])

  // X-axis ticks every 5 overs (plus first/last)
  const xTicks = useMemo(() => {
    if (!overs.length) return []
    const ticks = new Set<number>([minOver, maxOver])
    for (let o = Math.ceil(minOver / 5) * 5; o <= maxOver; o += 5) ticks.add(o)
    return [...ticks].sort((a, b) => a - b)
  }, [overs, minOver, maxOver])

  // Y-axis labels
  const yLabels = useMemo(() => {
    if (mode === "rank") {
      // Show 1, mid, last (avoid clutter when N is large)
      if (N <= 1) return [{ y: yForRank(1), label: "1" }]
      const ranks = N <= 5
        ? Array.from({ length: N }, (_, i) => i + 1)
        : [1, Math.ceil(N / 2), N]
      return ranks.map((r) => ({ y: yForRank(r), label: String(r) }))
    }
    const top = yMaxPoints
    const mid = Math.round(top / 2)
    return [
      { y: yForPoints(0), label: "0" },
      { y: yForPoints(mid), label: String(mid) },
      { y: yForPoints(top), label: String(top) },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, N, yMaxPoints, innerH])

  // Pointer interaction
  const [hoverOver, setHoverOver] = useState<number | null>(null)

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!overs.length || width === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < PAD_LEFT - 8 || x > width - PAD_RIGHT + 8) {
      setHoverOver(null)
      return
    }
    // Snap to nearest available over
    const fx = (x - PAD_LEFT) / innerW
    const rawOver = minOver + fx * overSpan
    let nearest = overs[0]
    let bestDist = Math.abs(rawOver - nearest)
    for (const o of overs) {
      const d = Math.abs(rawOver - o)
      if (d < bestDist) { bestDist = d; nearest = o }
    }
    setHoverOver(nearest)
  }
  const onPointerLeave = () => setHoverOver(null)

  // Tooltip data
  const tooltip = useMemo(() => {
    if (hoverOver == null) return null
    const rows = userIds
      .map((id) => {
        const p = (series[id] ?? []).find((q) => q.over === hoverOver)
        if (!p) return null
        return {
          id,
          name: userNames[id] ?? "?",
          points: p.points,
          rank: p.rank,
          isMe: id === currentUserId,
          color: id === currentUserId ? "var(--primary, #6366f1)" : getAvatarHexColor(userNames[id] ?? "?"),
        }
      })
      .filter((r): r is { id: string; name: string; points: number; rank: number; isMe: boolean; color: string } => r != null)
      .sort((a, b) => a.rank - b.rank)
    return { over: hoverOver, rows }
  }, [hoverOver, userIds, series, userNames, currentUserId])

  // Animate the paths drawing in once
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const didAnimate = useRef(false)
  useEffect(() => {
    if (didAnimate.current || width === 0) return
    if (!paths.length) return
    didAnimate.current = true
    const cleanups: Array<() => void> = []
    for (const { userId } of paths) {
      const el = pathRefs.current.get(userId)
      if (!el) continue
      const len = el.getTotalLength()
      el.style.transition = "none"
      el.style.strokeDasharray = `${len}`
      el.style.strokeDashoffset = `${len}`
      void el.getBoundingClientRect()
      el.style.transition = "stroke-dashoffset 600ms ease-out"
      el.style.strokeDashoffset = "0"
      // After the animation, clear the dasharray so subsequent path
      // extensions (from new snapshots) render without truncation.
      const t = window.setTimeout(() => {
        el.style.transition = ""
        el.style.strokeDasharray = ""
        el.style.strokeDashoffset = ""
      }, 650)
      cleanups.push(() => window.clearTimeout(t))
    }
    return () => { for (const c of cleanups) c() }
  }, [paths, width])

  if (snapshots.length < 2 || overs.length < 2) {
    return (
      <EmptyState
        icon={Trophy}
        title="Race begins after the first over"
        description="As points are scored, your line and your league's lines will start drawing here."
      />
    )
  }

  return (
    <div ref={wrapRef} className={cn("w-full select-none", className)}>
      <svg
        role="img"
        aria-label="League standings race chart"
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
        preserveAspectRatio="none"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="touch-none"
      >
        {/* Grid: horizontal lines aligned with y-labels */}
        {yLabels.map((t, i) => (
          <line
            key={`yg-${i}`}
            x1={PAD_LEFT} x2={width - PAD_RIGHT}
            y1={t.y} y2={t.y}
            stroke="currentColor"
            strokeWidth={1}
            className="text-overlay-border"
            opacity={0.6}
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((t, i) => (
          <text
            key={`yl-${i}`}
            x={PAD_LEFT - 6} y={t.y + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {t.label}
          </text>
        ))}

        {/* X-axis ticks + labels */}
        {xTicks.map((o, i) => (
          <g key={`xt-${i}`}>
            <line
              x1={xFor(o)} x2={xFor(o)}
              y1={HEIGHT - PAD_BOTTOM} y2={HEIGHT - PAD_BOTTOM + 4}
              stroke="currentColor"
              className="text-muted-foreground"
              opacity={0.5}
            />
            <text
              x={xFor(o)} y={HEIGHT - PAD_BOTTOM + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {o}
            </text>
          </g>
        ))}

        {/* Axis title */}
        <text
          x={(PAD_LEFT + width - PAD_RIGHT) / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          className="fill-muted-foreground/70 text-[9px] uppercase tracking-wider"
        >
          Over
        </text>

        {/* Hover guide */}
        {hoverOver != null && (
          <line
            x1={xFor(hoverOver)} x2={xFor(hoverOver)}
            y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 3"
            className="text-muted-foreground/60"
          />
        )}

        {/* Paths — me last so it sits on top */}
        {paths
          .slice()
          .sort((a, b) => Number(a.isMe) - Number(b.isMe))
          .map(({ userId, d, isMe, color }) => (
            <path
              key={userId}
              ref={(el) => {
                if (el) pathRefs.current.set(userId, el)
                else pathRefs.current.delete(userId)
              }}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={isMe ? 2.75 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={hoverOver != null && !isMe ? 0.55 : 1}
            />
          ))}

        {/* Hover dots on each line */}
        {hoverOver != null && paths.map(({ userId, isMe, color }) => {
          const p = (series[userId] ?? []).find((q) => q.over === hoverOver)
          if (!p) return null
          return (
            <circle
              key={`dot-${userId}`}
              cx={xFor(p.over)}
              cy={yFor(p)}
              r={isMe ? 3.5 : 2.5}
              fill={color}
              stroke="var(--background, #fff)"
              strokeWidth={1}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && tooltip.rows.length > 0 && (
        <div className="mt-2 rounded-md border border-overlay-border bg-overlay-subtle/80 backdrop-blur-sm px-3 py-2 text-[11px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-foreground">After over {tooltip.over}</span>
            <span className="text-muted-foreground">{tooltip.rows.length} {tooltip.rows.length === 1 ? "user" : "users"}</span>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {tooltip.rows.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                <span className={cn("truncate", r.isMe ? "font-semibold text-primary" : "text-foreground")}>
                  {firstName(r.name)}{r.isMe ? " (you)" : ""}
                </span>
                <span className="ml-auto tabular-nums text-muted-foreground shrink-0">
                  {mode === "rank" ? `#${r.rank}` : r.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {paths.map(({ userId, name, color, isMe }) => (
          <span key={`lg-${userId}`} className="inline-flex items-center gap-1.5 min-w-0 max-w-[40%]">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
            <span className={cn("truncate", isMe && "text-primary font-semibold")}>
              {firstName(name)}{isMe ? " (you)" : ""}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function firstName(full: string): string {
  return full.split(" ")[0] || full
}

function niceCeil(n: number): number {
  if (n <= 0) return 10
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  const norm = n / mag
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 5) nice = 5
  else nice = 10
  return nice * mag
}

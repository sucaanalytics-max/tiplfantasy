"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { getAvatarHexColor } from "@/lib/avatar"

type Props = {
  matchNumbers: number[]
  userIds: string[]
  userNames: Record<string, string>
  leaderUserId: string
  currentUserId: string
  cumulativeByUser: Record<string, number[]>
}

type Classification = "leader" | "you" | "top5" | "pack"

const HEIGHT = 300
const PAD_TOP = 16
const PAD_BOTTOM = 40
const PAD_LEFT = 56
const PAD_RIGHT = 14

export function SeasonRaceChart({
  matchNumbers,
  userIds,
  userNames,
  leaderUserId,
  currentUserId,
  cumulativeByUser,
}: Props) {
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

  const minMatch = matchNumbers[0] ?? 0
  const maxMatch = matchNumbers[matchNumbers.length - 1] ?? 0
  const matchSpan = Math.max(1, maxMatch - minMatch)

  // Classify each user once. userIds is already ordered by current season rank.
  const { classification, top5Ids, packIds, youIsLeader } = useMemo(() => {
    const cls = new Map<string, Classification>()
    cls.set(leaderUserId, "leader")
    const meIsLeader = currentUserId === leaderUserId
    if (!meIsLeader) cls.set(currentUserId, "you")
    const top5: string[] = []
    const pack: string[] = []
    for (const id of userIds) {
      if (cls.has(id)) continue
      if (top5.length < 5) {
        cls.set(id, "top5")
        top5.push(id)
      } else {
        cls.set(id, "pack")
        pack.push(id)
      }
    }
    return { classification: cls, top5Ids: top5, packIds: pack, youIsLeader: meIsLeader }
  }, [userIds, leaderUserId, currentUserId])

  // gap[user][i] = T_user[i] - T_leader[i]
  const gapsByUser = useMemo(() => {
    const leaderTotals = cumulativeByUser[leaderUserId] ?? []
    const out: Record<string, number[]> = {}
    for (const id of userIds) {
      const totals = cumulativeByUser[id] ?? []
      out[id] = matchNumbers.map((_, i) => (totals[i] ?? 0) - (leaderTotals[i] ?? 0))
    }
    return out
  }, [userIds, cumulativeByUser, leaderUserId, matchNumbers])

  // Pack envelope (min/max gap) at each match
  const envelope = useMemo(() => {
    if (packIds.length === 0) return null
    return matchNumbers.map((_, i) => {
      let lo = 0
      let hi = 0
      let any = false
      for (const id of packIds) {
        const g = gapsByUser[id]?.[i] ?? 0
        if (!any || g < lo) lo = g
        if (!any || g > hi) hi = g
        any = true
      }
      return { lo, hi }
    })
  }, [packIds, gapsByUser, matchNumbers])

  // Y-axis floor: nice-rounded min gap
  const yMin = useMemo(() => {
    let m = 0
    for (const id of userIds) {
      for (const g of gapsByUser[id] ?? []) if (g < m) m = g
    }
    if (envelope) for (const p of envelope) if (p.lo < m) m = p.lo
    return niceFloor(m)
  }, [userIds, gapsByUser, envelope])

  // Lead changes (overall #1 flips at this match)
  const leadChangeMatches = useMemo(() => {
    const out: number[] = []
    let prev: string | null = null
    for (let i = 0; i < matchNumbers.length; i++) {
      let bestId: string | null = null
      let bestVal = -Infinity
      for (const id of userIds) {
        const v = cumulativeByUser[id]?.[i] ?? 0
        if (v > bestVal) { bestVal = v; bestId = id }
      }
      if (prev !== null && bestId !== prev) out.push(matchNumbers[i])
      prev = bestId
    }
    return out
  }, [userIds, cumulativeByUser, matchNumbers])

  // Position helpers
  const xFor = (m: number) =>
    PAD_LEFT + (matchSpan === 0 ? 0 : ((m - minMatch) / matchSpan) * innerW)
  const yFor = (gap: number) => {
    if (yMin === 0) return PAD_TOP
    return PAD_TOP + (gap / yMin) * innerH
  }

  // Y-ticks: 0 + 3 nice negative steps
  const yTicks = useMemo(() => {
    const ticks: number[] = [0]
    if (yMin < 0) {
      const step = niceStep(Math.abs(yMin) / 3)
      for (let v = -step; v > yMin - 1; v -= step) ticks.push(v)
      // Always include the floor
      if (ticks[ticks.length - 1] !== yMin) ticks.push(yMin)
    }
    return ticks
  }, [yMin])

  // X-ticks: every 10 + first + last
  const xTicks = useMemo(() => {
    const ticks = new Set<number>([minMatch, maxMatch])
    const stride = matchSpan > 30 ? 10 : 5
    for (let m = Math.ceil(minMatch / stride) * stride; m <= maxMatch; m += stride) ticks.add(m)
    return [...ticks].sort((a, b) => a - b)
  }, [minMatch, maxMatch, matchSpan])

  const pathFor = (id: string): string => {
    if (width === 0) return ""
    let d = ""
    matchNumbers.forEach((m, i) => {
      const g = gapsByUser[id]?.[i] ?? 0
      const x = xFor(m)
      const y = yFor(g)
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `
    })
    return d.trim()
  }

  const envelopePath = useMemo(() => {
    if (!envelope || width === 0) return ""
    let top = ""
    matchNumbers.forEach((m, i) => {
      const x = xFor(m)
      top += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yFor(envelope[i].hi).toFixed(1)} `
    })
    let bot = ""
    for (let i = matchNumbers.length - 1; i >= 0; i--) {
      const x = xFor(matchNumbers[i])
      bot += `L${x.toFixed(1)},${yFor(envelope[i].lo).toFixed(1)} `
    }
    return (top + bot).trim() + " Z"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelope, matchNumbers, width, yMin])

  // Hover
  const [hoverMatch, setHoverMatch] = useState<number | null>(null)

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!matchNumbers.length || width === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < PAD_LEFT - 8 || x > width - PAD_RIGHT + 8) {
      setHoverMatch(null)
      return
    }
    const fx = (x - PAD_LEFT) / innerW
    const raw = minMatch + fx * matchSpan
    let nearest = matchNumbers[0]
    let bestDist = Math.abs(raw - nearest)
    for (const m of matchNumbers) {
      const d = Math.abs(raw - m)
      if (d < bestDist) { bestDist = d; nearest = m }
    }
    setHoverMatch(nearest)
  }

  const tooltip = useMemo(() => {
    if (hoverMatch == null) return null
    const i = matchNumbers.indexOf(hoverMatch)
    if (i < 0) return null
    const leaderTotal = Math.round(cumulativeByUser[leaderUserId]?.[i] ?? 0)
    const sorted = userIds
      .map((id) => ({ id, total: cumulativeByUser[id]?.[i] ?? 0 }))
      .sort((a, b) => b.total - a.total)
    const youRank = sorted.findIndex((s) => s.id === currentUserId) + 1
    const youGap = Math.round(gapsByUser[currentUserId]?.[i] ?? 0)
    let packLo = 0
    let packHi = 0
    if (envelope) {
      packLo = Math.round(envelope[i].lo)
      packHi = Math.round(envelope[i].hi)
    }
    return { match: hoverMatch, leaderTotal, youRank, youGap, packLo, packHi, hasPack: !!envelope }
  }, [hoverMatch, matchNumbers, userIds, cumulativeByUser, leaderUserId, currentUserId, envelope, gapsByUser])

  if (matchNumbers.length < 2) {
    return (
      <div className="rounded-2xl glass p-6 text-center text-sm text-muted-foreground">
        Race begins after the second match.
      </div>
    )
  }

  const leaderName = userNames[leaderUserId] ?? "—"
  const leaderColor = "var(--captain-gold, #d4a017)"
  const youColor = "var(--primary, #6366f1)"
  const lastLeaderX = xFor(maxMatch)

  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-overlay-border bg-overlay-subtle">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Season Race</span>
          <span className="text-[10px] text-muted-foreground truncate">points behind leader</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground">leader</span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "color-mix(in oklab, var(--captain-gold, #d4a017) 18%, transparent)", color: "var(--captain-gold, #d4a017)" }}
          >
            ★ {firstName(leaderName)}
          </span>
        </div>
      </div>

      <div ref={wrapRef} className="px-2 pt-2 pb-1 select-none">
        <svg
          role="img"
          aria-label="Season race — points behind leader"
          width="100%"
          height={HEIGHT}
          viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
          preserveAspectRatio="none"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverMatch(null)}
          className="touch-none"
        >
          {/* Y grid + labels */}
          {yTicks.map((v, i) => (
            <g key={`yt-${i}`}>
              <line
                x1={PAD_LEFT} x2={width - PAD_RIGHT}
                y1={yFor(v)} y2={yFor(v)}
                stroke="currentColor"
                strokeWidth={v === 0 ? 1 : 1}
                strokeDasharray={v === 0 ? undefined : "2 4"}
                className={v === 0 ? "text-overlay-border" : "text-overlay-border"}
                opacity={v === 0 ? 0.9 : 0.5}
              />
              <text
                x={PAD_LEFT - 6} y={yFor(v) + 3}
                textAnchor="end"
                className={cn(
                  "text-[10px] tabular-nums",
                  v === 0 ? "fill-foreground font-semibold" : "fill-muted-foreground",
                )}
              >
                {v === 0 ? "0" : formatGap(v)}
              </text>
            </g>
          ))}

          {/* X-axis ticks */}
          {xTicks.map((m, i) => (
            <g key={`xt-${i}`}>
              <line
                x1={xFor(m)} x2={xFor(m)}
                y1={HEIGHT - PAD_BOTTOM} y2={HEIGHT - PAD_BOTTOM + 4}
                stroke="currentColor"
                className="text-muted-foreground"
                opacity={0.5}
              />
              <text
                x={xFor(m)} y={HEIGHT - PAD_BOTTOM + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                M{m}
              </text>
            </g>
          ))}

          {/* Pack envelope */}
          {envelope && envelopePath && (
            <path
              d={envelopePath}
              fill="currentColor"
              className="text-overlay-border"
              opacity={0.35}
              pointerEvents="none"
            />
          )}

          {/* Hover guide */}
          {hoverMatch != null && (
            <line
              x1={xFor(hoverMatch)} x2={xFor(hoverMatch)}
              y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              className="text-muted-foreground/60"
            />
          )}

          {/* Top-5 chasers */}
          {top5Ids.map((id) => {
            const color = getAvatarHexColor(userNames[id] ?? "?")
            return (
              <path
                key={`top-${id}`}
                d={pathFor(id)}
                fill="none"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )
          })}

          {/* You */}
          {!youIsLeader && (
            <path
              d={pathFor(currentUserId)}
              fill="none"
              stroke={youColor}
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Leader baseline at y=0 */}
          <line
            x1={PAD_LEFT} x2={width - PAD_RIGHT}
            y1={yFor(0)} y2={yFor(0)}
            stroke={leaderColor}
            strokeWidth={2.75}
            strokeLinecap="round"
          />

          {/* Leader star at right */}
          {width > 0 && (
            <text
              x={lastLeaderX + 2} y={yFor(0) + 4}
              className="text-[12px]"
              style={{ fill: leaderColor }}
            >
              ★
            </text>
          )}

          {/* Lead-change ticks */}
          {leadChangeMatches.map((m, i) => (
            <polygon
              key={`lc-${i}`}
              points={`${xFor(m) - 3},${HEIGHT - PAD_BOTTOM + 2} ${xFor(m) + 3},${HEIGHT - PAD_BOTTOM + 2} ${xFor(m)},${HEIGHT - PAD_BOTTOM - 3}`}
              fill={leaderColor}
              opacity={0.85}
            />
          ))}

          {/* Hover dots */}
          {hoverMatch != null && width > 0 && (
            <>
              {top5Ids.map((id) => {
                const i = matchNumbers.indexOf(hoverMatch)
                if (i < 0) return null
                const g = gapsByUser[id]?.[i] ?? 0
                return (
                  <circle
                    key={`dot-top-${id}`}
                    cx={xFor(hoverMatch)} cy={yFor(g)}
                    r={2.5}
                    fill={getAvatarHexColor(userNames[id] ?? "?")}
                    stroke="var(--background, #fff)" strokeWidth={1}
                  />
                )
              })}
              {!youIsLeader && (() => {
                const i = matchNumbers.indexOf(hoverMatch)
                if (i < 0) return null
                const g = gapsByUser[currentUserId]?.[i] ?? 0
                return (
                  <circle
                    cx={xFor(hoverMatch)} cy={yFor(g)}
                    r={3.5}
                    fill={youColor}
                    stroke="var(--background, #fff)" strokeWidth={1}
                  />
                )
              })()}
              <circle
                cx={xFor(hoverMatch)} cy={yFor(0)}
                r={3.5}
                fill={leaderColor}
                stroke="var(--background, #fff)" strokeWidth={1}
              />
            </>
          )}
        </svg>

        {tooltip && (
          <div className="mx-2 mb-2 rounded-md border border-overlay-border bg-overlay-subtle/80 backdrop-blur-sm px-3 py-2 text-[11px]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-foreground">After M{tooltip.match}</span>
              <span className="text-muted-foreground tabular-nums">{tooltip.leaderTotal.toLocaleString()} leader pts</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-muted-foreground">You</span>
              <span className="text-right tabular-nums text-foreground">
                {youIsLeader
                  ? "leader"
                  : `${tooltip.youGap >= 0 ? "+" : ""}${tooltip.youGap.toLocaleString()} · #${tooltip.youRank}`}
              </span>
              {tooltip.hasPack && (
                <>
                  <span className="text-muted-foreground">Pack</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {tooltip.packLo.toLocaleString()} → {tooltip.packHi.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-t border-overlay-border bg-overlay-subtle text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] rounded" style={{ background: leaderColor }} />
          <span style={{ color: leaderColor }}>★ Leader</span>
        </span>
        {!youIsLeader && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-[2px] rounded" style={{ background: youColor }} />
            <span className="text-foreground font-semibold">You</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] rounded bg-overlay-muted-foreground" style={{ background: "var(--muted-foreground)", opacity: 0.6 }} />
          <span>Top-5 chasers</span>
        </span>
        {packIds.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-overlay-border opacity-60" />
            <span>Pack range ({packIds.length})</span>
          </span>
        )}
        {leadChangeMatches.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span style={{ color: leaderColor }}>▲</span>
            <span>{leadChangeMatches.length} lead {leadChangeMatches.length === 1 ? "change" : "changes"}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function firstName(full: string): string {
  return full.split(" ")[0] || full
}

function formatGap(v: number): string {
  if (v === 0) return "0"
  const sign = v < 0 ? "−" : "+"
  const abs = Math.abs(v)
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${sign}${abs}`
}

function niceFloor(n: number): number {
  if (n >= 0) return 0
  const abs = Math.abs(n)
  const mag = Math.pow(10, Math.floor(Math.log10(abs)))
  const norm = abs / mag
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 5) nice = 5
  else nice = 10
  return -nice * mag
}

function niceStep(n: number): number {
  if (n <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  const norm = n / mag
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 5) nice = 5
  else nice = 10
  return nice * mag
}

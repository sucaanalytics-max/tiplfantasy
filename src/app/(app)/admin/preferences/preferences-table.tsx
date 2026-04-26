"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { UserPreference } from "@/lib/analytics"

type TeamColumn = { id: string; short: string; color: string }

type Props = {
  preferences: UserPreference[]
  teamColumns: TeamColumn[]
  teamIdToColor: Record<string, string>
}

type SortKey =
  | "name"
  | "matches"
  | "WK"
  | "BAT"
  | "AR"
  | "BOWL"
  | "captain"
  | "loyalty"
  | { kind: "team"; teamId: string }

type SortDir = "asc" | "desc"

const ROLE_KEYS: Array<{ key: "WK" | "BAT" | "AR" | "BOWL"; label: string }> = [
  { key: "WK", label: "WK" },
  { key: "BAT", label: "BAT" },
  { key: "AR", label: "AR" },
  { key: "BOWL", label: "BOWL" },
]

export function UserPreferencesTable({ preferences, teamColumns, teamIdToColor }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function toggleSort(k: SortKey) {
    const sameKey =
      typeof k === "object" && typeof sortKey === "object"
        ? k.teamId === sortKey.teamId
        : k === sortKey
    if (sameKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(k)
      // Default to descending for numeric columns; ascending for name
      setSortDir(typeof k === "object" || k !== "name" ? "desc" : "asc")
    }
  }

  const rows = useMemo(() => {
    const sorted = [...preferences].sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (sortKey === "name") {
        av = a.displayName.toLowerCase()
        bv = b.displayName.toLowerCase()
      } else if (sortKey === "matches") {
        av = a.matchesPlayed
        bv = b.matchesPlayed
      } else if (sortKey === "captain") {
        av = a.topCaptain?.pct ?? -1
        bv = b.topCaptain?.pct ?? -1
      } else if (sortKey === "loyalty") {
        av = a.topPlayer?.pct ?? -1
        bv = b.topPlayer?.pct ?? -1
      } else if (typeof sortKey === "object" && sortKey.kind === "team") {
        av = a.byTeam.find((t) => t.teamId === sortKey.teamId)?.pct ?? -1
        bv = b.byTeam.find((t) => t.teamId === sortKey.teamId)?.pct ?? -1
      } else if (sortKey === "WK" || sortKey === "BAT" || sortKey === "AR" || sortKey === "BOWL") {
        av = a.byRole[sortKey]
        bv = b.byRole[sortKey]
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
    return sorted
  }, [preferences, sortKey, sortDir])

  function sortIndicator(k: SortKey) {
    const sameKey =
      typeof k === "object" && typeof sortKey === "object"
        ? k.teamId === sortKey.teamId
        : k === sortKey
    if (!sameKey) return "·"
    return sortDir === "asc" ? "▲" : "▼"
  }

  return (
    <div className="rounded-lg glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="bg-overlay-subtle border-b border-overlay-border">
              <Th sticky onClick={() => toggleSort("name")} active={sortKey === "name"}>
                User <span className="opacity-50">{sortIndicator("name")}</span>
              </Th>
              <Th onClick={() => toggleSort("matches")} active={sortKey === "matches"}>
                M <span className="opacity-50">{sortIndicator("matches")}</span>
              </Th>
              {teamColumns.map((t) => (
                <Th
                  key={t.id}
                  onClick={() => toggleSort({ kind: "team", teamId: t.id })}
                  active={typeof sortKey === "object" && sortKey.teamId === t.id}
                  align="right"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span
                      className="inline-block h-2 w-2 rounded-sm shrink-0"
                      style={{ backgroundColor: t.color }}
                      aria-hidden
                    />
                    <span className="font-bold text-foreground">{t.short}</span>
                    <span className="opacity-50">
                      {sortIndicator({ kind: "team", teamId: t.id })}
                    </span>
                  </span>
                </Th>
              ))}
              {ROLE_KEYS.map(({ key, label }) => (
                <Th
                  key={key}
                  onClick={() => toggleSort(key)}
                  active={sortKey === key}
                  align="right"
                >
                  {label} <span className="opacity-50">{sortIndicator(key)}</span>
                </Th>
              ))}
              <Th onClick={() => toggleSort("captain")} active={sortKey === "captain"}>
                Top C <span className="opacity-50">{sortIndicator("captain")}</span>
              </Th>
              <Th onClick={() => toggleSort("loyalty")} active={sortKey === "loyalty"}>
                Most-picked <span className="opacity-50">{sortIndicator("loyalty")}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.userId}
                className="border-b border-overlay-border last:border-b-0 hover:bg-overlay-subtle/50"
              >
                <Td sticky className="font-medium text-foreground whitespace-nowrap">
                  {row.displayName}
                </Td>
                <Td align="right" className="text-muted-foreground">
                  {row.matchesPlayed}
                </Td>
                {teamColumns.map((t) => {
                  const slice = row.byTeam.find((b) => b.teamId === t.id)
                  const pct = slice?.pct ?? 0
                  return (
                    <Td key={t.id} align="right">
                      <PctCell pct={pct} color={teamIdToColor[t.id] ?? "#888"} />
                    </Td>
                  )
                })}
                {ROLE_KEYS.map(({ key }) => (
                  <Td key={key} align="right" className="text-muted-foreground">
                    <RolePct pct={row.byRole[key]} />
                  </Td>
                ))}
                <Td>
                  {row.topCaptain ? (
                    <span className="whitespace-nowrap">
                      <span className="font-medium text-foreground">{row.topCaptain.name}</span>
                      <span className="text-muted-foreground ml-1">
                        ({row.topCaptain.pct}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  {row.topPlayer ? (
                    <span className="whitespace-nowrap">
                      <span className="font-medium text-foreground">{row.topPlayer.name}</span>
                      <span className="text-muted-foreground ml-1">
                        ({row.topPlayer.pct}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  align = "left",
  sticky,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  align?: "left" | "right"
  sticky?: boolean
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-2 py-2 font-semibold uppercase tracking-wider text-[10px] cursor-pointer select-none whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        sticky && "sticky left-0 bg-overlay-subtle z-10",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
      scope="col"
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = "left",
  className,
  sticky,
}: {
  children: React.ReactNode
  align?: "left" | "right"
  className?: string
  sticky?: boolean
}) {
  return (
    <td
      className={cn(
        "px-2 py-1.5",
        align === "right" ? "text-right" : "text-left",
        sticky && "sticky left-0 bg-background z-[1]",
        className
      )}
    >
      {children}
    </td>
  )
}

function PctCell({ pct, color }: { pct: number; color: string }) {
  if (pct === 0) return <span className="text-muted-foreground/40">—</span>
  // Heat by intensity: 0% -> 0 alpha, 25%+ -> full
  const alpha = Math.min(1, pct / 25)
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded font-medium"
      style={{
        color,
        backgroundColor: hexWithAlpha(color, alpha * 0.18),
      }}
    >
      {pct}
    </span>
  )
}

function RolePct({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-muted-foreground/40">—</span>
  return <span>{pct}</span>
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

"use client"

import { useMemo, useRef, useState } from "react"
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
  const [drillUserId, setDrillUserId] = useState<string | null>(null)
  const [drillTeamId, setDrillTeamId] = useState<string | null>(null)
  const drillRef = useRef<HTMLDivElement | null>(null)

  function pickUser(userId: string) {
    setDrillUserId(userId)
    if (!drillTeamId) {
      // Default to user's most-picked team for instant feedback
      const user = preferences.find((p) => p.userId === userId)
      if (user?.topTeam) setDrillTeamId(user.topTeam.teamId)
    }
    requestAnimationFrame(() => {
      drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

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
                className={cn(
                  "border-b border-overlay-border last:border-b-0 hover:bg-overlay-subtle/50",
                  drillUserId === row.userId && "bg-primary/[0.06]"
                )}
              >
                <Td sticky className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => pickUser(row.userId)}
                    className={cn(
                      "font-medium text-left hover:text-primary transition-colors cursor-pointer",
                      drillUserId === row.userId ? "text-primary" : "text-foreground"
                    )}
                    title="Click to drill down by team"
                  >
                    {row.displayName}
                  </button>
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

      <DrillDownPanel
        ref={drillRef}
        preferences={preferences}
        teamColumns={teamColumns}
        teamIdToColor={teamIdToColor}
        userId={drillUserId}
        teamId={drillTeamId}
        onUserChange={setDrillUserId}
        onTeamChange={setDrillTeamId}
      />
    </div>
  )
}

function DrillDownPanel({
  ref,
  preferences,
  teamColumns,
  teamIdToColor,
  userId,
  teamId,
  onUserChange,
  onTeamChange,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  preferences: UserPreference[]
  teamColumns: TeamColumn[]
  teamIdToColor: Record<string, string>
  userId: string | null
  teamId: string | null
  onUserChange: (id: string | null) => void
  onTeamChange: (id: string | null) => void
}) {
  const user = userId ? preferences.find((p) => p.userId === userId) ?? null : null
  const team = teamId ? teamColumns.find((t) => t.id === teamId) ?? null : null
  const players = user && teamId ? user.picksByTeam[teamId] ?? [] : []

  return (
    <div ref={ref} className="rounded-lg glass overflow-hidden mt-4">
      <div className="px-4 py-3 border-b border-overlay-border bg-overlay-subtle">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Player drill-down
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* User selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider w-12 shrink-0">
            User
          </span>
          <select
            value={userId ?? ""}
            onChange={(e) => onUserChange(e.target.value || null)}
            className="bg-overlay-subtle border border-overlay-border rounded px-2 py-1 text-sm text-foreground"
          >
            <option value="">— select user —</option>
            {preferences.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.displayName}
              </option>
            ))}
          </select>
          {user && (
            <span className="text-[11px] text-muted-foreground">
              {user.matchesPlayed} matches · {user.totalPicks} total picks
            </span>
          )}
        </div>

        {/* Team chip selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider w-12 shrink-0">
            Team
          </span>
          {teamColumns.map((t) => {
            const active = teamId === t.id
            const userTeamPickCount = user?.picksByTeam[t.id]?.length ?? 0
            const disabled = !user || userTeamPickCount === 0
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => !disabled && onTeamChange(t.id)}
                disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
                  active
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : disabled
                    ? "bg-overlay-subtle border-overlay-border text-muted-foreground/40 cursor-not-allowed"
                    : "bg-overlay-subtle border-overlay-border text-foreground hover:border-primary/30"
                )}
                title={disabled && user ? `No ${t.short} picks by ${user.displayName}` : undefined}
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm shrink-0"
                  style={{ backgroundColor: t.color }}
                  aria-hidden
                />
                {t.short}
                {user && userTeamPickCount > 0 && (
                  <span className="opacity-60 tabular-nums">{userTeamPickCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Detail table */}
        {!user ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Select a user above (or click a name in the table) to drill down.
          </p>
        ) : !team ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Select a team chip to see {user.displayName}&apos;s player picks.
          </p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {user.displayName} has not picked any {team.short} players.
          </p>
        ) : (
          <div className="rounded border border-overlay-border overflow-hidden">
            <div className="px-3 py-2 bg-overlay-subtle border-b border-overlay-border flex items-baseline gap-2">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: teamIdToColor[team.id] ?? "#888" }}
                aria-hidden
              />
              <span className="text-sm font-semibold">{team.short}</span>
              <span className="text-[11px] text-muted-foreground">
                · {user.displayName} picked {players.length} unique{" "}
                {players.length === 1 ? "player" : "players"} from {team.short}
              </span>
            </div>
            <table className="w-full text-xs tabular-nums">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-overlay-border">
                  <th className="px-3 py-2 text-left font-semibold">Player</th>
                  <th className="px-2 py-2 text-left font-semibold w-12">Role</th>
                  <th className="px-2 py-2 text-right font-semibold">Picks</th>
                  <th className="px-2 py-2 text-right font-semibold">Pick %</th>
                  <th className="px-2 py-2 text-right font-semibold">As C</th>
                  <th className="px-3 py-2 text-right font-semibold">C %</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-overlay-border last:border-b-0 hover:bg-overlay-subtle/40"
                  >
                    <td className="px-3 py-1.5 font-medium text-foreground whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{p.role}</td>
                    <td className="px-2 py-1.5 text-right font-medium">
                      {p.picks}
                      <span className="text-muted-foreground/60">/{user.matchesPlayed}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <PickPctCell pct={p.pickPct} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">
                      {p.captainCount > 0 ? p.captainCount : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {p.captainPct > 0 ? (
                        <span className="text-primary font-medium">{p.captainPct}%</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function PickPctCell({ pct }: { pct: number }) {
  // Visual bar to show pick rate within the team for this user
  const w = Math.min(100, Math.max(2, pct))
  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <span className="relative inline-block h-1.5 w-12 rounded-full bg-overlay-subtle overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 bg-primary/70 rounded-full"
          style={{ width: `${w}%` }}
        />
      </span>
      <span className="font-medium tabular-nums w-10 text-right">{pct}%</span>
    </span>
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

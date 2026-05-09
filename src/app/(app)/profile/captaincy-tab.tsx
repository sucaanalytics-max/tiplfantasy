'use client'

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { Star, Zap, Trophy, Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { SortHeader, type SortDir } from "@/components/sort-header"

export type CaptaincyRow = {
  player_id: string
  name: string
  role: string
  team_id: string | null
  cCount: number
  cBonus: number
  vcCount: number
  vcBonus: number
  total: number
}

export type CaptainStatsData = {
  rows: CaptaincyRow[]
  teams: Array<{ id: string; short_name: string; color: string | null }>
  autoPickCount: number
  avgManualScore: number
  avgAutoPickScore: number
  totalCaptainBonus: number
  totalVcBonus: number
  bestMatchCaptainBonus: number
  bestMatchVcBonus: number
}

type DerivedRow = CaptaincyRow & { avg: number; impactPct: number }

type SortKey =
  | "name"
  | "cCount"
  | "cBonus"
  | "vcCount"
  | "vcBonus"
  | "avg"
  | "total"
  | "impact"

const ROLES = ["BAT", "BOWL", "AR", "WK"] as const

const fmtInt = (n: number) => Math.round(n).toLocaleString()
const fmtPct = (n: number) => `${n.toFixed(1)}%`

export function CaptaincyTab({ stats }: { stats: CaptainStatsData }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "total", dir: "desc" })
  const [teamFilter, setTeamFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [minPicks, setMinPicks] = useState(1)

  const derived = useMemo<DerivedRow[]>(() => {
    const totalBonus = stats.rows.reduce((s, r) => s + r.total, 0)
    return stats.rows.map((r) => {
      const picks = r.cCount + r.vcCount
      return {
        ...r,
        avg: picks > 0 ? r.total / picks : 0,
        impactPct: totalBonus > 0 ? (r.total / totalBonus) * 100 : 0,
      }
    })
  }, [stats.rows])

  const filtered = useMemo(() => {
    return derived.filter((r) => {
      if (teamFilter && r.team_id !== teamFilter) return false
      if (roleFilter && r.role !== roleFilter) return false
      if (r.cCount + r.vcCount < minPicks) return false
      return true
    })
  }, [derived, teamFilter, roleFilter, minPicks])

  const sortedRows = useMemo(() => {
    const list = [...filtered]
    const dir = sort.dir === "asc" ? 1 : -1
    list.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir
        case "cCount":
          return (a.cCount - b.cCount) * dir
        case "cBonus":
          return (a.cBonus - b.cBonus) * dir
        case "vcCount":
          return (a.vcCount - b.vcCount) * dir
        case "vcBonus":
          return (a.vcBonus - b.vcBonus) * dir
        case "avg":
          return (a.avg - b.avg) * dir
        case "total":
          return (a.total - b.total) * dir
        case "impact":
          return (a.impactPct - b.impactPct) * dir
      }
    })
    return list
  }, [filtered, sort])

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: key === "name" ? "asc" : "desc" }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    })
  }

  const showAutoPickNote =
    stats.autoPickCount > 0 && (stats.avgManualScore > 0 || stats.avgAutoPickScore > 0)

  const filtersActive = teamFilter !== "" || roleFilter !== "" || minPicks > 1

  return (
    <div className="space-y-6">
      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Star}
          value={Math.round(stats.totalCaptainBonus)}
          label="Captain Bonus"
          gradient="from-amber-500/10"
          iconColor="bg-amber-500/15 text-amber-500"
        />
        <StatCard
          icon={Zap}
          value={Math.round(stats.totalVcBonus)}
          label="VC Bonus"
          gradient="from-primary/10"
          iconColor="bg-primary/15 text-primary"
        />
        <StatCard
          icon={Trophy}
          value={Math.round(stats.bestMatchCaptainBonus)}
          label="Best Captain Match"
          gradient="from-green-500/10"
          iconColor="bg-green-500/15 text-green-400"
        />
        <StatCard
          icon={Award}
          value={Math.round(stats.bestMatchVcBonus)}
          label="Best VC Match"
          gradient="from-sky-500/10"
          iconColor="bg-sky-500/15 text-sky-400"
        />
      </div>

      {/* Auto-pick comparison note */}
      {showAutoPickNote && (
        <Card className="glass border-dashed">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">
            Auto-picked{" "}
            <span className="text-foreground font-medium">{stats.autoPickCount}</span>{" "}
            time{stats.autoPickCount !== 1 ? "s" : ""} — avg{" "}
            <span
              className={cn(
                "font-medium",
                stats.avgAutoPickScore < stats.avgManualScore
                  ? "text-red-400"
                  : "text-green-400"
              )}
            >
              {stats.avgAutoPickScore.toFixed(0)} pts
            </span>{" "}
            vs{" "}
            <span className="text-foreground font-medium">
              {stats.avgManualScore.toFixed(0)} pts
            </span>{" "}
            when manual
          </CardContent>
        </Card>
      )}

      {/* Captain & VC table */}
      {stats.rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No matches played yet
        </div>
      ) : (
        <Card className="glass">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Captain &amp; VC Picks</CardTitle>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                Showing {sortedRows.length} of {stats.rows.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <FilterSelect
                label="Team"
                value={teamFilter}
                onChange={setTeamFilter}
                options={[
                  { value: "", label: "All teams" },
                  ...stats.teams.map((t) => ({ value: t.id, label: t.short_name })),
                ]}
              />
              <FilterSelect
                label="Role"
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: "", label: "All roles" },
                  ...ROLES.map((r) => ({ value: r, label: r })),
                ]}
              />
              <FilterSelect
                label="Min picks"
                value={String(minPicks)}
                onChange={(v) => setMinPicks(Number(v))}
                options={Array.from({ length: 10 }, (_, i) => ({
                  value: String(i + 1),
                  label: `≥ ${i + 1}`,
                }))}
              />
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setTeamFilter("")
                    setRoleFilter("")
                    setMinPicks(1)
                  }}
                  className="text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-overlay-subtle transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sortedRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No players match these filters.
              </div>
            ) : (
              <div className="overflow-x-auto" data-vaul-no-drag>
                <table className="w-full table-fixed text-[12px] min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="w-[32%] text-left py-2 px-3 font-medium">
                        <SortHeader
                          label="Player"
                          active={sort.key === "name"}
                          dir={sort.dir}
                          onClick={() => toggleSort("name")}
                          align="left"
                        />
                      </th>
                      <th className="w-[7%] text-right py-2 px-2 font-medium">
                        <SortHeader
                          label="C×"
                          active={sort.key === "cCount"}
                          dir={sort.dir}
                          onClick={() => toggleSort("cCount")}
                          align="right"
                        />
                      </th>
                      <th className="w-[11%] text-right py-2 px-2 font-medium">
                        <SortHeader
                          label="C Pts"
                          active={sort.key === "cBonus"}
                          dir={sort.dir}
                          onClick={() => toggleSort("cBonus")}
                          align="right"
                        />
                      </th>
                      <th className="w-[7%] text-right py-2 px-2 font-medium">
                        <SortHeader
                          label="VC×"
                          active={sort.key === "vcCount"}
                          dir={sort.dir}
                          onClick={() => toggleSort("vcCount")}
                          align="right"
                        />
                      </th>
                      <th className="w-[11%] text-right py-2 px-2 font-medium">
                        <SortHeader
                          label="VC Pts"
                          active={sort.key === "vcBonus"}
                          dir={sort.dir}
                          onClick={() => toggleSort("vcBonus")}
                          align="right"
                        />
                      </th>
                      <th className="w-[9%] text-right py-2 px-2 font-medium">
                        <SortHeader
                          label="Avg"
                          active={sort.key === "avg"}
                          dir={sort.dir}
                          onClick={() => toggleSort("avg")}
                          align="right"
                        />
                      </th>
                      <th className="w-[12%] text-right py-2 px-2 font-medium">
                        <SortHeader
                          label="Total"
                          active={sort.key === "total"}
                          dir={sort.dir}
                          onClick={() => toggleSort("total")}
                          align="right"
                        />
                      </th>
                      <th className="w-[11%] text-right py-2 px-3 font-medium">
                        <SortHeader
                          label="Impact"
                          active={sort.key === "impact"}
                          dir={sort.dir}
                          onClick={() => toggleSort("impact")}
                          align="right"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => (
                      <tr
                        key={row.player_id}
                        className={cn(
                          "border-b border-border/30 last:border-0",
                          i === 0 && "bg-amber-500/5"
                        )}
                      >
                        <td className="py-2.5 px-3 font-medium">
                          <span className="flex items-center gap-1.5 min-w-0">
                            {i === 0 && (
                              <span className="text-amber-400 shrink-0" aria-hidden>
                                ★
                              </span>
                            )}
                            <span className="truncate">{row.name}</span>
                            {row.role && (
                              <span className="ml-auto pl-1 text-[9px] uppercase tracking-wide text-muted-foreground/80 shrink-0">
                                {row.role}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-muted-foreground tabular-nums">
                          {row.cCount || "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-amber-300/90">
                          {row.cBonus ? fmtInt(row.cBonus) : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right text-muted-foreground tabular-nums">
                          {row.vcCount || "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-primary/90">
                          {row.vcBonus ? fmtInt(row.vcBonus) : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                          {row.cCount + row.vcCount > 0 ? fmtInt(row.avg) : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-display font-bold text-accent tabular-nums">
                          {fmtInt(row.total)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                          {row.total > 0 ? fmtPct(row.impactPct) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-overlay-border bg-overlay-subtle px-2 py-1 text-[11px] text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

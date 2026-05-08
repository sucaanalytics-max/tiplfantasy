"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown, Frown, Trophy, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { TeamBadge } from "@/components/team-badge"
import { cn } from "@/lib/utils"
import type { HeroRow, OwnershipInsights, RegretRow } from "@/lib/types"

type RegretMetric = "marginal" | "absolute"
type RegretSortKey =
  | "total_cost"
  | "matches_count"
  | "avg_points_when_skipped"
  | "total_absolute_miss"
  | "absolute_matches_count"
  | "avg_points_in_miss"
type HeroSortKey = "total_contribution" | "matches_count" | "captained_count"
type SortDir = "asc" | "desc"

const ROLE_COLORS: Record<string, string> = {
  WK: "bg-purple-500/15 text-purple-400",
  BAT: "bg-blue-500/15 text-blue-400",
  AR: "bg-emerald-500/15 text-emerald-400",
  BOWL: "bg-amber-500/15 text-amber-400",
}

export function OwnershipTab({ data }: { data: OwnershipInsights }) {
  const [regretMetric, setRegretMetric] = useState<RegretMetric>("marginal")
  const [heroTeamFilter, setHeroTeamFilter] = useState<string | null>(null)

  // Top regret depends on the active toggle
  const topRegret = useMemo(() => {
    if (data.regrets.length === 0) return null
    const sorted = [...data.regrets].sort((a, b) =>
      regretMetric === "marginal"
        ? b.total_cost - a.total_cost
        : b.total_absolute_miss - a.total_absolute_miss
    )
    return sorted[0]
  }, [data.regrets, regretMetric])

  // Unique teams in heroes for the chip filter
  const heroTeams = useMemo(() => {
    const seen = new Map<string, { name: string; color: string; logoUrl: string | null }>()
    for (const h of data.heroes) {
      if (!seen.has(h.team_short_name)) {
        seen.set(h.team_short_name, {
          name: h.team_short_name,
          color: h.team_color,
          logoUrl: h.team_logo_url,
        })
      }
    }
    return Array.from(seen.values())
  }, [data.heroes])

  return (
    <div className="space-y-6">
      {/* ── Header strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          icon={TrendingDown}
          value={Math.round(data.totalCost)}
          label="Marginal cost lost"
          gradient="from-red-500/10"
          iconColor="bg-red-500/15 text-red-400"
        />
        <StatCard
          icon={Trophy}
          value={data.rankOneMatchCount}
          label="#1 finishes"
          gradient="from-amber-500/10"
          iconColor="bg-amber-500/15 text-amber-500"
        />
        <StatCard
          icon={Frown}
          value={topRegret?.player_name ?? "—"}
          label={
            topRegret
              ? regretMetric === "marginal"
                ? `Top regret · ${topRegret.total_cost} pts`
                : `Biggest miss · ${topRegret.total_absolute_miss} pts`
              : "No regrets yet"
          }
          gradient="from-primary/10"
          iconColor="bg-primary/15 text-primary"
        />
      </div>

      {/* ── Explanation ──────────────────────────────────────── */}
      <Card className="glass border-dashed">
        <CardContent className="py-3 px-4 text-xs text-muted-foreground space-y-1">
          <p>
            <span className="text-foreground font-medium">Marginal</span>{" "}
            cost = a non-owned player&apos;s points minus your worst pick at the same role
            that match.{" "}
            <span className="text-foreground font-medium">Absolute</span>{" "}
            miss = raw points the player scored in matches you didn&apos;t pick them.
          </p>
          <p>
            <span className="text-foreground font-medium">Heroes</span>{" "}
            count contribution (with C/VC multipliers) only in matches where you finished
            outright #1.
          </p>
        </CardContent>
      </Card>

      {/* ── Regrets table ────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top Regrets
          </h3>
          <span className="text-2xs text-muted-foreground">
            {data.matchesAnalysed} matches analysed
          </span>
        </div>
        <MetricToggle value={regretMetric} onChange={setRegretMetric} />
        <RegretsTable rows={data.regrets} metric={regretMetric} />
      </section>

      {/* ── Heroes table ─────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Heroes in #1 Finishes
          </h3>
          <span className="text-2xs text-muted-foreground">
            {data.rankOneMatchCount} match{data.rankOneMatchCount === 1 ? "" : "es"}
          </span>
        </div>
        {data.rankOneMatchCount === 0 ? (
          <Card className="glass">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No outright wins yet — come back after a top finish.
            </CardContent>
          </Card>
        ) : (
          <>
            {heroTeams.length > 1 && (
              <TeamChipRow
                teams={heroTeams}
                active={heroTeamFilter}
                onChange={setHeroTeamFilter}
              />
            )}
            <HeroesTable rows={data.heroes} teamFilter={heroTeamFilter} />
          </>
        )}
      </section>
    </div>
  )
}

// ============================================================
// Regrets table
// ============================================================

function RegretsTable({
  rows,
  metric,
}: {
  rows: RegretRow[]
  metric: RegretMetric
}) {
  const isMarginal = metric === "marginal"
  const totalKey: RegretSortKey = isMarginal ? "total_cost" : "total_absolute_miss"
  const matchesKey: RegretSortKey = isMarginal
    ? "matches_count"
    : "absolute_matches_count"
  const avgKey: RegretSortKey = isMarginal
    ? "avg_points_when_skipped"
    : "avg_points_in_miss"

  const [sortKey, setSortKey] = useState<RegretSortKey>(totalKey)
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Reset sort to the active metric's primary column when toggling
  const activeSortKey = useMemo(() => {
    const validKeys: RegretSortKey[] = isMarginal
      ? ["total_cost", "matches_count", "avg_points_when_skipped"]
      : ["total_absolute_miss", "absolute_matches_count", "avg_points_in_miss"]
    return validKeys.includes(sortKey) ? sortKey : totalKey
  }, [sortKey, isMarginal, totalKey])

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    // Filter out rows that have nothing in the active metric
    const filtered = rows.filter((r) =>
      isMarginal ? r.total_cost > 0 : r.total_absolute_miss > 0
    )
    return filtered
      .sort((a, b) => (a[activeSortKey] - b[activeSortKey]) * dir)
      .slice(0, 15)
  }, [rows, activeSortKey, sortDir, isMarginal])

  const handleSort = (key: RegretSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (sorted.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No regrets yet — your picks held up against the field.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-2xl border border-overlay-border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2rem_1fr_3rem_3.2rem] md:grid-cols-[2rem_1fr_5rem_4rem_3.5rem_4rem] gap-2 items-center px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground border-b border-overlay-border bg-overlay-subtle">
        <span>#</span>
        <span>Player</span>
        <span className="hidden md:block">Team</span>
        <SortHeader<RegretSortKey>
          label="M"
          k={matchesKey}
          sortKey={activeSortKey}
          sortDir={sortDir}
          onClick={handleSort}
          align="right"
        />
        <span className="hidden md:block text-right">Avg</span>
        <SortHeader<RegretSortKey>
          label={isMarginal ? "Cost" : "Miss"}
          k={totalKey}
          sortKey={activeSortKey}
          sortDir={sortDir}
          onClick={handleSort}
          align="right"
        />
      </div>

      <div className="divide-y divide-overlay-border">
        {sorted.map((row, idx) => {
          const expanded = expandedId === row.player_id
          const totalValue = isMarginal ? row.total_cost : row.total_absolute_miss
          const matchesValue = isMarginal
            ? row.matches_count
            : row.absolute_matches_count
          const avgValue = isMarginal
            ? row.avg_points_when_skipped
            : row.avg_points_in_miss
          return (
            <div key={row.player_id}>
              <button
                type="button"
                onClick={() =>
                  setExpandedId(expanded ? null : row.player_id)
                }
                className="w-full grid grid-cols-[2rem_1fr_3rem_3.2rem] md:grid-cols-[2rem_1fr_5rem_4rem_3.5rem_4rem] gap-2 items-center px-3 py-2.5 text-sm text-left min-h-[44px] hover:bg-overlay-subtle/40 transition-colors"
              >
                <span className="text-muted-foreground tabular-nums font-mono text-xs">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded",
                      ROLE_COLORS[row.player_role] ?? "bg-muted text-foreground"
                    )}
                  >
                    {row.player_role}
                  </span>
                  <span className="truncate font-medium">{row.player_name}</span>
                </div>
                <span className="hidden md:block text-xs text-muted-foreground truncate">
                  {row.team_short_name}
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {matchesValue}
                </span>
                <span className="hidden md:block text-right text-xs text-muted-foreground tabular-nums">
                  {avgValue}
                </span>
                <span className="text-right text-base text-red-400 font-bold tabular-nums">
                  {totalValue}
                </span>
              </button>

              {expanded && (
                <div className="px-4 pb-3 -mt-1 text-xs text-muted-foreground space-y-0.5">
                  {isMarginal && row.worst_match && (
                    <p>
                      Worst miss:{" "}
                      <span className="text-foreground font-medium">
                        M{row.worst_match.match_number}
                      </span>{" "}
                      ({row.worst_match.matchup}) — cost{" "}
                      <span className="text-red-400 font-bold">
                        {row.worst_match.cost} pts
                      </span>
                    </p>
                  )}
                  {!isMarginal && row.best_absolute_match && (
                    <p>
                      Biggest miss:{" "}
                      <span className="text-foreground font-medium">
                        M{row.best_absolute_match.match_number}
                      </span>{" "}
                      ({row.best_absolute_match.matchup}) — they scored{" "}
                      <span className="text-red-400 font-bold">
                        {row.best_absolute_match.points} pts
                      </span>
                    </p>
                  )}
                  <p className="md:hidden">
                    Avg {isMarginal ? "when skipped" : "per miss"}: {avgValue} pts ·{" "}
                    {row.team_short_name}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Heroes table
// ============================================================

function HeroesTable({
  rows,
  teamFilter,
}: {
  rows: HeroRow[]
  teamFilter: string | null
}) {
  const [sortKey, setSortKey] = useState<HeroSortKey>("total_contribution")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    const filtered = teamFilter
      ? rows.filter((r) => r.team_short_name === teamFilter)
      : rows
    return [...filtered].sort((a, b) => (a[sortKey] - b[sortKey]) * dir)
  }, [rows, sortKey, sortDir, teamFilter])

  const handleSort = (key: HeroSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (sorted.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {teamFilter
            ? `No heroes from ${teamFilter} yet.`
            : "No heroes recorded yet."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-2xl border border-overlay-border bg-card overflow-hidden">
      <div className="grid grid-cols-[2rem_1fr_3rem_3.5rem] md:grid-cols-[2rem_1fr_5rem_4rem_4rem_4.5rem] gap-2 items-center px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground border-b border-overlay-border bg-overlay-subtle">
        <span>#</span>
        <span>Player</span>
        <span className="hidden md:block">Team</span>
        <SortHeader<HeroSortKey>
          label="M"
          k="matches_count"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={handleSort}
          align="right"
        />
        <SortHeader<HeroSortKey>
          label="C"
          k="captained_count"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={handleSort}
          align="right"
          hideOnMobile
        />
        <SortHeader<HeroSortKey>
          label="Pts"
          k="total_contribution"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={handleSort}
          align="right"
        />
      </div>

      <div className="divide-y divide-overlay-border">
        {sorted.map((row, idx) => {
          const expanded = expandedId === row.player_id
          return (
            <div key={row.player_id}>
              <button
                type="button"
                onClick={() =>
                  setExpandedId(expanded ? null : row.player_id)
                }
                className="w-full grid grid-cols-[2rem_1fr_3rem_3.5rem] md:grid-cols-[2rem_1fr_5rem_4rem_4rem_4.5rem] gap-2 items-center px-3 py-2.5 text-sm text-left min-h-[44px] hover:bg-overlay-subtle/40 transition-colors"
              >
                <span className="text-muted-foreground tabular-nums font-mono text-xs">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded",
                      ROLE_COLORS[row.player_role] ?? "bg-muted text-foreground"
                    )}
                  >
                    {row.player_role}
                  </span>
                  <span className="truncate font-medium">{row.player_name}</span>
                  {row.captained_count > 0 && (
                    <span className="md:hidden shrink-0 text-[9px] font-bold text-[var(--captain-gold)]">
                      C×{row.captained_count}
                    </span>
                  )}
                </div>
                <span className="hidden md:block text-xs text-muted-foreground truncate">
                  {row.team_short_name}
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {row.matches_count}
                </span>
                <span className="hidden md:block text-right text-xs text-[var(--captain-gold)] tabular-nums">
                  {row.captained_count > 0 ? `×${row.captained_count}` : "—"}
                </span>
                <span className="text-right text-base text-emerald-400 font-bold tabular-nums">
                  {row.total_contribution}
                </span>
              </button>

              {expanded && row.best_match && (
                <div className="px-4 pb-3 -mt-1 text-xs text-muted-foreground space-y-0.5">
                  <p>
                    Best night:{" "}
                    <span className="text-foreground font-medium">
                      M{row.best_match.match_number}
                    </span>{" "}
                    ({row.best_match.matchup}) — contributed{" "}
                    <span className="text-emerald-400 font-bold">
                      {row.best_match.contribution} pts
                    </span>
                  </p>
                  <p>
                    Captained: {row.captained_count}× · VC: {row.vc_count}× ·{" "}
                    {row.team_short_name}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Regrets metric toggle
// ============================================================

function MetricToggle({
  value,
  onChange,
}: {
  value: RegretMetric
  onChange: (next: RegretMetric) => void
}) {
  const options: { key: RegretMetric; label: string; sub: string }[] = [
    { key: "marginal", label: "Marginal cost", sub: "vs your worst pick" },
    { key: "absolute", label: "Absolute miss", sub: "raw points missed" },
  ]
  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-overlay-subtle border border-overlay-border">
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center justify-center text-center px-3 py-2 rounded-lg min-h-[44px] transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-xs font-semibold">{opt.label}</span>
            <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Heroes team filter chip row
// ============================================================

function TeamChipRow({
  teams,
  active,
  onChange,
}: {
  teams: { name: string; color: string; logoUrl: string | null }[]
  active: string | null
  onChange: (next: string | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={active === null}
        className={cn(
          "shrink-0 h-9 px-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors min-w-[44px]",
          active === null
            ? "bg-foreground text-background"
            : "bg-overlay-subtle text-muted-foreground hover:text-foreground border border-overlay-border"
        )}
      >
        All
      </button>
      {teams.map((t) => {
        const isActive = active === t.name
        return (
          <button
            key={t.name}
            type="button"
            onClick={() => onChange(isActive ? null : t.name)}
            aria-pressed={isActive}
            className={cn(
              "shrink-0 rounded-full p-0.5 transition-all",
              isActive
                ? "ring-2 ring-foreground/80 scale-105"
                : "opacity-70 hover:opacity-100"
            )}
          >
            <TeamBadge
              shortName={t.name}
              color={t.color}
              logoUrl={t.logoUrl}
              size="sm"
            />
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Sortable header cell
// ============================================================

function SortHeader<K extends string>({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align,
  hideOnMobile = false,
}: {
  label: string
  k: K
  sortKey: K
  sortDir: SortDir
  onClick: (k: K) => void
  align: "left" | "right"
  hideOnMobile?: boolean
}) {
  const active = sortKey === k
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className={cn(
        "inline-flex items-center gap-0.5 transition-colors",
        active ? "text-foreground" : "hover:text-foreground",
        align === "right" && "justify-end ml-auto",
        hideOnMobile && "hidden md:inline-flex"
      )}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="uppercase tracking-widest">{label}</span>
      <Icon className="h-2.5 w-2.5 opacity-60" />
    </button>
  )
}

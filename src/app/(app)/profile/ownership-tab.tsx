"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown, Frown, Trophy, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { cn } from "@/lib/utils"
import type { HeroRow, OwnershipInsights, RegretRow } from "@/lib/types"

type RegretSortKey = "total_cost" | "matches_count" | "avg_points_when_skipped"
type HeroSortKey = "total_contribution" | "matches_count" | "captained_count"
type SortDir = "asc" | "desc"

const ROLE_COLORS: Record<string, string> = {
  WK: "bg-purple-500/15 text-purple-400",
  BAT: "bg-blue-500/15 text-blue-400",
  AR: "bg-emerald-500/15 text-emerald-400",
  BOWL: "bg-amber-500/15 text-amber-400",
}

export function OwnershipTab({ data }: { data: OwnershipInsights }) {
  const topHero = data.heroes[0] ?? null
  const topRegret = data.regrets[0] ?? null

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
          label={topRegret ? `Top regret · ${topRegret.total_cost} pts` : "No regrets yet"}
          gradient="from-primary/10"
          iconColor="bg-primary/15 text-primary"
        />
      </div>

      {/* ── Explanation ──────────────────────────────────────── */}
      <Card className="glass border-dashed">
        <CardContent className="py-3 px-4 text-xs text-muted-foreground space-y-1">
          <p>
            <span className="text-foreground font-medium">Regrets</span>{" "}
            measure marginal cost: a non-owned player&apos;s points minus the worst pick
            you made at the same role that match. Bigger gaps = a swap that would have
            mattered.
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
        <RegretsTable rows={data.regrets} />
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
          <HeroesTable rows={data.heroes} />
        )}
      </section>
    </div>
  )
}

// ============================================================
// Regrets table
// ============================================================

function RegretsTable({ rows }: { rows: RegretRow[] }) {
  const [sortKey, setSortKey] = useState<RegretSortKey>("total_cost")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * dir)
  }, [rows, sortKey, sortDir])

  const handleSort = (key: RegretSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (rows.length === 0) {
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
          k="matches_count"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={handleSort}
          align="right"
        />
        <span className="hidden md:block text-right">Avg</span>
        <SortHeader<RegretSortKey>
          label="Cost"
          k="total_cost"
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
                  {row.matches_count}
                </span>
                <span className="hidden md:block text-right text-xs text-muted-foreground tabular-nums">
                  {row.avg_points_when_skipped}
                </span>
                <span className="text-right text-base text-red-400 font-bold tabular-nums">
                  {row.total_cost}
                </span>
              </button>

              {expanded && row.worst_match && (
                <div className="px-4 pb-3 -mt-1 text-xs text-muted-foreground space-y-0.5">
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
                  <p className="md:hidden">
                    Avg when skipped: {row.avg_points_when_skipped} pts ·{" "}
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

function HeroesTable({ rows }: { rows: HeroRow[] }) {
  const [sortKey, setSortKey] = useState<HeroSortKey>("total_contribution")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * dir)
  }, [rows, sortKey, sortDir])

  const handleSort = (key: HeroSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No heroes recorded yet.
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

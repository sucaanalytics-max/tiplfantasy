"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SortHeader, type SortDir } from "@/components/sort-header"
import { cn } from "@/lib/utils"
import type {
  H2HCompareResult,
  H2HPlayerRow,
  ProfileOption,
} from "@/actions/h2h-compare"

type SortKey =
  | "player_name"
  | "matches_on_scorecard"
  | "a_matches_picked"
  | "a_captain_count"
  | "a_vc_count"
  | "a_eo_pct"
  | "a_contribution"
  | "b_matches_picked"
  | "b_captain_count"
  | "b_vc_count"
  | "b_eo_pct"
  | "b_contribution"
  | "net_edge"

export function H2HClient({
  result,
  profiles,
  aId,
  bId,
}: {
  result: H2HCompareResult
  profiles: ProfileOption[]
  aId: string
  bId: string
}) {
  const router = useRouter()
  const [a, setA] = useState(aId)
  const [b, setB] = useState(bId)

  const [sortKey, setSortKey] = useState<SortKey>("net_edge")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir(key === "player_name" ? "asc" : "desc")
    }
  }

  const sortedRows = useMemo(() => {
    const rows = [...result.players]
    rows.sort((x, y) => {
      const av = x[sortKey]
      const bv = y[sortKey]
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      const an = Number(av)
      const bn = Number(bv)
      return sortDir === "asc" ? an - bn : bn - an
    })
    return rows
  }, [result.players, sortKey, sortDir])

  function applyCompare() {
    if (!a || !b || a === b) return
    router.push(`/admin/h2h?a=${a}&b=${b}`)
  }

  const gap = result.a_user.season_total - result.b_user.season_total
  const sumEdge = result.total_edge
  const sanityDelta = sumEdge - gap

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Head-to-Head</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Per-player edge between two users across the season. Captain/VC
          multipliers rolled into each player's contribution.
        </p>
      </div>

      {/* ── Selectors ─────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-3 flex flex-wrap items-end gap-3">
        <UserSelect label="User A" value={a} onChange={setA} options={profiles} />
        <span className="text-muted-foreground pb-2">vs</span>
        <UserSelect label="User B" value={b} onChange={setB} options={profiles} />
        <button
          type="button"
          onClick={applyCompare}
          disabled={!a || !b || a === b || (a === aId && b === bId)}
          className="ml-auto text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Compare
        </button>
      </div>

      {/* ── Summary cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label={result.a_user.display_name}
          value={result.a_user.season_total.toLocaleString()}
          sub="season total"
        />
        <SummaryCard
          label={result.b_user.display_name}
          value={result.b_user.season_total.toLocaleString()}
          sub="season total"
        />
        <SummaryCard
          label="Gap (A − B)"
          value={signed(gap)}
          sub={`${result.matches_compared} matches compared`}
          tone={gap > 0 ? "good" : gap < 0 ? "bad" : "neutral"}
        />
        <SummaryCard
          label="Σ net_edge"
          value={signed(sumEdge)}
          sub={
            sanityDelta === 0
              ? "matches gap exactly"
              : `off by ${signed(sanityDelta)}`
          }
          tone={sanityDelta === 0 ? "good" : "warn"}
        />
      </div>

      {/* ── Player table ──────────────────────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2 text-left font-medium sticky left-0 bg-overlay-subtle z-10">
                  <SortHeader
                    label="Player"
                    active={sortKey === "player_name"}
                    dir={sortDir}
                    onClick={() => toggleSort("player_name")}
                  />
                </th>
                <th className="px-2 py-2 text-center font-medium">
                  <SortHeader
                    label="On Card"
                    align="center"
                    active={sortKey === "matches_on_scorecard"}
                    dir={sortDir}
                    onClick={() => toggleSort("matches_on_scorecard")}
                  />
                </th>
                <ColGroup label={`${result.a_user.display_name} (A)`} span={5} />
                <ColGroup label={`${result.b_user.display_name} (B)`} span={5} />
                <th className="px-2 py-2 text-right font-medium">
                  <SortHeader
                    label="Net Edge"
                    align="right"
                    active={sortKey === "net_edge"}
                    dir={sortDir}
                    onClick={() => toggleSort("net_edge")}
                  />
                </th>
              </tr>
              <tr className="border-b border-overlay-border bg-overlay-subtle/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th />
                <th />
                <NumHeader k="a_matches_picked" label="Picks" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="a_captain_count" label="C" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="a_vc_count" label="VC" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="a_eo_pct" label="EO%" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="a_contribution" label="Pts" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="b_matches_picked" label="Picks" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="b_captain_count" label="C" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="b_vc_count" label="VC" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="b_eo_pct" label="EO%" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <NumHeader k="b_contribution" label="Pts" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-overlay-border">
              {sortedRows.map((r) => (
                <PlayerRow key={r.player_id} r={r} />
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    No data — pick two different users with selections.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground px-1">
        EO% = (Σ multiplier across matches the player appeared in) / appearances ×
        100. A player captained every appearance is 200%. Net Edge = A's
        contribution − B's contribution, with C=2×, VC=1.5×.
      </p>
    </div>
  )
}

function UserSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: ProfileOption[]
}) {
  return (
    <label className="text-xs flex flex-col gap-1">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-overlay-subtle border border-overlay-border rounded-md px-2 py-1.5 text-sm min-w-[160px]"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.display_name}
          </option>
        ))}
      </select>
    </label>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string
  value: string
  sub?: string
  tone?: "good" | "bad" | "warn" | "neutral"
}) {
  const valueTone =
    tone === "good"
      ? "text-emerald-500"
      : tone === "bad"
      ? "text-rose-500"
      : tone === "warn"
      ? "text-amber-500"
      : ""
  return (
    <div className="glass rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums mt-1", valueTone)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function ColGroup({ label, span }: { label: string; span: number }) {
  return (
    <th
      colSpan={span}
      className="px-2 py-2 text-center font-medium border-l border-overlay-border"
    >
      <span className="truncate inline-block max-w-[160px]">{label}</span>
    </th>
  )
}

function NumHeader({
  k,
  label,
  sortKey,
  sortDir,
  toggle,
}: {
  k: SortKey
  label: string
  sortKey: SortKey
  sortDir: SortDir
  toggle: (k: SortKey) => void
}) {
  return (
    <th className="px-2 py-2 text-right font-medium">
      <SortHeader
        label={label}
        align="right"
        active={sortKey === k}
        dir={sortDir}
        onClick={() => toggle(k)}
      />
    </th>
  )
}

function PlayerRow({ r }: { r: H2HPlayerRow }) {
  const edgeClass =
    r.net_edge > 0
      ? "text-emerald-500"
      : r.net_edge < 0
      ? "text-rose-500"
      : "text-muted-foreground"

  return (
    <tr className="hover:bg-overlay-subtle/50">
      <td className="px-2 py-1.5 sticky left-0 bg-background z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block w-1.5 h-3 rounded-sm shrink-0"
            style={{ background: r.team_color }}
            aria-hidden
          />
          <span className="font-medium truncate">{r.player_name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {r.player_role} · {r.team_short_name}
          </span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
        {r.matches_on_scorecard}
      </td>

      <Cell n={r.a_matches_picked} mute={r.a_matches_picked === 0} />
      <Cell n={r.a_captain_count} mute={r.a_captain_count === 0} />
      <Cell n={r.a_vc_count} mute={r.a_vc_count === 0} />
      <Cell n={r.a_eo_pct} pct mute={r.a_matches_picked === 0} />
      <Cell n={r.a_contribution} mute={r.a_contribution === 0} bold />

      <Cell n={r.b_matches_picked} mute={r.b_matches_picked === 0} />
      <Cell n={r.b_captain_count} mute={r.b_captain_count === 0} />
      <Cell n={r.b_vc_count} mute={r.b_vc_count === 0} />
      <Cell n={r.b_eo_pct} pct mute={r.b_matches_picked === 0} />
      <Cell n={r.b_contribution} mute={r.b_contribution === 0} bold />

      <td className={cn("px-2 py-1.5 text-right tabular-nums font-semibold", edgeClass)}>
        {signed(r.net_edge)}
      </td>
    </tr>
  )
}

function Cell({
  n,
  pct,
  mute,
  bold,
}: {
  n: number
  pct?: boolean
  mute?: boolean
  bold?: boolean
}) {
  return (
    <td
      className={cn(
        "px-2 py-1.5 text-right tabular-nums",
        mute && "text-muted-foreground/60",
        bold && !mute && "font-semibold"
      )}
    >
      {pct ? `${n.toFixed(1)}%` : n.toLocaleString()}
    </td>
  )
}

function signed(n: number): string {
  if (n === 0) return "0"
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString()
}

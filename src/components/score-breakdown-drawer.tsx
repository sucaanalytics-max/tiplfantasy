"use client"

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { PlayerHeadshot } from "@/components/player-headshot"
import { CaptainPill } from "@/components/captain-overlay"
import { Badge } from "@/components/ui/badge"
import { ROLE_COLORS } from "@/lib/badges"
import { cn } from "@/lib/utils"
import type { PlayerRole } from "@/lib/types"
import type { PlayerScoreRow } from "@/app/(app)/match/[id]/scores/scores-client"

type Player = PlayerScoreRow["player"]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The player score row whose breakdown to display. */
  row: (PlayerScoreRow & { isC?: boolean; isVC?: boolean; mult?: number; effective?: number }) | null
}

/**
 * Per-player point-by-point scoring breakdown. Reads PlayerScoreRow.breakdown
 * (a Record<rule_name, points> populated by lib/scoring.ts) and groups lines
 * into Batting / Bowling / Fielding / Bonus sections, each row showing a
 * human-readable label, the underlying count where applicable, and the
 * points awarded.
 *
 * Captain (×2) / Vice (×1.5) multipliers, when present, are applied to the
 * subtotal as an explicit line so users can see the boost they earned.
 */
export function ScoreBreakdownDrawer({ open, onOpenChange, row }: Props) {
  if (!row) return null
  const player = row.player
  const baseTotal = Number(row.fantasy_points)
  const mult = row.mult ?? 1
  const effective = row.effective ?? baseTotal
  const isC = row.isC ?? false
  const isVC = row.isVC ?? false

  const groups = buildBreakdownGroups(row)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-center gap-3">
            <PlayerHeadshot player={player} size="xl" ring="team" shadow />
            <div className="min-w-0 flex-1">
              <DrawerTitle className="font-display text-xl font-bold leading-tight truncate">
                {player.name}
              </DrawerTitle>
              <DrawerDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 leading-none", ROLE_COLORS[player.role as PlayerRole])}>
                  {player.role}
                </Badge>
                <span className="font-semibold text-xs" style={{ color: player.team.color }}>
                  {player.team.short_name}
                </span>
                {(isC || isVC) && (
                  <CaptainPill variant={isC ? "captain" : "vice"} size="sm" />
                )}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto" data-vaul-no-drag>
          {/* Section list */}
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No scoring breakdown available for this match.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <BreakdownSection key={g.label} group={g} />
              ))}
            </div>
          )}

          {/* Totals — always shown if breakdown exists */}
          {groups.length > 0 && (
            <div className="mt-5 rounded-xl glass-subtle p-3 space-y-1.5">
              <Row label="Subtotal" value={baseTotal} muted />
              {mult > 1 && (
                <>
                  <Row
                    label={`${isC ? "Captain" : "Vice-captain"} × ${mult}`}
                    value={Math.round(effective - baseTotal)}
                    accent
                  />
                  <div className="h-px bg-overlay-border my-1.5" />
                </>
              )}
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Total
                </span>
                <span className="text-score text-foreground">
                  {Math.round(effective)}
                  <span className="text-xs text-muted-foreground font-normal ml-1">pts</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Breakdown structure — labels, ordering, count-from-stat sourcing
// ───────────────────────────────────────────────────────────────────────────

type BreakdownLine = {
  /** Rule key (e.g. "run", "four_bonus") */
  key: string
  /** Display label (e.g. "Runs", "Boundaries") */
  label: string
  /** Numeric count (e.g. 52 runs, 4 fours) — null when not applicable */
  count: number | null
  /** Points awarded for this line (positive or negative) */
  points: number
}

type BreakdownGroup = {
  label: string
  lines: BreakdownLine[]
  subtotal: number
}

const BATTING_KEYS = [
  "run", "four_bonus", "six_bonus",
  "thirty", "half_century", "century",
  "duck",
  "sr_above_170", "sr_150_170", "sr_70_80", "sr_below_70",
]
const BOWLING_KEYS = [
  "wicket", "maiden",
  "three_wicket_haul", "four_wicket_haul", "five_wicket_haul",
  "econ_below_5", "econ_5_6", "econ_10_11", "econ_above_11",
]
const FIELDING_KEYS = ["catch", "stumping", "run_out", "three_catch_bonus"]
const BONUS_KEYS = ["playing_xi_bonus"]

const LABEL: Record<string, string> = {
  run: "Runs",
  four_bonus: "Boundaries",
  six_bonus: "Sixes",
  thirty: "30+ runs",
  half_century: "Half-century",
  century: "Century",
  duck: "Duck",
  sr_above_170: "Strike rate ≥ 170",
  sr_150_170: "Strike rate 150–170",
  sr_70_80: "Strike rate 70–80",
  sr_below_70: "Strike rate < 70",
  wicket: "Wickets",
  maiden: "Maidens",
  three_wicket_haul: "3-wicket haul",
  four_wicket_haul: "4-wicket haul",
  five_wicket_haul: "5-wicket haul",
  econ_below_5: "Economy ≤ 5.0",
  econ_5_6: "Economy 5.0–6.0",
  econ_10_11: "Economy 10–11",
  econ_above_11: "Economy > 11",
  catch: "Catches",
  stumping: "Stumpings",
  run_out: "Run-outs",
  three_catch_bonus: "3+ catches",
  playing_xi_bonus: "Playing XI",
}

function countForKey(key: string, row: PlayerScoreRow): number | null {
  switch (key) {
    case "run": return row.runs
    case "four_bonus": return row.fours
    case "six_bonus": return row.sixes
    case "wicket": return row.wickets
    case "maiden": return row.maidens
    case "catch": return row.catches
    case "stumping": return row.stumpings
    case "run_out": return row.run_outs
    default: return null // milestones, sr/econ bands, bonuses are 1× by nature
  }
}

function buildBreakdownGroups(row: PlayerScoreRow): BreakdownGroup[] {
  const breakdown = row.breakdown
  if (!breakdown) return []

  const buildGroup = (label: string, keys: string[]): BreakdownGroup => {
    const lines: BreakdownLine[] = []
    let subtotal = 0
    for (const key of keys) {
      const points = breakdown[key]
      if (points === undefined || points === null || points === 0) continue
      lines.push({
        key,
        label: LABEL[key] ?? key,
        count: countForKey(key, row),
        points,
      })
      subtotal += points
    }
    return { label, lines, subtotal }
  }

  const groups = [
    buildGroup("Batting", BATTING_KEYS),
    buildGroup("Bowling", BOWLING_KEYS),
    buildGroup("Fielding", FIELDING_KEYS),
    buildGroup("Bonus", BONUS_KEYS),
  ]
  return groups.filter((g) => g.lines.length > 0)
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function BreakdownSection({ group }: { group: BreakdownGroup }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {group.label}
        </h3>
        <span className="text-xs tabular-nums font-display font-bold text-foreground/70">
          {group.subtotal > 0 ? "+" : ""}{group.subtotal}
        </span>
      </div>
      <div className="rounded-xl border border-overlay-border bg-overlay-subtle/40 divide-y divide-overlay-border">
        {group.lines.map((line) => (
          <div key={line.key} className="flex items-baseline justify-between px-3 py-2 text-sm">
            <span className="text-foreground">
              {line.label}
              {line.count != null && line.count > 1 && (
                <span className="text-muted-foreground/70 ml-1.5 tabular-nums">({line.count})</span>
              )}
            </span>
            <span className={cn("tabular-nums font-display font-semibold text-sm", line.points < 0 ? "text-status-danger" : "text-foreground")}>
              {line.points > 0 ? "+" : ""}{line.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value, muted, accent }: { label: string; value: number; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={cn("tracking-wide", muted ? "text-muted-foreground" : accent ? "text-accent font-semibold" : "text-foreground")}>
        {label}
      </span>
      <span className={cn("tabular-nums font-display font-bold", accent ? "text-accent" : "text-foreground")}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  )
}

// Re-export the player type for callers
export type { Player }

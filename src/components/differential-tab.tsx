"use client"

import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { DifferentialPickRow, DifferentialSummaryRow } from "@/lib/types"

interface Props {
  picks: DifferentialPickRow[]
  summary: DifferentialSummaryRow[]
  currentUserId: string
  userNames: Record<string, string>
}

const CATEGORY_CONFIG = {
  gem:        { label: "💎 Gem",       className: "text-amber-500 bg-amber-500/10" },
  "paid-off": { label: "✅ Paid Off",  className: "text-emerald-500 bg-emerald-500/10" },
  backfired:  { label: "❌ Backfired", className: "text-rose-400 bg-rose-400/10" },
}

// ── Differential summary leaderboard ──────────────────────────────────────────

function DiffLeaderboard({ summary, currentUserId }: { summary: DifferentialSummaryRow[]; currentUserId: string }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3">
          <span>Player</span>
          <span className="text-right">Diff Score</span>
          <span className="text-right hidden sm:block">Unique Pts</span>
          <span className="text-right">Avg Own.</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {summary.map((row, i) => {
          const isMe = row.user_id === currentUserId
          return (
            <div
              key={row.user_id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5",
                isMe && "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--primary)]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-4 tabular-nums shrink-0">{i + 1}</span>
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold", getAvatarColor(row.display_name))}>
                  {getInitials(row.display_name)}
                </div>
                <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                  {row.display_name}{isMe && " (you)"}
                </span>
              </div>
              <span className={cn("text-sm tabular-nums text-right font-semibold", row.differential_score >= 0 ? "text-gold-stat" : "text-rose-400")}>
                {row.differential_score >= 0 ? "+" : ""}{row.differential_score}
              </span>
              <span className="hidden sm:block text-xs tabular-nums text-right text-muted-foreground">{row.unique_pick_pts}</span>
              <span className="text-xs tabular-nums text-right text-muted-foreground">{row.avg_ownership.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Category breakdown — all users, gem/paid/bust counts ──────────────────────

function CategoryBreakdown({ picks, summary, currentUserId }: { picks: DifferentialPickRow[]; summary: DifferentialSummaryRow[]; currentUserId: string }) {
  const counts = new Map<string, { gem: number; paid: number; backfired: number }>()
  for (const p of picks) {
    if (!counts.has(p.user_id)) counts.set(p.user_id, { gem: 0, paid: 0, backfired: 0 })
    const c = counts.get(p.user_id)!
    if (p.category === "gem") c.gem++
    else if (p.category === "paid-off") c.paid++
    else if (p.category === "backfired") c.backfired++
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3">
          <span>Player</span>
          <span className="text-right">💎 Gems</span>
          <span className="text-right">✅ Paid</span>
          <span className="text-right">❌ Busts</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {summary.map((row) => {
          const isMe = row.user_id === currentUserId
          const c = counts.get(row.user_id) ?? { gem: 0, paid: 0, backfired: 0 }
          return (
            <div
              key={row.user_id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5",
                isMe && "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--primary)]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold", getAvatarColor(row.display_name))}>
                  {getInitials(row.display_name)}
                </div>
                <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                  {row.display_name}{isMe && " (you)"}
                </span>
              </div>
              <span className="text-right tabular-nums text-xs text-amber-500 font-semibold">{c.gem}</span>
              <span className="text-right tabular-nums text-xs text-emerald-500 font-semibold">{c.paid}</span>
              <span className="text-right tabular-nums text-xs text-rose-400">{c.backfired}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Your top-10 unique picks ──────────────────────────────────────────────────

function TopPicks({ picks, currentUserId }: { picks: DifferentialPickRow[]; currentUserId: string }) {
  const myPicks = picks
    .filter((p) => p.user_id === currentUserId && p.ownership_count <= 3)
    .sort((a, b) => b.user_pts - a.user_pts)
    .slice(0, 10)

  if (myPicks.length === 0) return null

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <span>Player · Match</span>
          <span className="text-right">Pts</span>
          <span className="text-right">Owned</span>
          <span className="text-right">Cat.</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {myPicks.map((pick) => {
          const catCfg = pick.category ? CATEGORY_CONFIG[pick.category] : null
          return (
            <div key={`${pick.match_id}:${pick.player_id}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {pick.player_name}
                  {pick.is_captain && <span className="ml-1 text-[var(--captain-gold)] text-[9px]">(C)</span>}
                  {pick.is_vc && <span className="ml-1 text-primary/80 text-[9px]">(VC)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">{pick.matchup} · M{pick.match_number}</p>
              </div>
              <span className="tabular-nums text-right font-semibold">{pick.user_pts}</span>
              <span className="tabular-nums text-right text-muted-foreground">{pick.ownership_count}/{pick.total_users}</span>
              {catCfg ? (
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", catCfg.className)}>{catCfg.label}</span>
              ) : (
                <span className="text-muted-foreground/30">—</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Herd traps ──────────────────────────────────────────────────────────────────

function HerdTraps({ picks }: { picks: DifferentialPickRow[] }) {
  const traps = picks
    .filter((p, i, arr) => {
      return (
        p.ownership_count >= Math.ceil(p.total_users * 0.6) &&
        p.user_pts < 20 &&
        arr.findIndex((x) => x.match_id === p.match_id && x.player_id === p.player_id) === i
      )
    })
    .sort((a, b) => b.ownership_count - a.ownership_count || a.user_pts - b.user_pts)
    .slice(0, 10)

  if (traps.length === 0) return null

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3">
          <span>#</span>
          <span>Player · Match</span>
          <span className="text-right">Owned</span>
          <span className="text-right">Pts</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {traps.map((trap, i) => (
          <div key={`${trap.match_id}:${trap.player_id}`} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 py-2 text-xs">
            <span className="text-muted-foreground w-5">{i + 1}</span>
            <div>
              <p className="font-medium">{trap.player_name}</p>
              <p className="text-[10px] text-muted-foreground">{trap.matchup}</p>
            </div>
            <span className="tabular-nums text-right text-rose-400">{trap.ownership_count}/{trap.total_users}</span>
            <span className="tabular-nums text-right font-semibold text-rose-500">{trap.user_pts}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main tab ────────────────────────────────────────────────────────────────────

export function DifferentialTab({ picks, summary, currentUserId, userNames }: Props) {
  if (summary.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">No differential data yet — available after the first completed match.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Differential Leaderboard</p>
        <p className="text-[10px] text-muted-foreground">Diff Score = pts from unique picks (≤2/{Object.keys(userNames).length} owners) minus pts lost on unique busts. Avg Own. = average ownership across all picks (lower = more contrarian).</p>
        <DiffLeaderboard summary={summary} currentUserId={currentUserId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Differential Breakdown</p>
        <p className="text-[10px] text-muted-foreground">💎 Gems (≤2/{Object.keys(userNames).length} owners, ≥80 pts) · ✅ Paid Off (≤3 owners, ≥50 pts) · ❌ Busts (≤2 owners, &lt;30 pts)</p>
        <CategoryBreakdown picks={picks} summary={summary} currentUserId={currentUserId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Top Unique Picks</p>
        <p className="text-[10px] text-muted-foreground">Your best differential picks this season (≤3/{Object.keys(userNames).length} owners), sorted by points.</p>
        <TopPicks picks={picks} currentUserId={currentUserId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">🪤 Herd Traps</p>
        <p className="text-[10px] text-muted-foreground">Players picked by 60%+ of the league who scored under 20 pts.</p>
        <HerdTraps picks={picks} />
      </div>
    </div>
  )
}

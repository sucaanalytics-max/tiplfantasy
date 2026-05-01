"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { CaptainAnalyticsRow, CaptainMatchHistoryRow, CvPickRow } from "@/lib/types"

interface Props {
  leaderboard: CaptainAnalyticsRow[]
  matchHistory: Record<string, CaptainMatchHistoryRow[]>  // keyed by user_id
  cvPicks: CvPickRow[]
  currentUserId: string
  userNames: Record<string, string>  // user_id -> display_name
}

// ── Captain leaderboard ────────────────────────────────────────────────────────

function CaptainLeaderboard({ rows, currentUserId }: { rows: CaptainAnalyticsRow[]; currentUserId: string }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
          <span>Player</span>
          <span className="text-right">C Pts</span>
          <span className="text-right hidden sm:block">Optimal</span>
          <span className="text-right">Left</span>
          <span className="text-right">Hit%</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {rows.map((row, i) => {
          const isMe = row.user_id === currentUserId
          return (
            <div
              key={row.user_id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-3 py-2.5",
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
              <span className="text-gold-stat text-sm tabular-nums text-right">{row.total_captain_pts.toLocaleString()}</span>
              <span className="hidden sm:block text-xs text-muted-foreground tabular-nums text-right">{row.total_optimal_pts.toLocaleString()}</span>
              <span className="text-xs tabular-nums text-right text-rose-400/80">
                −{row.opportunity_cost.toLocaleString()}
              </span>
              <span className={cn(
                "text-xs tabular-nums text-right font-medium",
                row.hit_rate_pct >= 70 ? "text-emerald-500" : row.hit_rate_pct >= 50 ? "text-amber-500" : "text-rose-400"
              )}>
                {row.hit_rate_pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── C/VC picks by team (filterable) ────────────────────────────────────────────

function CvPicksTable({
  cvPicks,
  userNames,
  currentUserId,
}: {
  cvPicks: CvPickRow[]
  userNames: Record<string, string>
  currentUserId: string
}) {
  const userIds = Object.keys(userNames)
  const teams = useMemo(() => [...new Set(cvPicks.map((r) => r.team_short_name))].sort(), [cvPicks])

  const [filterUser, setFilterUser] = useState<string>("all")
  const [filterTeam, setFilterTeam] = useState<string>("all")

  const filtered = useMemo(() => {
    let rows = cvPicks
    if (filterTeam !== "all") rows = rows.filter((r) => r.team_short_name === filterTeam)
    if (filterUser !== "all") rows = rows.filter((r) => {
      const p = r.picks[filterUser]
      return p && (p.captain > 0 || p.vc > 0)
    })
    return rows
  }, [cvPicks, filterTeam, filterUser])

  // Which user IDs to show as columns
  const visibleUserIds = filterUser === "all" ? userIds : [filterUser]

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg glass border border-overlay-border bg-transparent text-foreground"
        >
          <option value="all">All players</option>
          {userIds.map((uid) => (
            <option key={uid} value={uid}>{userNames[uid]}</option>
          ))}
        </select>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg glass border border-overlay-border bg-transparent text-foreground"
        >
          <option value="all">All teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[400px]">
          <thead>
            <tr className="border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-3 py-2 text-left font-medium">Team</th>
              {visibleUserIds.map((uid) => (
                <th key={uid} className={cn("px-2 py-2 text-center font-medium", uid === currentUserId && "text-primary")}>
                  {userNames[uid]?.split(" ")[0] ?? "?"}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">/Matches</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-overlay-border">
            {filtered.map((row) => (
              <tr key={row.player_id} className="hover:bg-overlay-subtle/50">
                <td className="px-3 py-2 font-medium truncate max-w-[120px]">{row.player_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.team_short_name}</td>
                {visibleUserIds.map((uid) => {
                  const p = row.picks[uid] ?? { captain: 0, vc: 0 }
                  const hasAny = p.captain > 0 || p.vc > 0
                  return (
                    <td key={uid} className={cn("px-2 py-2 text-center tabular-nums", uid === currentUserId && "font-semibold")}>
                      {hasAny ? (
                        <span>
                          <span className="text-[var(--captain-gold)]">{p.captain}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-primary/80">{p.vc}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-right text-muted-foreground">{row.team_matches_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No picks match the selected filters</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Format: C picks / VC picks out of matches played by that team</p>
    </div>
  )
}

// ── Per-match captain history ───────────────────────────────────────────────────

function CaptainMatchHistory({ rows }: { rows: CaptainMatchHistoryRow[] }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_5rem] gap-2 items-center">
          <span>#</span>
          <span>Your Captain · Match</span>
          <span className="text-right">C Pts</span>
          <span className="text-right">vs Optimal</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border max-h-[400px] overflow-y-auto">
        {rows.map((row) => {
          const perfect = row.gap === 0
          const bestSurname = row.optimal_player_name.split(" ").pop()
          return (
            <div
              key={row.match_id}
              className="grid grid-cols-[2.5rem_1fr_3.5rem_5rem] gap-2 items-center px-3 py-2.5"
            >
              <span className="text-[10px] text-muted-foreground tabular-nums text-center">M{row.match_number}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{row.captain_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{row.matchup}</p>
              </div>
              <span className="text-sm text-right tabular-nums font-semibold text-gold-stat">{row.actual_pts}</span>
              {perfect ? (
                <span className="text-right text-emerald-500 text-[10px] font-semibold">✓ Best pick</span>
              ) : (
                <div className="text-right">
                  <p className="text-xs tabular-nums font-semibold text-rose-400">−{row.gap}</p>
                  <p className="text-[10px] text-muted-foreground">{bestSurname} · {row.optimal_pts}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main tab component ──────────────────────────────────────────────────────────

export function CaptainAnalyticsTab({ leaderboard, matchHistory, cvPicks, currentUserId, userNames }: Props) {
  if (leaderboard.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">No captain data yet — available after the first match is scored.</p>
      </div>
    )
  }

  const myHistory = matchHistory[currentUserId] ?? []
  const myRow = leaderboard.find((r) => r.user_id === currentUserId)

  return (
    <div className="space-y-6">
      {/* Personal summary */}
      {myRow && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Captain Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Earned", value: myRow.total_captain_pts.toLocaleString(), sub: "captain pts" },
              { label: "Optimal", value: myRow.total_optimal_pts.toLocaleString(), sub: "if always best" },
              { label: "Left on table", value: `−${myRow.opportunity_cost.toLocaleString()}`, sub: "pts missed", red: true },
              { label: "Hit rate", value: `${myRow.hit_rate_pct}%`, sub: "≥50 pts as C" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-overlay-subtle p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={cn("text-xl font-bold tabular-nums", stat.red ? "text-rose-400" : "text-gold-stat")}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season captain leaderboard */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Season Captain Leaderboard</p>
        <CaptainLeaderboard rows={leaderboard} currentUserId={currentUserId} />
        <p className="text-[10px] text-muted-foreground px-1">C Pts = actual captain points earned · Left = points lost vs. optimal pick · Hit% = % of matches captain scored ≥50 pts</p>
      </div>

      {/* C/VC by team */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">C/VC Picks by Team</p>
        <CvPicksTable cvPicks={cvPicks} userNames={userNames} currentUserId={currentUserId} />
      </div>

      {/* Your match history */}
      {myHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Captain History</p>
          <CaptainMatchHistory rows={myHistory} />
        </div>
      )}
    </div>
  )
}

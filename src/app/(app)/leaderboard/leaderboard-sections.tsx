"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Zap, Crown, Target, ChevronDown } from "lucide-react"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { LeagueMemberStats, LeagueMatchScore, LeagueLeaderboardEntry } from "@/lib/types"

// ── Shared helpers ──────────────────────────────────────────────────────────

function AvatarInitial({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const px = size === "sm" ? "h-5 w-5" : "h-7 w-7"
  const text = size === "sm" ? "text-[8px]" : "text-[10px]"
  return (
    <div className={`${px} rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(name)}`}>
      <span className={`text-white ${text} font-bold`}>{getInitials(name)}</span>
    </div>
  )
}

// ── Matchday History (last 3 + per-user dropdown) ───────────────────────────

type MatchWinner = {
  matchNumber: number
  matchId: string
  winners: { userId?: string; name: string; points: number }[]
  winnersCount: number
}

export function MatchdayHistory({ matchHistory, currentUserId }: { matchHistory: MatchWinner[]; currentUserId: string }) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const recent = matchHistory.slice(0, 3)

  // Per-user wins
  const userWins = new Map<string, { name: string; matches: MatchWinner[]; isMe: boolean }>()
  for (const match of matchHistory) {
    for (const w of match.winners) {
      const key = w.userId ?? w.name
      if (!userWins.has(key)) {
        userWins.set(key, { name: w.name, matches: [], isMe: w.userId === currentUserId })
      }
      userWins.get(key)!.matches.push(match)
    }
  }
  const userWinsList = [...userWins.entries()].sort(([, a], [, b]) => b.matches.length - a.matches.length)

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Matchday History</p>

      {/* Recent 3 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[oklch(0_0_0/0.25)] overflow-hidden divide-y divide-overlay-border mb-3">
        {recent.map((match) => {
          const iWon = match.winners.some((w) => w.userId === currentUserId)
          return (
            <div
              key={match.matchNumber}
              className={`flex items-center justify-between px-4 py-3 transition-colors ${iWon ? "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--primary)]" : ""}`}
            >
              <div>
                <span className="text-xs text-muted-foreground">Match #{match.matchNumber}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {iWon ? (
                    <span className="text-sm font-semibold text-primary">🎉 You won!</span>
                  ) : (
                    <>
                      <span className="text-sm">🏆</span>
                      <span className="text-sm font-medium">
                        {match.winners.map((w) => w.name).join(" & ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span
                className="text-sm font-bold font-display tabular-nums"
                style={{ color: "var(--captain-gold)" }}
              >
                {match.winners[0]?.points} pts
              </span>
            </div>
          )
        })}
      </div>

      {/* Per-user dropdown */}
      {userWinsList.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[oklch(0_0_0/0.25)] overflow-hidden divide-y divide-overlay-border">
          {userWinsList.map(([key, data]) => {
            const isOpen = expandedUser === key
            return (
              <div key={key}>
                <button
                  onClick={() => setExpandedUser(isOpen ? null : key)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-overlay-subtle transition-colors ${data.isMe ? "bg-primary/[0.04]" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarInitial name={data.name} />
                    <span className={`text-sm font-medium truncate ${data.isMe ? "text-primary font-semibold" : ""}`}>{data.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{data.matches.length} win{data.matches.length !== 1 ? "s" : ""}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 ml-7 space-y-1">
                    {data.matches.map((m) => {
                      const w = m.winners.find((w) => (w.userId ?? w.name) === key)
                      return (
                        <div key={m.matchNumber} className="flex items-center justify-between text-xs py-1 border-b border-overlay-border last:border-0">
                          <span className="text-muted-foreground">Match #{m.matchNumber}</span>
                          <span className="font-medium">{w?.points} pts</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Award Detail Tables (moved from league-detail) ──────────────────────────

type CaptaincySortKey = "cPts" | "vcPts" | "total"

export function AwardTables({ awards, matchScores }: { awards: LeagueMemberStats[]; matchScores: LeagueMatchScore[] }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, string | null>>({
    captaincy: null, highScore: null, wins: null, consistency: null,
  })
  const [captaincySort, setCaptaincySort] = useState<CaptaincySortKey>("cPts")

  const toggle = (table: string, userId: string) =>
    setExpandedRows((prev) => ({ ...prev, [table]: prev[table] === userId ? null : userId }))

  // Build per-user match data
  const userMap = new Map<string, { name: string; matches: Array<{ matchNumber: number; total: number; captain: number; vc: number; rank: number }> }>()
  for (const row of matchScores) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, { name: row.display_name, matches: [] })
    }
    userMap.get(row.user_id)!.matches.push({
      matchNumber: row.match_number,
      total: row.total_points,
      captain: row.captain_points ?? 0,
      vc: row.vc_points ?? 0,
      rank: row.league_rank,
    })
  }

  // Captaincy
  const captaincyUnsorted = [...userMap.entries()].map(([uid, d]) => {
    const cPts = d.matches.reduce((s, m) => s + m.captain, 0)
    const vcPts = d.matches.reduce((s, m) => s + m.vc, 0)
    return { userId: uid, name: d.name, cPts, vcPts, total: cPts + vcPts, matches: d.matches }
  })
  const captaincy = [...captaincyUnsorted].sort((a, b) => b[captaincySort] - a[captaincySort] || b.total - a.total)

  // Highest Score
  const highScore = [...userMap.entries()].map(([uid, d]) => {
    const best = d.matches.reduce((max, m) => (m.total > max.total ? m : max), d.matches[0])
    return { userId: uid, name: d.name, best: best.total, matchNum: best.matchNumber, matches: [...d.matches].sort((a, b) => b.total - a.total) }
  }).sort((a, b) => b.best - a.best)

  // Matchday Wins — with prize calculation
  const MATCHDAY_PRIZE = 150
  // Count co-winners per match for prize splitting
  const matchWinnerCounts = new Map<number, number>()
  for (const [, d] of userMap) {
    for (const m of d.matches) {
      if (m.rank === 1) matchWinnerCounts.set(m.matchNumber, (matchWinnerCounts.get(m.matchNumber) ?? 0) + 1)
    }
  }

  const wins = [...userMap.entries()].map(([uid, d]) => {
    const wonMatches = d.matches.filter((m) => m.rank === 1)
    const totalWon = wonMatches.reduce((s, m) => s + MATCHDAY_PRIZE / (matchWinnerCounts.get(m.matchNumber) ?? 1), 0)
    return { userId: uid, name: d.name, winCount: wonMatches.length, totalWon, wonMatches, matches: d.matches }
  }).sort((a, b) => b.winCount - a.winCount)

  // Consistency
  const consistency = [...userMap.entries()].map(([uid, d]) => {
    const top2 = d.matches.filter((m) => m.rank <= 2).length
    const avg = d.matches.length > 0 ? Math.round(d.matches.reduce((s, m) => s + m.total, 0) / d.matches.length) : 0
    return { userId: uid, name: d.name, top2, avg, matches: [...d.matches].sort((a, b) => a.matchNumber - b.matchNumber) }
  }).sort((a, b) => b.top2 - a.top2 || b.avg - a.avg)

  const renderRow = (uid: string, name: string, cells: React.ReactNode[], table: string, expandContent: React.ReactNode) => {
    const isOpen = expandedRows[table] === uid
    return (
      <div key={uid}>
        <button
          onClick={() => toggle(table, uid)}
          className="w-full grid items-center py-2.5 px-3 rounded-lg hover:bg-overlay-subtle transition-colors"
          style={{ gridTemplateColumns: "1fr " + "3.5rem ".repeat(cells.length) + "1.5rem" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AvatarInitial name={name} />
            <span className="text-sm truncate">{name}</span>
          </div>
          {cells}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <div className="px-3 pb-2 pt-1 ml-8 space-y-1">
            {expandContent}
          </div>
        )}
      </div>
    )
  }

  const matchRow = (label: string, value: string, highlight?: boolean) => (
    <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-overlay-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-[var(--tw-emerald-text,oklch(0.65_0.17_162))]" : "font-medium"}>{value}</span>
    </div>
  )

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Award Tables</p>
      <div className="space-y-4">
        {/* Captaincy */}
        <div className="rounded-2xl border border-white/[0.07] bg-[oklch(0_0_0/0.25)] overflow-hidden">
          <div className="px-3 py-2 border-b border-overlay-border flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Captaincy</span>
          </div>
          <div className="p-2 space-y-0.5">
            <div className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 3.5rem 1.5rem" }}>
              <span>Member</span>
              {(["cPts", "vcPts", "total"] as CaptaincySortKey[]).map((key) => {
                const labels: Record<CaptaincySortKey, string> = { cPts: "C", vcPts: "VC", total: "Total" }
                return (
                  <button key={key} onClick={() => setCaptaincySort(key)} className={`text-right cursor-pointer hover:text-foreground transition-colors ${captaincySort === key ? "text-foreground font-bold" : ""}`}>
                    {labels[key]}{captaincySort === key ? " ↓" : ""}
                  </button>
                )
              })}
              <span />
            </div>
            {captaincy.map((row) =>
              renderRow(row.userId, row.name, [
                <span key="c" className="text-sm font-semibold text-right text-amber-400">{Math.round(row.cPts)}</span>,
                <span key="vc" className="text-sm font-medium text-right text-violet-400">{Math.round(row.vcPts)}</span>,
                <span key="t" className="text-sm font-medium text-right">{Math.round(row.total)}</span>,
              ], "captaincy",
                row.matches.sort((a, b) => b.matchNumber - a.matchNumber).map((m) =>
                  matchRow(`M${m.matchNumber}`, `C: ${Math.round(m.captain)} · VC: ${Math.round(m.vc)}`, m.captain > 0)
                )
              )
            )}
          </div>
        </div>

        {/* Highest Score */}
        <div className="rounded-2xl border border-white/[0.07] bg-[oklch(0_0_0/0.25)] overflow-hidden">
          <div className="px-3 py-2 border-b border-overlay-border flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Highest Score</span>
          </div>
          <div className="p-2 space-y-0.5">
            <div className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 1.5rem" }}>
              <span>Member</span><span className="text-right">Best</span><span className="text-right">M#</span><span />
            </div>
            {highScore.map((row) =>
              renderRow(row.userId, row.name, [
                <span key="b" className="text-sm font-semibold text-right text-orange-400">{Math.round(row.best)}</span>,
                <span key="m" className="text-sm font-medium text-right text-muted-foreground">{row.matchNum}</span>,
              ], "highScore",
                row.matches.map((m) => matchRow(`M${m.matchNumber}`, `${Math.round(m.total)} pts`, m.total === row.best))
              )
            )}
          </div>
        </div>

        {/* Matchday Wins */}
        <div className="rounded-2xl border border-white/[0.07] bg-[oklch(0_0_0/0.25)] overflow-hidden">
          <div className="px-3 py-2 border-b border-overlay-border flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Matchday Wins</span>
          </div>
          <div className="p-2 space-y-0.5">
            <div className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 1.5rem" }}>
              <span>Member</span><span className="text-right">Wins</span><span className="text-right">Won</span><span />
            </div>
            {wins.map((row) =>
              renderRow(row.userId, row.name, [
                <span key="w" className="text-sm font-semibold text-right text-emerald-400">{row.winCount}</span>,
                <span key="won" className="text-sm font-medium text-right text-amber-400">{Math.round(row.totalWon)}</span>,
              ], "wins",
                row.wonMatches.length > 0
                  ? row.wonMatches.sort((a, b) => b.matchNumber - a.matchNumber).map((m) => matchRow(`M${m.matchNumber}`, `${Math.round(m.total)} pts`, true))
                  : [<p key="none" className="text-xs text-muted-foreground py-1">No wins yet</p>]
              )
            )}
          </div>
        </div>

        {/* Consistency */}
        <div className="rounded-2xl border border-white/[0.07] bg-[oklch(0_0_0/0.25)] overflow-hidden">
          <div className="px-3 py-2 border-b border-overlay-border flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Consistency</span>
          </div>
          <div className="p-2 space-y-0.5">
            <div className="grid text-[10px] text-muted-foreground px-3 pb-1 uppercase tracking-wide" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem 1.5rem" }}>
              <span>Member</span><span className="text-right">Top-2</span><span className="text-right">Avg</span><span />
            </div>
            {consistency.map((row) =>
              renderRow(row.userId, row.name, [
                <span key="t2" className="text-sm font-semibold text-right text-sky-400">{row.top2}</span>,
                <span key="avg" className="text-sm font-medium text-right text-muted-foreground">{row.avg}</span>,
              ], "consistency",
                row.matches.sort((a, b) => b.matchNumber - a.matchNumber).map((m) =>
                  matchRow(`M${m.matchNumber}`, `${Math.round(m.total)} pts (#${m.rank})`, m.rank <= 2)
                )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

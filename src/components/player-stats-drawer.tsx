"use client"

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/badges"
import type { PlayerWithTeam, PlayerVenueStats, PlayerVsTeamStats, TiplMatchEntry, TiplSeasonAggregates } from "@/lib/types"

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function StatCell({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined) return null
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function MiniBarChart({ scores, color }: { scores: number[]; color: string }) {
  const max = Math.max(...scores, 1)
  return (
    <div className="flex items-end gap-1 h-8">
      {scores.map((score, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm min-h-[2px]"
            style={{
              height: `${(score / max) * 100}%`,
              backgroundColor: color,
              opacity: 0.7 + (i / scores.length) * 0.3,
            }}
          />
          <span className="text-[9px] text-muted-foreground">{score}</span>
        </div>
      ))}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function RankBadges({ stats, role }: { stats: TiplSeasonAggregates; role: string }) {
  const badges: React.ReactNode[] = []

  if ((role === "BAT" || role === "WK" || role === "AR") && stats.runsRank !== null && stats.runsRank <= 10) {
    badges.push(
      <span key="runs" className="text-[10px] text-muted-foreground">
        <span className="font-semibold text-primary">{ordinal(stats.runsRank)}</span> highest run-scorer
      </span>
    )
  }

  if ((role === "BOWL" || role === "AR") && stats.wicketsRank !== null && stats.wicketsRank <= 10) {
    badges.push(
      <span key="wkts" className="text-[10px] text-muted-foreground">
        <span className="font-semibold text-primary">{ordinal(stats.wicketsRank)}</span> highest wicket-taker
      </span>
    )
  }

  if (stats.fantasyRank !== null && stats.fantasyRank <= 10) {
    badges.push(
      <span key="pts" className="text-[10px] text-muted-foreground">
        <span className="font-semibold text-primary">{ordinal(stats.fantasyRank)}</span> in fantasy points
      </span>
    )
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 mb-1">
      {badges.map((b, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/40">&middot;</span>}
          {b}
        </span>
      ))}
    </div>
  )
}

export function PlayerStatsDrawer({
  player,
  tiplMatchLog,
  tiplSeasonStats,
  venueStats,
  vsTeamStats,
  matchVenue,
  opponentTeamName,
  open,
  onClose,
}: {
  player: PlayerWithTeam | null
  tiplMatchLog: TiplMatchEntry[]
  tiplSeasonStats: TiplSeasonAggregates | null
  venueStats: PlayerVenueStats | null
  vsTeamStats: PlayerVsTeamStats | null
  matchVenue: string
  opponentTeamName: string
  open: boolean
  onClose: () => void
}) {
  if (!player) return null

  const hasStats = player.ipl_matches !== null
  const hasBowling = (player.ipl_wickets ?? 0) > 0
  const hasRecentForm = player.ipl_recent_scores && player.ipl_recent_scores.length > 0
  const hasMatchLog = tiplMatchLog.length > 0
  const hasSeasonStats = tiplSeasonStats !== null && tiplSeasonStats.matches > 0
  const hasMatchContext = venueStats || vsTeamStats
  const role = player.role

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        {/* Team color bar */}
        <div
          className="h-1 rounded-t-[10px]"
          style={{ backgroundColor: player.team.color }}
        />

        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-left">{player.name}</DrawerTitle>
              <DrawerDescription className="text-left flex items-center gap-2 mt-1">
                <span style={{ color: player.team.color }} className="font-semibold">
                  {player.team.short_name}
                </span>
                <Badge variant="outline" className={ROLE_COLORS[player.role]}>
                  {ROLE_LABELS[player.role]}
                </Badge>
                <span className="text-muted-foreground">{player.credit_cost} cr</span>
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto" data-vaul-no-drag>
          {!hasStats && !hasMatchLog && !hasSeasonStats && !hasMatchContext && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No stats available
            </div>
          )}

          {/* TIPL Match Log — per-match table */}
          {hasMatchLog && (
            <>
              <SectionHeader>TIPL Match Log</SectionHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left py-1 font-semibold w-8">#</th>
                      <th className="text-left py-1 font-semibold">vs</th>
                      {(role === "WK" || role === "BAT") && (
                        <>
                          <th className="text-center py-1 font-semibold">Runs</th>
                          <th className="text-center py-1 font-semibold">SR</th>
                          <th className="text-center py-1 font-semibold">Ct</th>
                        </>
                      )}
                      {role === "BOWL" && (
                        <>
                          <th className="text-center py-1 font-semibold">Wkts</th>
                          <th className="text-center py-1 font-semibold">Econ</th>
                          <th className="text-center py-1 font-semibold">Runs</th>
                        </>
                      )}
                      {role === "AR" && (
                        <>
                          <th className="text-center py-1 font-semibold">Runs</th>
                          <th className="text-center py-1 font-semibold">Wkts</th>
                          <th className="text-center py-1 font-semibold">Econ</th>
                        </>
                      )}
                      <th className="text-right py-1 font-semibold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiplMatchLog.map((entry, i) => {
                      const sr = entry.ballsFaced > 0
                        ? ((entry.runs / entry.ballsFaced) * 100).toFixed(1)
                        : "-"
                      const econ = entry.oversBowled > 0
                        ? (entry.runsConceded / entry.oversBowled).toFixed(1)
                        : "-"
                      return (
                        <tr
                          key={entry.matchNumber}
                          className={i % 2 === 0 ? "bg-muted/30" : ""}
                        >
                          <td className="py-1.5 pl-1 text-muted-foreground">M{entry.matchNumber}</td>
                          <td className="py-1.5 font-medium text-foreground">{entry.opponent}</td>
                          {(role === "WK" || role === "BAT") && (
                            <>
                              <td className="text-center py-1.5 font-semibold">{entry.runs}</td>
                              <td className="text-center py-1.5">{sr}</td>
                              <td className="text-center py-1.5">{entry.catches || "-"}</td>
                            </>
                          )}
                          {role === "BOWL" && (
                            <>
                              <td className="text-center py-1.5 font-semibold">{entry.wickets}</td>
                              <td className="text-center py-1.5">{econ}</td>
                              <td className="text-center py-1.5">{entry.runsConceded}</td>
                            </>
                          )}
                          {role === "AR" && (
                            <>
                              <td className="text-center py-1.5">{entry.runs}</td>
                              <td className="text-center py-1.5">{entry.wickets}</td>
                              <td className="text-center py-1.5">{econ}</td>
                            </>
                          )}
                          <td className="text-right py-1.5 pr-1 font-bold tabular-nums">{entry.fantasyPoints}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Match Context — vs opponent + at venue */}
          {hasMatchContext && (
            <>
              <SectionHeader>Match Context</SectionHeader>
              <div className="grid grid-cols-2 gap-3">
                {vsTeamStats && (
                  <div className="rounded-lg border border-overlay-border p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      vs {opponentTeamName}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell
                        label="Avg"
                        value={vsTeamStats.balls_faced > 0
                          ? (vsTeamStats.runs / Math.max(vsTeamStats.matches, 1)).toFixed(1)
                          : null}
                      />
                      <StatCell
                        label="SR"
                        value={vsTeamStats.balls_faced > 0
                          ? ((vsTeamStats.runs / vsTeamStats.balls_faced) * 100).toFixed(1)
                          : null}
                      />
                      <StatCell label="Wkts" value={vsTeamStats.wickets || null} />
                      <StatCell
                        label="Econ"
                        value={Number(vsTeamStats.overs_bowled) > 0
                          ? (vsTeamStats.runs_conceded / Number(vsTeamStats.overs_bowled)).toFixed(1)
                          : null}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center mt-1">
                      {vsTeamStats.matches} mat
                    </p>
                  </div>
                )}
                {venueStats && (
                  <div className="rounded-lg border border-overlay-border p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 truncate">
                      At {matchVenue.split(",")[0]}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell
                        label="Avg"
                        value={venueStats.balls_faced > 0
                          ? (venueStats.runs / Math.max(venueStats.matches, 1)).toFixed(1)
                          : null}
                      />
                      <StatCell
                        label="SR"
                        value={venueStats.balls_faced > 0
                          ? ((venueStats.runs / venueStats.balls_faced) * 100).toFixed(1)
                          : null}
                      />
                      <StatCell label="Wkts" value={venueStats.wickets || null} />
                      <StatCell
                        label="Econ"
                        value={Number(venueStats.overs_bowled) > 0
                          ? (venueStats.runs_conceded / Number(venueStats.overs_bowled)).toFixed(1)
                          : null}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center mt-1">
                      {venueStats.matches} mat
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TIPL 2026 Season — aggregated stats */}
          {hasSeasonStats && tiplSeasonStats && (
            <>
              <SectionHeader>TIPL 2026 Season ({tiplSeasonStats.matches} match{tiplSeasonStats.matches > 1 ? "es" : ""})</SectionHeader>

              {/* Batting table — for WK, BAT, AR */}
              {(role === "WK" || role === "BAT" || role === "AR") && (
                <div className="overflow-x-auto mb-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {(role === "WK" || role === "BAT") && <th className="text-center py-1 font-semibold">Mat</th>}
                        {(role === "WK" || role === "BAT") && <th className="text-center py-1 font-semibold">Inn</th>}
                        <th className="text-center py-1 font-semibold">Runs</th>
                        <th className="text-center py-1 font-semibold">Avg</th>
                        <th className="text-center py-1 font-semibold">SR</th>
                        <th className="text-center py-1 font-semibold">HS</th>
                        {(role === "WK" || role === "BAT") && (
                          <>
                            <th className="text-center py-1 font-semibold">4s</th>
                            <th className="text-center py-1 font-semibold">6s</th>
                            <th className="text-center py-1 font-semibold">Ct</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-muted/30">
                        {(role === "WK" || role === "BAT") && <td className="text-center py-1.5">{tiplSeasonStats.matches}</td>}
                        {(role === "WK" || role === "BAT") && <td className="text-center py-1.5">{tiplSeasonStats.innings}</td>}
                        <td className="text-center py-1.5 font-semibold">{tiplSeasonStats.runs}</td>
                        <td className="text-center py-1.5">
                          {tiplSeasonStats.innings > 0
                            ? (tiplSeasonStats.runs / Math.max(tiplSeasonStats.innings - tiplSeasonStats.notOuts, 1)).toFixed(1)
                            : "-"}
                        </td>
                        <td className="text-center py-1.5">
                          {tiplSeasonStats.ballsFaced > 0
                            ? ((tiplSeasonStats.runs / tiplSeasonStats.ballsFaced) * 100).toFixed(1)
                            : "-"}
                        </td>
                        <td className="text-center py-1.5">{tiplSeasonStats.highestScore}</td>
                        {(role === "WK" || role === "BAT") && (
                          <>
                            <td className="text-center py-1.5">{tiplSeasonStats.fours}</td>
                            <td className="text-center py-1.5">{tiplSeasonStats.sixes}</td>
                            <td className="text-center py-1.5">{tiplSeasonStats.catches}</td>
                          </>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bowling table — for BOWL, AR */}
              {(role === "BOWL" || role === "AR") && (
                <div className="overflow-x-auto mb-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {role === "BOWL" && <th className="text-center py-1 font-semibold">Mat</th>}
                        <th className="text-center py-1 font-semibold">Wkts</th>
                        <th className="text-center py-1 font-semibold">Avg</th>
                        <th className="text-center py-1 font-semibold">Econ</th>
                        <th className="text-center py-1 font-semibold">Best</th>
                        <th className="text-center py-1 font-semibold">Mdns</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-muted/30">
                        {role === "BOWL" && <td className="text-center py-1.5">{tiplSeasonStats.matches}</td>}
                        <td className="text-center py-1.5 font-semibold">{tiplSeasonStats.wickets}</td>
                        <td className="text-center py-1.5">
                          {tiplSeasonStats.wickets > 0
                            ? (tiplSeasonStats.runsConceded / tiplSeasonStats.wickets).toFixed(1)
                            : "-"}
                        </td>
                        <td className="text-center py-1.5">
                          {tiplSeasonStats.oversBowled > 0
                            ? (tiplSeasonStats.runsConceded / tiplSeasonStats.oversBowled).toFixed(1)
                            : "-"}
                        </td>
                        <td className="text-center py-1.5">
                          {tiplSeasonStats.bestWickets > 0
                            ? `${tiplSeasonStats.bestWickets}/${tiplSeasonStats.bestRunsConceded}`
                            : "-"}
                        </td>
                        <td className="text-center py-1.5">{tiplSeasonStats.maidens || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Rank badges */}
              <RankBadges stats={tiplSeasonStats} role={role} />

              {/* Fantasy points summary */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="text-center rounded-lg bg-overlay-subtle py-2">
                  <p className="text-lg font-bold text-foreground">{tiplSeasonStats.totalFantasyPoints}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Pts</p>
                </div>
                <div className="text-center rounded-lg bg-overlay-subtle py-2">
                  <p className="text-lg font-bold text-foreground">{tiplSeasonStats.avgFantasyPoints}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg Pts</p>
                </div>
              </div>
            </>
          )}

          {/* IPL Career Batting */}
          {hasStats && (
            <>
              <SectionHeader>IPL Career</SectionHeader>
              <div className="grid grid-cols-4 gap-3">
                <StatCell label="Mat" value={player.ipl_matches} />
                <StatCell label="Inn" value={player.ipl_innings} />
                <StatCell label="Runs" value={player.ipl_runs} />
                <StatCell label="Avg" value={player.ipl_batting_avg} />
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                <StatCell label="SR" value={player.ipl_strike_rate} />
                <StatCell label="HS" value={player.ipl_highest_score} />
                <StatCell label="50s" value={player.ipl_fifties} />
                <StatCell label="100s" value={player.ipl_hundreds} />
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                <StatCell label="4s" value={player.ipl_fours} />
                <StatCell label="6s" value={player.ipl_sixes} />
                <StatCell label="Ct" value={player.ipl_catches} />
                <StatCell label="" value={null} />
              </div>
            </>
          )}

          {/* Bowling */}
          {hasBowling && (
            <>
              <SectionHeader>Bowling</SectionHeader>
              <div className="grid grid-cols-4 gap-3">
                <StatCell label="Wkts" value={player.ipl_wickets} />
                <StatCell label="Avg" value={player.ipl_bowling_avg} />
                <StatCell label="Econ" value={player.ipl_economy} />
                <StatCell label="Best" value={player.ipl_best_bowling} />
              </div>
            </>
          )}

          {/* Recent IPL Form */}
          {hasRecentForm && (
            <>
              <SectionHeader>Recent IPL Form</SectionHeader>
              <MiniBarChart
                scores={player.ipl_recent_scores!}
                color={player.team.color}
              />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

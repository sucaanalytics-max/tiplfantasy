"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUpDown, TrendingUp, Shield, Eye, MapPin, ChevronDown, ChevronUp, Sparkles, Users, BarChart3, Target, Swords, GitCompareArrows, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { StatCard } from "@/components/stat-card"
import { LineChart } from "@/components/charts/line-chart"
import { RadarChart } from "@/components/charts/radar-chart"
import { GroupedBar } from "@/components/charts/grouped-bar"
import { StripChart } from "@/components/charts/strip-chart"
import { cn } from "@/lib/utils"
import type { PlayerRole } from "@/lib/types"
import type {
  PlayerAnalytics,
  RoleBenchmark,
  PowerRating,
  MatchPreviewPlayer,
  SuggestedTeam,
  OwnershipEntry,
  CaptainROI,
  OptimalTeam,
  UserDQS,
  VenueAnalytics,
  VenueTopPlayer,
  MatchScoringRow,
  PaceSpinVenueRow,
  PaceSpinTeamRow,
} from "@/lib/analytics"

// ============================================================
// Props
// ============================================================

type Props = {
  playerStats: PlayerAnalytics[]
  roleBenchmarks: RoleBenchmark[]
  powerRatings: PowerRating[]
  matchPreview: {
    predictions: MatchPreviewPlayer[]
    suggestedTeam: SuggestedTeam | null
    matchInfo: { matchNumber: number; venue: string; homeTeam: string; awayTeam: string; startTime: string }
  } | null
  ownershipData: OwnershipEntry[]
  captainROI: CaptainROI[]
  optimalTeams: OptimalTeam[]
  dqsData: UserDQS[]
  venueData: VenueAnalytics[]
  matchScoringRows: MatchScoringRow[]
  globalRoleAvg: Record<string, number>
  matchCount: number
  userCount: number
  formCurves: { id: string; name: string; color: string; rollingAvg: number[] }[]
  paceSpinVenues: PaceSpinVenueRow[]
  paceSpinTeams: PaceSpinTeamRow[]
}

// ============================================================
// Helpers
// ============================================================

const ROLES: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

const ROLE_COLORS: Record<PlayerRole, string> = {
  WK: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  BAT: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  AR: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  BOWL: "bg-red-500/15 text-red-700 dark:text-red-300",
}

const volatilityColor = (v: "low" | "medium" | "high") =>
  v === "low" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : v === "medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-red-500/15 text-red-700 dark:text-red-300"

const classificationColor = (c: string) =>
  c === "bat-friendly" ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
    : c === "bowl-friendly" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"

const deltaClass = (v: number) =>
  v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"

const formatDelta = (v: number) => (v > 0 ? `+${v}` : `${v}`)

type SortDir = "asc" | "desc"

const useSortableTable = <T,>(data: T[], defaultKey: keyof T, defaultDir: SortDir = "desc") => {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "desc" ? bVal - aVal : aVal - bVal
      }
      return sortDir === "desc"
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal))
    })
  }, [data, sortKey, sortDir])

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  return { sorted, sortKey, sortDir, toggleSort }
}

// Column header tooltip descriptions
const COLUMN_TIPS: Record<string, string> = {
  "M": "Matches played this season",
  "Avg": "Average Fantasy Points per match",
  "Med": "Median FP — middle value, less skewed by outliers than average",
  "Form": "Average FP over last 3 matches — recent momentum",
  "Δ": "Form trend — Form minus season Avg. Green = improving, Red = declining",
  "Floor": "Lowest FP scored in any single match this season",
  "Ceil": "Highest FP scored in any single match this season",
  "CV": "Consistency — lower = more reliable. <30 very consistent, >60 volatile",
  "StdDev": "Standard deviation — how much FP varies from match to match",
  "Total": "Total Fantasy Points accumulated across all matches",
  "Bat": "Total FP from batting (runs, boundaries, milestones, strike rate)",
  "Bat%": "% of total FP from batting categories",
  "Bowl": "Total FP from bowling (wickets, economy, hauls, maidens)",
  "Bowl%": "% of total FP from bowling categories",
  "Field": "Total FP from fielding (catches, stumpings, run-outs)",
  "Own %": "% of users who picked this player in their team",
  "Cap %": "% of users who made this player captain (2x multiplier)",
  "DQS": "Decision Quality Score — % of the theoretical best possible score achieved",
  "Econ": "Economy rate — runs conceded per over bowled. Lower = better",
  "Pace Econ": "Economy rate for pace bowlers at this venue",
  "Spin Econ": "Economy rate for spin bowlers at this venue",
  "vs Opp": "Average FP in matches against this specific opponent",
  "Venue": "Average FP at this specific ground",
  "Pace W": "Total wickets taken by pace bowlers",
  "Spin W": "Total wickets taken by spin bowlers",
  "vs Pace W": "Wickets this team lost to pace bowlers",
  "vs Spin W": "Wickets this team lost to spin bowlers",
  "Rating": "Power Rating 0-100 — weighted: 40% form, 25% consistency, 20% ceiling, 15% role performance",
  "Form Score": "Normalized form score (0-100) used in power rating calculation",
  "Consist.": "Normalized consistency score (0-100) — higher = less volatile",
  "Role Δ": "Performance above/below the average for this role (WK/BAT/AR/BOWL)",
  "Value": "Value rating — FP relative to ownership. Higher = underowned performer",
  "Vol.": "Volatility — low (consistent), medium, or high (unpredictable)",
  "Avg 2x": "Average captain return — actual 2x score when this player is captained",
  "Best 2x": "Best single-match captain return (base FP × 2)",
  "Worst 2x": "Worst single-match captain return (base FP × 2)",
  "Times C": "Number of times this player was selected as captain across all users",
  "Avg Base": "Average base FP when captained (before 2x multiplier)",
  "Pace Avg FP": "Average FP per appearance for pace bowlers at this venue",
  "Spin Avg FP": "Average FP per appearance for spin bowlers at this venue",
  "xFP": "Expected FP — weighted blend of form, venue, and opponent history",
  "Season Avg": "Average FP across all matches this season",
  "Form (L3)": "Average FP over last 3 matches",
  "Bat FP": "Average batting FP at this venue",
  "Bowl FP": "Average bowling FP at this venue",
  "Bat %": "% of total FP from batting at this venue",
  "Avg FP": "Average Fantasy Points per match",
  "Total FP": "Total Fantasy Points scored at this venue",
  "Avg User": "Average user score for this match",
  "Top User": "Highest user score for this match",
  "Best Player": "Highest individual player FP in this match",
  "Picked": "Number of times this player was selected across all matches",
  "VC": "Number of times selected as Vice-Captain (1.5x multiplier)",
  "Avg DQS": "Average Decision Quality Score across all matches",
  "Best": "Best single-match DQS %",
  "Worst": "Worst single-match DQS %",
  "FP Distribution": "Each dot = one match score. Solid line = average, dashed = median",
  "Breakdown": "Stacked bar: Blue=batting, Red=bowling, Amber=fielding",
  "Type": "Venue/bowler dominance classification based on wicket share",
  "Weakness": "Which bowling type this team loses most wickets to",
  "Range": "Visual spread from worst to best captain return",
}

function Tip({ label }: { label: string }) {
  const tip = COLUMN_TIPS[label]
  if (!tip) return <>{label}</>
  return (
    <span className="group/tip relative cursor-help">
      {label}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-48 rounded-md bg-popover px-2.5 py-1.5 text-[10px] font-normal leading-tight text-popover-foreground shadow-md border opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-normal">
        {tip}
      </span>
    </span>
  )
}

function SortHeader<T>({
  label, sortKey: key, currentKey, currentDir, onSort, className,
}: {
  label: string; sortKey: T; currentKey: T; currentDir: SortDir; onSort: (k: T) => void; className?: string
}) {
  const active = key === currentKey
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground whitespace-nowrap", className)}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        <Tip label={label} />
        {active ? (
          currentDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  )
}

function RoleFilter({ active, onChange }: { active: Set<PlayerRole>; onChange: (s: Set<PlayerRole>) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {ROLES.map((r) => (
        <button
          key={r}
          onClick={() => {
            const next = new Set(active)
            if (next.has(r)) next.delete(r); else next.add(r)
            onChange(next)
          }}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
            active.has(r) ? ROLE_COLORS[r] : "bg-muted/50 text-muted-foreground opacity-50"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

const TEAM_COLORS: Record<string, string> = {
  CSK: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  MI: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  RCB: "bg-red-500/15 text-red-700 dark:text-red-300",
  KKR: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  SRH: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  DC: "bg-blue-600/15 text-blue-800 dark:text-blue-200",
  RR: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  GT: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  PBKS: "bg-red-600/15 text-red-800 dark:text-red-200",
  LSG: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
}

function TeamFilter({ teams, active, onChange }: { teams: string[]; active: Set<string>; onChange: (s: Set<string>) => void }) {
  const allSelected = active.size === teams.length
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      <button
        onClick={() => onChange(new Set(allSelected ? [] : teams))}
        className={cn(
          "px-2 py-1 rounded-md text-xs font-semibold transition-colors",
          allSelected ? "bg-foreground/10 text-foreground" : "bg-muted/50 text-muted-foreground opacity-50"
        )}
      >
        All
      </button>
      {teams.map((t) => (
        <button
          key={t}
          onClick={() => {
            const next = new Set(active)
            if (next.has(t)) next.delete(t); else next.add(t)
            onChange(next)
          }}
          className={cn(
            "px-2 py-1 rounded-md text-xs font-semibold transition-colors",
            active.has(t) ? (TEAM_COLORS[t] ?? "bg-muted text-foreground") : "bg-muted/50 text-muted-foreground opacity-50"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function MinMatchesFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Min matches:</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-muted/50 rounded px-2 py-1 text-xs font-medium text-foreground"
      >
        {[1, 2, 3, 5, 7, 10].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function AnalyticsClient({
  playerStats,
  roleBenchmarks,
  powerRatings,
  matchPreview,
  ownershipData,
  captainROI,
  optimalTeams,
  dqsData,
  venueData,
  matchScoringRows,
  globalRoleAvg,
  matchCount,
  userCount,
  formCurves,
  paceSpinVenues,
  paceSpinTeams,
}: Props) {
  // Shared filter state
  const [roleFilter, setRoleFilter] = useState<Set<PlayerRole>>(new Set(ROLES))
  const [minMatches, setMinMatches] = useState(2)

  const allTeams = useMemo(() => {
    const teams = new Set(playerStats.map((p) => p.team))
    return Array.from(teams).sort()
  }, [playerStats])
  const [teamFilter, setTeamFilter] = useState<Set<string>>(() => new Set(allTeams))
  // Sync teamFilter when allTeams changes (first render)
  const teamFilterActive = teamFilter.size === 0 ? new Set(allTeams) : teamFilter

  const filteredPlayerStats = useMemo(() =>
    playerStats.filter((p) => roleFilter.has(p.role) && teamFilterActive.has(p.team) && p.matches >= minMatches),
    [playerStats, roleFilter, teamFilterActive, minMatches]
  )

  const filteredPowerRatings = useMemo(() =>
    powerRatings.filter((p) => roleFilter.has(p.role) && teamFilterActive.has(p.team) && p.matches >= minMatches),
    [powerRatings, roleFilter, teamFilterActive, minMatches]
  )

  return (
    <div className="p-4 md:p-6 max-w-[90rem] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-lg font-bold">Analytics Dashboard</h1>
          <p className="text-xs text-muted-foreground">{matchCount} matches · {userCount} users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <RoleFilter active={roleFilter} onChange={setRoleFilter} />
          <MinMatchesFilter value={minMatches} onChange={setMinMatches} />
        </div>
        <TeamFilter teams={allTeams} active={teamFilterActive} onChange={setTeamFilter} />
      </div>

      <Tabs defaultValue="nextmatch" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="nextmatch" className="gap-1.5"><Swords className="h-3.5 w-3.5" />Next Match</TabsTrigger>
          <TabsTrigger value="players" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Players</TabsTrigger>
          <TabsTrigger value="matchups" className="gap-1.5"><MapPin className="h-3.5 w-3.5" />Matchups</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
          <TabsTrigger value="compare" className="gap-1.5"><GitCompareArrows className="h-3.5 w-3.5" />Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="nextmatch">
          <NextMatchTab
            playerStats={filteredPlayerStats}
            matchPreview={matchPreview}
            roleFilter={roleFilter}
          />
        </TabsContent>
        <TabsContent value="players">
          <PlayersTab stats={filteredPlayerStats} ratings={filteredPowerRatings} benchmarks={roleBenchmarks} formCurves={formCurves} matchCount={matchCount} />
        </TabsContent>
        <TabsContent value="matchups">
          <MatchupsTab venues={venueData} matchRows={matchScoringRows} paceSpinVenues={paceSpinVenues} paceSpinTeams={paceSpinTeams} globalRoleAvg={globalRoleAvg} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab
            ownership={ownershipData}
            captainROI={captainROI}
            optimalTeams={optimalTeams}
            dqs={dqsData}
            matchCount={matchCount}
          />
        </TabsContent>
        <TabsContent value="compare">
          <CompareTab allPlayers={playerStats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Tab 0: Next Match
// ============================================================

type NextMatchPlayerRow = PlayerAnalytics & {
  vsOppAvg: number | null
  vsOppMatches: number
  atVenueAvg: number | null
  atVenueMatches: number
  batPct: number
  bowlPct: number
}

function NextMatchTab({
  playerStats,
  matchPreview,
  roleFilter,
}: {
  playerStats: PlayerAnalytics[]
  matchPreview: Props["matchPreview"]
  roleFilter: Set<PlayerRole>
}) {
  const [teamFilter, setTeamFilter] = useState<string | null>(null)

  if (!matchPreview) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        No upcoming match found. Check back when the next match is scheduled.
      </div>
    )
  }

  const { matchInfo } = matchPreview

  // Filter to players from the two match teams + compute matchup stats from matchHistory
  const matchTeams = new Set([matchInfo.homeTeam, matchInfo.awayTeam])
  const opponent = (team: string) => team === matchInfo.homeTeam ? matchInfo.awayTeam : matchInfo.homeTeam

  const matchPlayers: NextMatchPlayerRow[] = playerStats
    .filter((p) => matchTeams.has(p.team) && roleFilter.has(p.role))
    .map((p) => {
      const opp = opponent(p.team)
      const vsOpp = p.matchHistory.filter((m) => m.opponent === opp)
      const atVenue = p.matchHistory.filter((m) => m.venue === matchInfo.venue)
      const totalFP = p.totalFP || 1
      return {
        ...p,
        vsOppAvg: vsOpp.length > 0 ? Math.round(vsOpp.reduce((s, m) => s + m.fp, 0) / vsOpp.length * 10) / 10 : null,
        vsOppMatches: vsOpp.length,
        atVenueAvg: atVenue.length > 0 ? Math.round(atVenue.reduce((s, m) => s + m.fp, 0) / atVenue.length * 10) / 10 : null,
        atVenueMatches: atVenue.length,
        batPct: Math.round((p.battingFP / totalFP) * 100),
        bowlPct: Math.round((p.bowlingFP / totalFP) * 100),
      }
    })

  // Build optimal 11 from historical averages (role-constrained greedy)
  const optimal11 = useMemo(() => {
    const LIMITS: Record<string, [number, number]> = { WK: [1, 4], BAT: [2, 5], AR: [1, 3], BOWL: [2, 5] }
    const candidates = [...matchPlayers].filter((p) => p.matches > 0).sort((a, b) => b.avgFP - a.avgFP)
    const picked: typeof matchPlayers = []
    const rc: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
    const tc = new Map<string, number>()
    const used = new Set<string>()

    // Phase 1: fill minimums per role
    for (const role of ["WK", "AR", "BAT", "BOWL"]) {
      const [min] = LIMITS[role]
      for (const c of candidates) {
        if (c.role !== role || used.has(c.id)) continue
        if (rc[role] >= min) break
        if ((tc.get(c.team) ?? 0) >= 7) continue
        picked.push(c); used.add(c.id); rc[role]++; tc.set(c.team, (tc.get(c.team) ?? 0) + 1)
      }
    }
    // Phase 2: fill to 11 with best remaining
    for (const c of candidates) {
      if (picked.length >= 11) break
      if (used.has(c.id)) continue
      const [, max] = LIMITS[c.role]
      if (rc[c.role] >= max) continue
      if ((tc.get(c.team) ?? 0) >= 7) continue
      picked.push(c); used.add(c.id); rc[c.role]++; tc.set(c.team, (tc.get(c.team) ?? 0) + 1)
    }
    if (picked.length < 11) return null

    const byAvg = [...picked].sort((a, b) => b.avgFP - a.avgFP)
    const capId = byAvg[0].id
    const vcId = byAvg[1].id
    const total = Math.round(picked.reduce((s, p) => s + p.avgFP * (p.id === capId ? 2 : p.id === vcId ? 1.5 : 1), 0) * 10) / 10
    return { players: picked, capId, vcId, total }
  }, [matchPlayers])

  const filtered = teamFilter
    ? matchPlayers.filter((p) => p.team === teamFilter)
    : matchPlayers

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(filtered, "avgFP" as keyof NextMatchPlayerRow)

  return (
    <div className="space-y-6 mt-4">
      {/* Match Header */}
      <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Match {matchInfo.matchNumber} — Next Up</p>
              <p className="text-lg font-bold">{matchInfo.homeTeam} vs {matchInfo.awayTeam}</p>
              <p className="text-xs text-muted-foreground">{matchInfo.venue}</p>
            </div>
            <div className="flex gap-1.5">
              {[null, matchInfo.homeTeam, matchInfo.awayTeam].map((t) => (
                <button
                  key={t ?? "all"}
                  onClick={() => setTeamFilter(t)}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                    teamFilter === t ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground")}
                >{t ?? "Both"}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimal 11 based on historical averages */}
      {optimal11 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Optimal XI by Avg FP — {optimal11.total} projected
              <span className="text-[10px] font-normal text-muted-foreground">(C 2x + VC 1.5x + 9×1x)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {optimal11.players
                .sort((a, b) => {
                  const order: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BOWL: 3 }
                  return (order[a.role] ?? 4) - (order[b.role] ?? 4)
                })
                .map((p) => {
                  const isCap = p.id === optimal11.capId
                  const isVC = p.id === optimal11.vcId
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border",
                        isCap ? "border-amber-500/50 bg-amber-500/10"
                        : isVC ? "border-blue-500/50 bg-blue-500/10"
                        : "border-border bg-muted/30"
                      )}
                    >
                      <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                      <span className="font-medium">{p.name.split(" ").pop()}</span>
                      <span className="tabular-nums text-muted-foreground">{p.avgFP}</span>
                      {isCap && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-amber-500 text-white">C</Badge>}
                      {isVC && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-blue-500 text-white">VC</Badge>}
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Fact Sheet Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Player Historical Data ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Player</TableHead>
                  <SortHeader label="M" sortKey={"matches" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Avg" sortKey={"avgFP" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Med" sortKey={"medianFP" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Form" sortKey={"formLast3" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Δ" sortKey={"formDelta" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Floor" sortKey={"floor" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ceil" sortKey={"ceiling" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label={`vs ${matchInfo.awayTeam.length > 4 ? "Opp" : (teamFilter === matchInfo.awayTeam ? matchInfo.homeTeam : matchInfo.awayTeam)}`} sortKey={"vsOppAvg" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Venue" sortKey={"atVenueAvg" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Bat%" sortKey={"batPct" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Bowl%" sortKey={"bowlPct" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <TableHead className="min-w-[200px]"><Tip label="FP Distribution" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[120px]">{p.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                            <span className="text-[9px] text-muted-foreground">{p.team}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches || "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.matches > 0 ? p.avgFP : "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? p.medianFP : "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.formLast3 || "—"}</TableCell>
                    <TableCell className={cn("tabular-nums text-xs", p.matches > 0 ? deltaClass(p.formDelta) : "text-muted-foreground")}>
                      {p.matches > 0 ? formatDelta(p.formDelta) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? p.floor : "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? p.ceiling : "—"}</TableCell>
                    <TableCell className={cn("tabular-nums text-xs", p.vsOppAvg !== null && p.avgFP > 0 && (p.vsOppAvg > p.avgFP * 1.15 ? "text-emerald-600 dark:text-emerald-400" : p.vsOppAvg < p.avgFP * 0.85 ? "text-red-500 dark:text-red-400" : ""))}>
                      {p.vsOppAvg !== null ? (
                        <span className="font-medium">{p.vsOppAvg} <span className="text-muted-foreground text-[9px]">({p.vsOppMatches}m)</span></span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-xs", p.atVenueAvg !== null && p.avgFP > 0 && (p.atVenueAvg > p.avgFP * 1.15 ? "text-emerald-600 dark:text-emerald-400" : p.atVenueAvg < p.avgFP * 0.85 ? "text-red-500 dark:text-red-400" : ""))}>
                      {p.atVenueAvg !== null ? (
                        <span className="font-medium">{p.atVenueAvg} <span className="text-muted-foreground text-[9px]">({p.atVenueMatches}m)</span></span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? `${p.batPct}` : "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? `${p.bowlPct}` : "—"}</TableCell>
                    <TableCell>
                      {p.scores.length > 0 ? (
                        <StripChart
                          scores={p.scores}
                          mean={p.avgFP}
                          median={p.medianFP}
                          color={p.color}
                          width={200}
                          height={28}
                          labels={p.matchHistory.map((m) => `M${m.matchNumber} vs ${m.opponent}`)}
                        />
                      ) : <span className="text-xs text-muted-foreground">No data</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Tab 1: Players
// ============================================================

function PlayersTab({
  stats, ratings, benchmarks, formCurves, matchCount,
}: {
  stats: PlayerAnalytics[]; ratings: PowerRating[]; benchmarks: RoleBenchmark[]; formCurves: Props["formCurves"]; matchCount: number
}) {
  const ratingMap = useMemo(() => new Map(ratings.map((r) => [r.id, r])), [ratings])
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(stats, "avgFP")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // KPI cards
  const mostConsistent = [...stats].filter((p) => p.matches >= 5).sort((a, b) => a.cv - b.cv)[0]
  const highestCeiling = [...stats].sort((a, b) => b.ceiling - a.ceiling)[0]
  const bestForm = [...stats].filter((p) => p.matches >= 3).sort((a, b) => b.formLast3 - a.formLast3)[0]
  const mostImproved = [...stats].filter((p) => p.matches >= 3).sort((a, b) => b.formDelta - a.formDelta)[0]

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mostConsistent && (
          <StatCard icon={Shield} value={mostConsistent.name.split(" ").pop() ?? ""} label={`Most Consistent (CV: ${mostConsistent.cv})`} gradient="from-emerald-500/10" iconColor="bg-emerald-500/15 text-emerald-600" />
        )}
        {highestCeiling && (
          <StatCard icon={TrendingUp} value={highestCeiling.ceiling} label={`Highest Ceiling · ${highestCeiling.name.split(" ").pop()}`} gradient="from-amber-500/10" iconColor="bg-amber-500/15 text-amber-600" />
        )}
        {bestForm && (
          <StatCard icon={Sparkles} value={bestForm.formLast3} label={`Best Form · ${bestForm.name.split(" ").pop()}`} gradient="from-blue-500/10" iconColor="bg-blue-500/15 text-blue-600" />
        )}
        {mostImproved && (
          <StatCard icon={Target} value={formatDelta(mostImproved.formDelta)} label={`Most Improved · ${mostImproved.name.split(" ").pop()}`} gradient="from-purple-500/10" iconColor="bg-purple-500/15 text-purple-600" trend={{ value: `${mostImproved.formDelta > 0 ? "+" : ""}${mostImproved.formDelta}`, positive: mostImproved.formDelta > 0 }} />
        )}
      </div>

      {/* Main Player Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Player Performance ({sorted.length} players)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Player</TableHead>
                  <TableHead><Tip label="Rating" /></TableHead>
                  <SortHeader label="M" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Avg" sortKey="avgFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Med" sortKey="medianFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Form" sortKey="formLast3" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Δ" sortKey="formDelta" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Floor" sortKey="floor" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ceil" sortKey="ceiling" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="CV" sortKey="cv" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Bat" sortKey="battingFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Bowl" sortKey="bowlingFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Field" sortKey="fieldingFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => (
                  <React.Fragment key={p.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[120px]">{p.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                            <span className="text-[9px] text-muted-foreground">{p.team}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const r = ratingMap.get(p.id)
                        return r ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${r.powerRating}%` }} />
                            </div>
                            <span className="tabular-nums text-[10px] font-bold">{r.powerRating}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>
                      })()}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold">{p.avgFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.medianFP}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.formLast3}</TableCell>
                    <TableCell className={cn("tabular-nums text-xs font-medium", deltaClass(p.formDelta))}>
                      {formatDelta(p.formDelta)}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.floor}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.ceiling}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 tabular-nums",
                        p.cv < 30 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : p.cv < 60 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-red-500/15 text-red-700 dark:text-red-300"
                      )}>{p.cv}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.battingFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.bowlingFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.fieldingFP}</TableCell>
                  </TableRow>
                  {expandedId === p.id && p.matchHistory.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="bg-muted/20 p-3">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-semibold">FP Distribution</span>
                            <StripChart
                              scores={p.scores}
                              mean={p.avgFP}
                              median={p.medianFP}
                              color={p.color}
                              width={280}
                              height={32}
                              labels={p.matchHistory.map((m) => `M${m.matchNumber} vs ${m.opponent}`)}
                            />
                          </div>
                          <div className="overflow-x-auto">
                            <table className="text-xs w-full">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left py-1 pr-3 font-medium">Match</th>
                                  <th className="text-left py-1 pr-3 font-medium">vs</th>
                                  <th className="text-right py-1 pr-3 font-medium">FP</th>
                                  <th className="text-right py-1 pr-3 font-medium">Bat</th>
                                  <th className="text-right py-1 pr-3 font-medium">Bowl</th>
                                  <th className="text-right py-1 pr-3 font-medium">Field</th>
                                  <th className="py-1 pl-2 font-medium">Breakdown</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.matchHistory.map((m) => {
                                  const total = Math.max(m.batting + m.bowling + m.fielding, 1)
                                  return (
                                    <tr key={m.matchNumber} className="border-t border-border/30">
                                      <td className="py-1 pr-3 tabular-nums">M{m.matchNumber}</td>
                                      <td className="py-1 pr-3">{m.opponent}</td>
                                      <td className={cn("py-1 pr-3 text-right tabular-nums font-semibold", m.fp >= p.avgFP ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{m.fp}</td>
                                      <td className="py-1 pr-3 text-right tabular-nums text-blue-600 dark:text-blue-400">{m.batting > 0 ? m.batting : "—"}</td>
                                      <td className="py-1 pr-3 text-right tabular-nums text-red-600 dark:text-red-400">{m.bowling > 0 ? m.bowling : "—"}</td>
                                      <td className="py-1 pr-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{m.fielding > 0 ? m.fielding : "—"}</td>
                                      <td className="py-1 pl-2">
                                        <div className="flex h-3 w-32 rounded-sm overflow-hidden">
                                          {m.batting > 0 && <div className="bg-blue-500/70" style={{ width: `${(m.batting / total) * 100}%` }} />}
                                          {m.bowling > 0 && <div className="bg-red-500/70" style={{ width: `${(m.bowling / total) * 100}%` }} />}
                                          {m.fielding > 0 && <div className="bg-amber-500/70" style={{ width: `${(m.fielding / total) * 100}%` }} />}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Benchmarks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Role Benchmarks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Avg FP</TableHead>
                <TableHead>Median FP</TableHead>
                <TableHead>Best</TableHead>
                <TableHead>Worst</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {benchmarks.map((b) => (
                <TableRow key={b.role}>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", ROLE_COLORS[b.role])}>{b.role}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">{b.playerCount}</TableCell>
                  <TableCell className="tabular-nums text-xs font-bold">{b.avgFP}</TableCell>
                  <TableCell className="tabular-nums text-xs">{b.medianFP}</TableCell>
                  <TableCell className="text-xs">{b.bestPlayer} <span className="text-muted-foreground">({b.bestAvg})</span></TableCell>
                  <TableCell className="text-xs">{b.worstPlayer} <span className="text-muted-foreground">({b.worstAvg})</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Curves Chart */}
      {formCurves.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Form Curves — Rolling 3-Match Average (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <LineChart
                series={formCurves.map((fc) => ({
                  label: fc.name.split(" ").pop() ?? fc.name,
                  values: fc.rollingAvg,
                  color: fc.color,
                }))}
                xLabels={Array.from({ length: matchCount }, (_, i) => `M${i + 1}`)}
                width={Math.max(400, matchCount * 40)}
                height={200}
                showDots={matchCount <= 20}
                showArea={false}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// Tab 2: Ratings
// ============================================================

function RatingsTab({ ratings }: { ratings: PowerRating[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(ratings, "powerRating")

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Sparkles} value={sorted[0]?.name.split(" ").pop() ?? ""} label={`#1 Power Rating (${sorted[0]?.powerRating})`} gradient="from-amber-500/10" iconColor="bg-amber-500/15 text-amber-600" />
          {(() => {
            const bestValue = [...ratings].sort((a, b) => b.valueRating - a.valueRating)[0]
            return bestValue ? (
              <StatCard icon={Target} value={bestValue.name.split(" ").pop() ?? ""} label={`Best Value (${bestValue.valueRating})`} gradient="from-emerald-500/10" iconColor="bg-emerald-500/15 text-emerald-600" />
            ) : null
          })()}
          {(() => {
            const mostVolatile = [...ratings].sort((a, b) => {
              const aCV = a.volatility === "high" ? 3 : a.volatility === "medium" ? 2 : 1
              const bCV = b.volatility === "high" ? 3 : b.volatility === "medium" ? 2 : 1
              return bCV - aCV || b.avgFP - a.avgFP
            })[0]
            return mostVolatile ? (
              <StatCard icon={TrendingUp} value={mostVolatile.name.split(" ").pop() ?? ""} label={`Most Volatile (${mostVolatile.volatility})`} gradient="from-red-500/10" iconColor="bg-red-500/15 text-red-600" />
            ) : null
          })()}
          <StatCard icon={BarChart3} value={ratings.length} label="Players Rated" gradient="from-blue-500/10" iconColor="bg-blue-500/15 text-blue-600" />
        </div>
      )}

      {/* Power Rating Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Power Ratings & Models</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Player</TableHead>
                  <SortHeader label="Rating" sortKey="powerRating" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Form" sortKey="formScore" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Consist." sortKey="consistencyScore" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ceiling" sortKey="ceilingScore" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Role Δ" sortKey="roleDeltaScore" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <TableHead><Tip label="Vol." /></TableHead>
                  <SortHeader label="Own %" sortKey="ownershipPct" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Value" sortKey="valueRating" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Avg FP" sortKey="avgFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums text-xs text-muted-foreground font-bold">{i + 1}</TableCell>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[120px]">{p.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                            <span className="text-[9px] text-muted-foreground">{p.team}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                            style={{ width: `${p.powerRating}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs font-bold">{p.powerRating}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.formScore}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.consistencyScore}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.ceilingScore}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.roleDeltaScore}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", volatilityColor(p.volatility))}>{p.volatility}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.ownershipPct}%</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.valueRating}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.avgFP}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Tab 3: Match Preview
// ============================================================

function PreviewTab({ data }: { data: Props["matchPreview"] }) {
  const [teamFilter, setTeamFilter] = useState<string | null>(null)

  if (!data) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        No upcoming match found. Check back when the next match is scheduled.
      </div>
    )
  }

  const { predictions, suggestedTeam, matchInfo } = data
  const filtered = teamFilter
    ? predictions.filter((p) => p.team === teamFilter)
    : predictions

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(filtered, "xfp")

  return (
    <div className="space-y-6 mt-4">
      {/* Match Header */}
      <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Match {matchInfo.matchNumber}</p>
              <p className="text-lg font-bold">
                {matchInfo.homeTeam} vs {matchInfo.awayTeam}
              </p>
              <p className="text-xs text-muted-foreground">{matchInfo.venue}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setTeamFilter(null)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                  !teamFilter ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground")}
              >All</button>
              <button
                onClick={() => setTeamFilter(matchInfo.homeTeam)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                  teamFilter === matchInfo.homeTeam ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground")}
              >{matchInfo.homeTeam}</button>
              <button
                onClick={() => setTeamFilter(matchInfo.awayTeam)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                  teamFilter === matchInfo.awayTeam ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground")}
              >{matchInfo.awayTeam}</button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Team */}
      {suggestedTeam && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Suggested Optimal XI — Projected {suggestedTeam.totalProjected} pts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedTeam.players
                .sort((a, b) => {
                  const roleOrder: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BOWL: 3 }
                  return (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4)
                })
                .map((p) => {
                  const isCaptain = p.id === suggestedTeam.captainId
                  const isVC = p.id === suggestedTeam.vcId
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border",
                        isCaptain ? "border-amber-500/50 bg-amber-500/10"
                        : isVC ? "border-blue-500/50 bg-blue-500/10"
                        : "border-overlay-border bg-overlay-subtle"
                      )}
                    >
                      <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                      <span className="font-medium">{p.name.split(" ").pop()}</span>
                      <span className="tabular-nums text-muted-foreground">{p.xfp}</span>
                      {isCaptain && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-amber-500 text-white">C</Badge>}
                      {isVC && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-blue-500 text-white">VC</Badge>}
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">xFP Predictions ({sorted.length} players)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Player</TableHead>
                  <SortHeader label="Season Avg" sortKey="seasonAvg" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Form (L3)" sortKey="formLast3" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Venue" sortKey="venueAvg" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="vs Opp" sortKey="vsOpponentAvg" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="xFP" sortKey="xfp" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Own %" sortKey="ownershipPct" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => (
                  <TableRow key={p.id} className={p.isDifferential ? "bg-amber-500/5" : ""}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[120px]">{p.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                            <span className="text-[9px] text-muted-foreground">{p.team}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.seasonAvg}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.formLast3}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.venueAvg ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.vsOpponentAvg ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold text-primary">{p.xfp}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.ownershipPct}%</TableCell>
                    <TableCell>
                      {p.isDifferential && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">DIFF</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Tab 4: Users
// ============================================================

function UsersTab({
  ownership, captainROI, optimalTeams, dqs, matchCount,
}: {
  ownership: OwnershipEntry[]; captainROI: CaptainROI[]; optimalTeams: OptimalTeam[]; dqs: UserDQS[]; matchCount: number
}) {
  const { sorted: sortedOwnership, sortKey: oKey, sortDir: oDir, toggleSort: oToggle } = useSortableTable(ownership.slice(0, 40), "timesPicked")
  const { sorted: sortedCaptain, sortKey: cKey, sortDir: cDir, toggleSort: cToggle } = useSortableTable(captainROI.slice(0, 20), "avgCaptainBonus")
  const { sorted: sortedDQS, sortKey: dKey, sortDir: dDir, toggleSort: dToggle } = useSortableTable(dqs, "avgDQS")

  return (
    <div className="space-y-6 mt-4">
      {/* DQS Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Decision Quality Score (DQS)</CardTitle>
          <p className="text-xs text-muted-foreground">% of theoretical optimal score achieved</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>User</TableHead>
                <SortHeader label="Avg DQS" sortKey="avgDQS" currentKey={dKey} currentDir={dDir} onSort={dToggle} />
                <SortHeader label="Best" sortKey="bestDQS" currentKey={dKey} currentDir={dDir} onSort={dToggle} />
                <SortHeader label="Worst" sortKey="worstDQS" currentKey={dKey} currentDir={dDir} onSort={dToggle} />
                <SortHeader label="Matches" sortKey="matches" currentKey={dKey} currentDir={dDir} onSort={dToggle} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDQS.map((u, i) => (
                <TableRow key={u.userId}>
                  <TableCell className="tabular-nums text-xs font-bold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium">{u.displayName}</TableCell>
                  <TableCell className="tabular-nums text-xs font-bold">{u.avgDQS}%</TableCell>
                  <TableCell className="tabular-nums text-xs text-emerald-600 dark:text-emerald-400">{u.bestDQS}%</TableCell>
                  <TableCell className="tabular-nums text-xs text-red-500">{u.worstDQS}%</TableCell>
                  <TableCell className="tabular-nums text-xs">{u.matches}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ownership Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Player Ownership (Top 40)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Player</TableHead>
                  <SortHeader label="Picked" sortKey="timesPicked" currentKey={oKey} currentDir={oDir} onSort={oToggle} />
                  <SortHeader label="Own %" sortKey="ownershipPct" currentKey={oKey} currentDir={oDir} onSort={oToggle} />
                  <SortHeader label="Cap" sortKey="timesCaptained" currentKey={oKey} currentDir={oDir} onSort={oToggle} />
                  <SortHeader label="Cap %" sortKey="captainPct" currentKey={oKey} currentDir={oDir} onSort={oToggle} />
                  <SortHeader label="VC" sortKey="timesVC" currentKey={oKey} currentDir={oDir} onSort={oToggle} />
                  <SortHeader label="Avg FP" sortKey="avgFPWhenPicked" currentKey={oKey} currentDir={oDir} onSort={oToggle} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOwnership.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[120px]">{p.name}</p>
                          <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.timesPicked}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.ownershipPct}%</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.timesCaptained}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.captainPct}%</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.timesVC}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.avgFPWhenPicked}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Captain ROI */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Captain ROI — Actual 2x Returns</CardTitle>
          <p className="text-xs text-muted-foreground">Base FP when captained · 2x Score shows actual captain return · Sorted by avg 2x</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Player</TableHead>
                  <SortHeader label="Times C" sortKey="timesCaptained" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Avg Base" sortKey="avgCaptainBonus" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Avg 2x" sortKey="avgCaptainBonus" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Best 2x" sortKey="bestCaptainGame" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Worst 2x" sortKey="worstCaptainGame" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <TableHead>Range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCaptain.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{p.name}</p>
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", ROLE_COLORS[p.role])}>{p.role}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.timesCaptained}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.avgCaptainBonus}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold text-primary">{Math.round(p.avgCaptainBonus * 2)}</TableCell>
                    <TableCell className="tabular-nums text-xs text-emerald-600 dark:text-emerald-400 font-medium">{Math.round(p.bestCaptainGame * 2)}</TableCell>
                    <TableCell className="tabular-nums text-xs text-red-500 font-medium">{Math.round(p.worstCaptainGame * 2)}</TableCell>
                    <TableCell>
                      {p.timesCaptained >= 2 ? (
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground tabular-nums">
                          <span>{Math.round(p.worstCaptainGame * 2)}</span>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden relative">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                              style={{ width: `${Math.min(100, (p.avgCaptainBonus / Math.max(p.bestCaptainGame, 1)) * 100)}%` }}
                            />
                          </div>
                          <span>{Math.round(p.bestCaptainGame * 2)}</span>
                        </div>
                      ) : <span className="text-[9px] text-muted-foreground">1 game</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Optimal Teams */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Optimal Team per Match</CardTitle>
          <p className="text-xs text-muted-foreground">Theoretical maximum with role constraints + 2x Captain + 1.5x VC</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match</TableHead>
                <TableHead>Optimal Score</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>VC</TableHead>
                <TableHead>Composition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optimalTeams.map((o) => {
                const capPlayer = o.players.find((p) => p.id === o.captainId)
                const vcPlayer = o.players.find((p) => p.id === o.vcId)
                const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
                o.players.forEach((p) => { roleCounts[p.role]++ })
                return (
                  <TableRow key={o.matchId}>
                    <TableCell className="tabular-nums text-xs font-medium">M{o.matchNumber}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold">{o.totalScore}</TableCell>
                    <TableCell className="text-xs">{capPlayer?.name.split(" ").pop()} <span className="text-muted-foreground">({capPlayer?.fp})</span></TableCell>
                    <TableCell className="text-xs">{vcPlayer?.name.split(" ").pop()} <span className="text-muted-foreground">({vcPlayer?.fp})</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Object.entries(roleCounts).map(([r, c]) => `${c}${r}`).join(" · ")}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Tab: Matchups (Venues + Pace/Spin merged)
// ============================================================

function MatchupsTab({ venues, matchRows, paceSpinVenues, paceSpinTeams, globalRoleAvg }: {
  venues: VenueAnalytics[]; matchRows: MatchScoringRow[];
  paceSpinVenues: PaceSpinVenueRow[]; paceSpinTeams: PaceSpinTeamRow[];
  globalRoleAvg: Record<string, number>
}) {
  return (
    <div className="space-y-6 mt-4">
      <VenuesSection venues={venues} matchRows={matchRows} globalRoleAvg={globalRoleAvg} />
      <Separator />
      <h3 className="text-sm font-semibold pt-2">Pace vs Spin Analysis</h3>
      <PaceSpinSection venues={paceSpinVenues} teams={paceSpinTeams} />
    </div>
  )
}

// ============================================================
// Matchups: Venues Section
// ============================================================

function VenuesSection({ venues, matchRows }: { venues: VenueAnalytics[]; matchRows: MatchScoringRow[] }) {
  const { sorted: sortedVenues, sortKey: vKey, sortDir: vDir, toggleSort: vToggle } = useSortableTable(venues, "avgTotalFP")
  const { sorted: sortedMatches, sortKey: mKey, sortDir: mDir, toggleSort: mToggle } = useSortableTable(matchRows, "matchNumber", "asc")

  // Role x Venue matrix
  const allRoles = ["WK", "BAT", "AR", "BOWL"]

  return (
    <div className="space-y-6 mt-4">
      {/* Venue Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Venue Scoring Patterns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Venue</TableHead>
                  <SortHeader label="M" sortKey="matches" currentKey={vKey} currentDir={vDir} onSort={vToggle} />
                  <SortHeader label="Avg FP" sortKey="avgTotalFP" currentKey={vKey} currentDir={vDir} onSort={vToggle} />
                  <SortHeader label="Bat FP" sortKey="avgBattingFP" currentKey={vKey} currentDir={vDir} onSort={vToggle} />
                  <SortHeader label="Bowl FP" sortKey="avgBowlingFP" currentKey={vKey} currentDir={vDir} onSort={vToggle} />
                  <SortHeader label="Bat %" sortKey="battingPct" currentKey={vKey} currentDir={vDir} onSort={vToggle} />
                  <TableHead>Type</TableHead>
                  <TableHead>Best Role</TableHead>
                  <TableHead>Top Player</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVenues.map((v) => (
                  <TableRow key={v.venue}>
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">{v.venue}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.matches}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold">{v.avgTotalFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.avgBattingFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.avgBowlingFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.battingPct}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", classificationColor(v.classification))}>
                        {v.classification === "bat-friendly" ? "BAT" : v.classification === "bowl-friendly" ? "BOWL" : "BAL"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{v.bestRole}</TableCell>
                    <TableCell className="text-xs truncate max-w-[120px]">{v.topPerformer}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role x Venue Matrix */}
      {venues.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Role × Venue Matrix (Avg FP)</CardTitle>
            <p className="text-xs text-muted-foreground">Green = above role average, Red = below</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Venue</TableHead>
                    {allRoles.map((r) => (
                      <TableHead key={r} className="text-center">
                        <Badge variant="outline" className={cn("text-[9px]", ROLE_COLORS[r as PlayerRole])}>{r}</Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v) => {
                    // Compute role averages across all venues for comparison
                    const globalRoleAvg: Record<string, number> = {}
                    for (const r of allRoles) {
                      const allVals = venues.map((vn) => vn.roleAvg[r] ?? 0).filter((x) => x > 0)
                      globalRoleAvg[r] = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0
                    }
                    return (
                      <TableRow key={v.venue}>
                        <TableCell className="text-xs font-medium max-w-[200px] truncate">{v.venue}</TableCell>
                        {allRoles.map((r) => {
                          const val = v.roleAvg[r] ?? 0
                          const avg = globalRoleAvg[r]
                          const isAbove = val > avg
                          return (
                            <TableCell key={r} className="text-center">
                              <span className={cn(
                                "tabular-nums text-xs font-medium",
                                val > 0 ? (isAbove ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400") : "text-muted-foreground"
                              )}>
                                {val > 0 ? val : "—"}
                              </span>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match Scoring Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Match Scoring History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Match" sortKey="matchNumber" currentKey={mKey} currentDir={mDir} onSort={mToggle} />
                  <TableHead>Teams</TableHead>
                  <TableHead>Venue</TableHead>
                  <SortHeader label="Total FP" sortKey="totalFP" currentKey={mKey} currentDir={mDir} onSort={mToggle} />
                  <SortHeader label="Avg User" sortKey="avgUserScore" currentKey={mKey} currentDir={mDir} onSort={mToggle} />
                  <SortHeader label="Top User" sortKey="topUserScore" currentKey={mKey} currentDir={mDir} onSort={mToggle} />
                  <TableHead>Winner</TableHead>
                  <SortHeader label="Best Player" sortKey="highestPlayerFP" currentKey={mKey} currentDir={mDir} onSort={mToggle} />
                  <TableHead>Player</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMatches.map((m) => (
                  <TableRow key={m.matchId}>
                    <TableCell className="tabular-nums text-xs font-medium">M{m.matchNumber}</TableCell>
                    <TableCell className="text-xs">{m.homeTeam} vs {m.awayTeam}</TableCell>
                    <TableCell className="text-xs truncate max-w-[120px]">{m.venue}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold">{m.totalFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{m.avgUserScore}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{m.topUserScore}</TableCell>
                    <TableCell className="text-xs">{m.topUserName}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{m.highestPlayerFP}</TableCell>
                    <TableCell className="text-xs truncate max-w-[100px]">{m.highestPlayerName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Tab: Pace vs Spin
// ============================================================

const PACE_COLOR = "#3b82f6"
const SPIN_COLOR = "#f59e0b"

const dominanceColor = (d: "pace" | "spin" | "balanced") =>
  d === "pace" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    : d === "spin" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"

function PaceSpinSection({ venues, teams }: { venues: PaceSpinVenueRow[]; teams: PaceSpinTeamRow[] }) {
  const venueSorter = useSortableTable(venues, "paceWickets" as keyof PaceSpinVenueRow, "desc")
  const teamSorter = useSortableTable(teams, "paceWicketsAgainst" as keyof PaceSpinTeamRow, "desc")

  // KPIs
  const mostPaceVenue = venues.reduce((best, v) => (v.paceWickets > (best?.paceWickets ?? 0) ? v : best), venues[0])
  const mostSpinVenue = venues.reduce((best, v) => (v.spinWickets > (best?.spinWickets ?? 0) ? v : best), venues[0])
  const mostVulnTeam = teams.reduce((best, t) => {
    const total = t.paceWicketsAgainst + t.spinWicketsAgainst
    const bestTotal = (best?.paceWicketsAgainst ?? 0) + (best?.spinWicketsAgainst ?? 0)
    return total > bestTotal ? t : best
  }, teams[0])

  // Chart data
  const venueBarGroups = venues.filter((v) => v.matches >= 1).slice(0, 10).map((v) => ({
    label: v.venue.split(",")[0].replace(/Stadium|Ground|International/gi, "").trim().slice(0, 12),
    bars: [
      { label: "Pace", value: v.paceWickets, color: PACE_COLOR },
      { label: "Spin", value: v.spinWickets, color: SPIN_COLOR },
    ],
  }))

  const teamBarGroups = teams.map((t) => ({
    label: t.team,
    bars: [
      { label: "vs Pace", value: t.paceWicketsAgainst, color: PACE_COLOR },
      { label: "vs Spin", value: t.spinWicketsAgainst, color: SPIN_COLOR },
    ],
  }))

  return (
    <div className="space-y-4 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {mostPaceVenue && (
          <StatCard icon={Target} value={mostPaceVenue.venue.split(",")[0].trim()} label={`Top Pace Venue · ${mostPaceVenue.paceWickets} wkts`} gradient="from-blue-500/10" iconColor="bg-blue-500/15 text-blue-600" />
        )}
        {mostSpinVenue && (
          <StatCard icon={Sparkles} value={mostSpinVenue.venue.split(",")[0].trim()} label={`Top Spin Venue · ${mostSpinVenue.spinWickets} wkts`} gradient="from-amber-500/10" iconColor="bg-amber-500/15 text-amber-600" />
        )}
        {mostVulnTeam && (
          <StatCard icon={Shield} value={mostVulnTeam.team} label={`Most Wickets Lost · ${mostVulnTeam.paceWicketsAgainst + mostVulnTeam.spinWicketsAgainst} total`} gradient="from-red-500/10" iconColor="bg-red-500/15 text-red-600" />
        )}
      </div>

      {/* Venue wickets chart */}
      {venueBarGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Wickets by Venue: Pace vs Spin</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <GroupedBar groups={venueBarGroups} height={220} barWidth={18} />
          </CardContent>
        </Card>
      )}

      {/* Venue table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Venue Pace/Spin Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">Venue</TableHead>
                  <SortHeader label="M" sortKey={"matches" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <SortHeader label="Pace W" sortKey={"paceWickets" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <SortHeader label="Spin W" sortKey={"spinWickets" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <SortHeader label="Pace Econ" sortKey={"paceEconomy" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <SortHeader label="Spin Econ" sortKey={"spinEconomy" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <SortHeader label="Pace Avg FP" sortKey={"paceAvgFP" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <SortHeader label="Spin Avg FP" sortKey={"spinAvgFP" as keyof PaceSpinVenueRow} currentKey={venueSorter.sortKey} currentDir={venueSorter.sortDir} onSort={venueSorter.toggleSort} />
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venueSorter.sorted.map((v) => (
                  <TableRow key={v.venue}>
                    <TableCell className="sticky left-0 bg-background z-10 text-xs font-medium truncate max-w-[150px]">{v.venue.split(",")[0].trim()}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.matches}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium text-blue-600 dark:text-blue-400">{v.paceWickets}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium text-amber-600 dark:text-amber-400">{v.spinWickets}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.paceEconomy}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.spinEconomy}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.paceAvgFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{v.spinAvgFP}</TableCell>
                    <TableCell><Badge className={cn("text-[10px]", dominanceColor(v.dominance))}>{v.dominance}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Team vulnerability chart */}
      {teamBarGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Team Vulnerability: Wickets Lost to Pace vs Spin</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <GroupedBar groups={teamBarGroups} height={220} barWidth={18} />
          </CardContent>
        </Card>
      )}

      {/* Team table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Team Pace/Spin Vulnerability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <SortHeader label="M" sortKey={"totalMatchesBatted" as keyof PaceSpinTeamRow} currentKey={teamSorter.sortKey} currentDir={teamSorter.sortDir} onSort={teamSorter.toggleSort} />
                  <SortHeader label="vs Pace W" sortKey={"paceWicketsAgainst" as keyof PaceSpinTeamRow} currentKey={teamSorter.sortKey} currentDir={teamSorter.sortDir} onSort={teamSorter.toggleSort} />
                  <SortHeader label="vs Spin W" sortKey={"spinWicketsAgainst" as keyof PaceSpinTeamRow} currentKey={teamSorter.sortKey} currentDir={teamSorter.sortDir} onSort={teamSorter.toggleSort} />
                  <TableHead><Tip label="Weakness" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamSorter.sorted.map((t) => (
                  <TableRow key={t.team}>
                    <TableCell className="text-xs font-medium">{t.team}</TableCell>
                    <TableCell className="tabular-nums text-xs">{t.totalMatchesBatted}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium text-blue-600 dark:text-blue-400">{t.paceWicketsAgainst}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium text-amber-600 dark:text-amber-400">{t.spinWicketsAgainst}</TableCell>
                    <TableCell><Badge className={cn("text-[10px]", dominanceColor(t.vulnerability))}>{t.vulnerability}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Tab: Compare Players
// ============================================================

function PlayerSearch({
  label,
  allPlayers,
  selectedId,
  excludeIds,
  onSelect,
  onClear,
}: {
  label: string
  allPlayers: PlayerAnalytics[]
  selectedId: string | null
  excludeIds: Set<string>
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const selected = selectedId ? allPlayers.find((p) => p.id === selectedId) : null

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return allPlayers
      .filter((p) => !excludeIds.has(p.id) && p.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [allPlayers, query, excludeIds])

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Badge className={cn("text-[10px] shrink-0", ROLE_COLORS[selected.role])}>{selected.role}</Badge>
        <span className="font-medium truncate">{selected.name}</span>
        <span className="text-muted-foreground text-xs">({selected.team})</span>
        <button onClick={onClear} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={label}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-52 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p.id); setQuery(""); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 text-left"
            >
              <Badge className={cn("text-[10px] shrink-0", ROLE_COLORS[p.role])}>{p.role}</Badge>
              <span className="truncate">{p.name}</span>
              <span className="text-muted-foreground text-xs ml-auto shrink-0">{p.team} · {p.avgFP.toFixed(0)} avg</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const RADAR_AXES = [
  { key: "avgFP" as const, label: "Avg FP", maxFn: (ps: PlayerAnalytics[]) => Math.max(...ps.map((p) => p.avgFP), 100) },
  { key: "consistency" as const, label: "Consistency", maxFn: () => 100 },
  { key: "ceiling" as const, label: "Ceiling", maxFn: (ps: PlayerAnalytics[]) => Math.max(...ps.map((p) => p.ceiling), 150) },
  { key: "formLast3" as const, label: "Form L3", maxFn: (ps: PlayerAnalytics[]) => Math.max(...ps.map((p) => p.formLast3), 100) },
  { key: "battingPct" as const, label: "Batting %", maxFn: () => 100 },
  { key: "bowlingPct" as const, label: "Bowling %", maxFn: () => 100 },
]

function CompareTab({ allPlayers }: { allPlayers: PlayerAnalytics[] }) {
  const [ids, setIds] = useState<(string | null)[]>([null, null, null])

  const selectedPlayers = useMemo(() =>
    ids.map((id) => id ? allPlayers.find((p) => p.id === id) ?? null : null),
    [ids, allPlayers]
  )
  const active = selectedPlayers.filter(Boolean) as PlayerAnalytics[]
  const excludeIds = useMemo(() => new Set(ids.filter(Boolean) as string[]), [ids])

  const radarData = useMemo(() => {
    if (active.length < 2) return null
    const axes = RADAR_AXES.map((a) => ({ label: a.label, max: a.maxFn(allPlayers) }))
    const series = active.map((p) => ({
      label: `${p.name} (${p.team})`,
      color: p.color,
      values: RADAR_AXES.map((a) => {
        if (a.key === "consistency") return Math.max(0, 100 - p.cv)
        if (a.key === "battingPct") return p.totalFP > 0 ? (p.battingFP / p.totalFP) * 100 : 0
        if (a.key === "bowlingPct") return p.totalFP > 0 ? (p.bowlingFP / p.totalFP) * 100 : 0
        return p[a.key]
      }),
    }))
    return { axes, series }
  }, [active, allPlayers])

  const COMPARE_STATS: { label: string; fn: (p: PlayerAnalytics) => string; lowerIsBetter?: boolean }[] = [
    { label: "Matches", fn: (p) => p.matches.toString() },
    { label: "Total FP", fn: (p) => p.totalFP.toFixed(0) },
    { label: "Avg FP", fn: (p) => p.avgFP.toFixed(1) },
    { label: "Median FP", fn: (p) => p.medianFP.toFixed(1) },
    { label: "Floor", fn: (p) => p.floor.toFixed(0) },
    { label: "Ceiling", fn: (p) => p.ceiling.toFixed(0) },
    { label: "Std Dev", fn: (p) => p.stddev.toFixed(1), lowerIsBetter: true },
    { label: "CV", fn: (p) => p.cv.toFixed(0) + "%", lowerIsBetter: true },
    { label: "Form L3", fn: (p) => p.formLast3.toFixed(1) },
    { label: "Form Δ", fn: (p) => (p.formDelta > 0 ? "+" : "") + p.formDelta.toFixed(1) },
    { label: "Batting FP", fn: (p) => p.battingFP.toFixed(0) },
    { label: "Bowling FP", fn: (p) => p.bowlingFP.toFixed(0) },
    { label: "Fielding FP", fn: (p) => p.fieldingFP.toFixed(0) },
  ]

  return (
    <div className="space-y-4 mt-4">
      {/* Player selectors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Select Players to Compare</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ids.map((id, i) => (
            <PlayerSearch
              key={i}
              label={`Player ${i + 1}...`}
              allPlayers={allPlayers}
              selectedId={id}
              excludeIds={excludeIds}
              onSelect={(pid) => setIds((prev) => { const next = [...prev]; next[i] = pid; return next })}
              onClear={() => setIds((prev) => { const next = [...prev]; next[i] = null; return next })}
            />
          ))}
        </CardContent>
      </Card>

      {active.length < 2 && (
        <p className="text-sm text-muted-foreground text-center py-8">Select at least 2 players to compare</p>
      )}

      {radarData && (
        <>
          {/* Radar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Performance Radar</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <RadarChart axes={radarData.axes} series={radarData.series} size={300} />
            </CardContent>
          </Card>

          {/* Stat comparison table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Stat</TableHead>
                      {active.map((p) => (
                        <TableHead key={p.id} className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold text-xs">{p.name}</span>
                            <Badge className={cn("text-[9px]", ROLE_COLORS[p.role])}>{p.role} · {p.team}</Badge>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPARE_STATS.map((stat) => {
                      const values = active.map((p) => parseFloat(stat.fn(p)))
                      const best = stat.lowerIsBetter ? Math.min(...values) : Math.max(...values)
                      return (
                        <TableRow key={stat.label}>
                          <TableCell className="text-xs text-muted-foreground font-medium">{stat.label}</TableCell>
                          {active.map((p, i) => (
                            <TableCell
                              key={p.id}
                              className={cn(
                                "text-center tabular-nums text-xs",
                                values[i] === best && active.length > 1 && "font-bold text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {stat.fn(p)}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

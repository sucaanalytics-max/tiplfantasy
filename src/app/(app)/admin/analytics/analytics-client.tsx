"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUpDown, TrendingUp, Shield, Eye, MapPin, ChevronDown, ChevronUp, Sparkles, Users, BarChart3, Target, Swords, GitCompareArrows, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { StatCard } from "@/components/stat-card"
import { LineChart } from "@/components/charts/line-chart"
import { RadarChart } from "@/components/charts/radar-chart"
import { GroupedBar } from "@/components/charts/grouped-bar"
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
        {label}
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
          <TabsTrigger value="ratings" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Ratings</TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Preview</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
          <TabsTrigger value="venues" className="gap-1.5"><MapPin className="h-3.5 w-3.5" />Venues</TabsTrigger>
          <TabsTrigger value="pacespin" className="gap-1.5"><Target className="h-3.5 w-3.5" />Pace/Spin</TabsTrigger>
          <TabsTrigger value="compare" className="gap-1.5"><GitCompareArrows className="h-3.5 w-3.5" />Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="nextmatch">
          <NextMatchTab
            playerStats={filteredPlayerStats}
            powerRatings={filteredPowerRatings}
            matchPreview={matchPreview}
            roleFilter={roleFilter}
          />
        </TabsContent>
        <TabsContent value="players">
          <PlayersTab stats={filteredPlayerStats} benchmarks={roleBenchmarks} formCurves={formCurves} matchCount={matchCount} />
        </TabsContent>
        <TabsContent value="ratings">
          <RatingsTab ratings={filteredPowerRatings} />
        </TabsContent>
        <TabsContent value="preview">
          <PreviewTab data={matchPreview} />
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
        <TabsContent value="venues">
          <VenuesTab venues={venueData} matchRows={matchScoringRows} />
        </TabsContent>
        <TabsContent value="pacespin">
          <PaceSpinTab venues={paceSpinVenues} teams={paceSpinTeams} />
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
  xfp: number | null
  venueAvg: number | null
  vsOpponentAvg: number | null
  ownershipPct: number
  isDifferential: boolean
  powerRating: number | null
  volatility: "low" | "medium" | "high" | null
}

function NextMatchTab({
  playerStats,
  powerRatings,
  matchPreview,
  roleFilter,
}: {
  playerStats: PlayerAnalytics[]
  powerRatings: PowerRating[]
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

  const { predictions, suggestedTeam, matchInfo } = matchPreview
  const predictionMap = new Map(predictions.map((p) => [p.id, p]))
  const ratingMap = new Map(powerRatings.map((p) => [p.id, p]))

  // Filter player stats to only players from the two match teams
  const matchTeams = new Set([matchInfo.homeTeam, matchInfo.awayTeam])
  const matchPlayers: NextMatchPlayerRow[] = playerStats
    .filter((p) => matchTeams.has(p.team) && roleFilter.has(p.role))
    .map((p) => {
      const pred = predictionMap.get(p.id)
      const rating = ratingMap.get(p.id)
      return {
        ...p,
        xfp: pred?.xfp ?? null,
        venueAvg: pred?.venueAvg ?? null,
        vsOpponentAvg: pred?.vsOpponentAvg ?? null,
        ownershipPct: pred?.ownershipPct ?? 0,
        isDifferential: pred?.isDifferential ?? false,
        powerRating: rating?.powerRating ?? null,
        volatility: rating?.volatility ?? null,
      }
    })

  // Also include players in predictions who don't have season stats yet (new to playing XI)
  const existingIds = new Set(matchPlayers.map((p) => p.id))
  for (const pred of predictions) {
    if (!existingIds.has(pred.id) && roleFilter.has(pred.role)) {
      matchPlayers.push({
        id: pred.id,
        name: pred.name,
        role: pred.role,
        team: pred.team,
        color: pred.color,
        matches: 0,
        totalFP: 0, avgFP: 0, medianFP: 0,
        floor: 0, ceiling: 0, stddev: 0, cv: 0,
        formLast3: pred.formLast3, formDelta: 0,
        battingFP: 0, bowlingFP: 0, fieldingFP: 0, penaltyFP: 0,
        scores: [], rollingAvg: [],
        xfp: pred.xfp,
        venueAvg: pred.venueAvg,
        vsOpponentAvg: pred.vsOpponentAvg,
        ownershipPct: pred.ownershipPct,
        isDifferential: pred.isDifferential,
        powerRating: null,
        volatility: null,
      })
    }
  }

  const filtered = teamFilter
    ? matchPlayers.filter((p) => p.team === teamFilter)
    : matchPlayers

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(filtered, "xfp" as keyof NextMatchPlayerRow)

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
              <button
                onClick={() => setTeamFilter(null)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                  !teamFilter ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground")}
              >Both</button>
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
              Suggested XI — Projected {suggestedTeam.totalProjected} pts
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

      {/* Full Stats Table for Match Players */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Match Players — Full Season Stats + Predictions ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Player</TableHead>
                  <SortHeader label="xFP" sortKey={"xfp" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Rating" sortKey={"powerRating" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="M" sortKey={"matches" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Avg" sortKey={"avgFP" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Form" sortKey={"formLast3" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Δ" sortKey={"formDelta" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Floor" sortKey={"floor" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ceil" sortKey={"ceiling" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="CV" sortKey={"cv" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Venue" sortKey={"venueAvg" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="vs Opp" sortKey={"vsOpponentAvg" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Own %" sortKey={"ownershipPct" as keyof NextMatchPlayerRow} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <TableHead>Vol.</TableHead>
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
                    <TableCell className="tabular-nums text-xs font-bold text-primary">{p.xfp ?? "—"}</TableCell>
                    <TableCell>
                      {p.powerRating !== null ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${p.powerRating}%` }} />
                          </div>
                          <span className="tabular-nums text-[10px] font-bold">{p.powerRating}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches || "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.matches > 0 ? p.avgFP : "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.formLast3 || "—"}</TableCell>
                    <TableCell className={cn("tabular-nums text-xs", p.matches > 0 ? deltaClass(p.formDelta) : "text-muted-foreground")}>
                      {p.matches > 0 ? formatDelta(p.formDelta) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? p.floor : "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.matches > 0 ? p.ceiling : "—"}</TableCell>
                    <TableCell>
                      {p.matches > 0 ? (
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 tabular-nums",
                          p.cv < 30 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : p.cv < 60 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-red-500/15 text-red-700 dark:text-red-300"
                        )}>{p.cv}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.venueAvg ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.vsOpponentAvg ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.ownershipPct}%</TableCell>
                    <TableCell>
                      {p.volatility ? (
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", volatilityColor(p.volatility))}>{p.volatility}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
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
// Tab 1: Players
// ============================================================

function PlayersTab({
  stats, benchmarks, formCurves, matchCount,
}: {
  stats: PlayerAnalytics[]; benchmarks: RoleBenchmark[]; formCurves: Props["formCurves"]; matchCount: number
}) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(stats, "avgFP")

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
                  <SortHeader label="M" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Total" sortKey="totalFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Avg" sortKey="avgFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Med" sortKey="medianFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Floor" sortKey="floor" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ceil" sortKey="ceiling" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="StdDev" sortKey="stddev" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="CV" sortKey="cv" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Form" sortKey="formLast3" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Δ" sortKey="formDelta" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Bat" sortKey="battingFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Bowl" sortKey="bowlingFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Field" sortKey="fieldingFP" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
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
                    <TableCell className="tabular-nums text-xs">{p.matches}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.totalFP}</TableCell>
                    <TableCell className="tabular-nums text-xs font-bold">{p.avgFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.medianFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.floor}</TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.ceiling}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.stddev}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 tabular-nums",
                        p.cv < 30 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : p.cv < 60 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-red-500/15 text-red-700 dark:text-red-300"
                      )}>{p.cv}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs font-medium">{p.formLast3}</TableCell>
                    <TableCell className={cn("tabular-nums text-xs font-medium", deltaClass(p.formDelta))}>
                      {formatDelta(p.formDelta)}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{p.battingFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.bowlingFP}</TableCell>
                    <TableCell className="tabular-nums text-xs">{p.fieldingFP}</TableCell>
                  </TableRow>
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
                  <TableHead>Volatility</TableHead>
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
          <CardTitle className="text-sm">Captain ROI</CardTitle>
          <p className="text-xs text-muted-foreground">Average base FP when captained (2x bonus = this value)</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Player</TableHead>
                  <SortHeader label="Times" sortKey="timesCaptained" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Avg Bonus" sortKey="avgCaptainBonus" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Best" sortKey="bestCaptainGame" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
                  <SortHeader label="Worst" sortKey="worstCaptainGame" currentKey={cKey} currentDir={cDir} onSort={cToggle} />
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
                    <TableCell className="tabular-nums text-xs font-bold">{p.avgCaptainBonus}</TableCell>
                    <TableCell className="tabular-nums text-xs text-emerald-600 dark:text-emerald-400">{p.bestCaptainGame}</TableCell>
                    <TableCell className="tabular-nums text-xs text-red-500">{p.worstCaptainGame}</TableCell>
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
// Tab 5: Venues
// ============================================================

function VenuesTab({ venues, matchRows }: { venues: VenueAnalytics[]; matchRows: MatchScoringRow[] }) {
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

function PaceSpinTab({ venues, teams }: { venues: PaceSpinVenueRow[]; teams: PaceSpinTeamRow[] }) {
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
                  <TableHead>Weakness</TableHead>
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

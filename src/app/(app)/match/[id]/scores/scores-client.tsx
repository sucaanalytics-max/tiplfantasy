"use client"

import { useCallback, useMemo, useState } from "react"
import { Trophy } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { LiveRefresher } from "@/components/live-refresher"
import { cn } from "@/lib/utils"
import { type PlayerLite, type PlayerScore, type Selection } from "@/lib/rivalry"
import { buildAnalysis } from "@/lib/match-analysis"

import { MatchHeroBand } from "@/components/match-hero-band"
import type { MatchStatus } from "@/lib/types"
import { StickyHeader } from "./_components/sticky-header"
import { StandingsTable } from "./_components/standings-table"
import { RivalPanel } from "./_components/rival-panel"
import { MyXIPanel } from "./_components/my-xi-panel"
import { OwnershipMatrix } from "./_components/ownership-matrix"
import { TopScorers } from "./_components/top-scorers"
import { useRankDelta } from "./_hooks/use-rank-delta"

// ─── Types (re-exported for page.tsx + panels) ─────────────────────────

export type TeamInfo = { short_name: string; name?: string | null; color: string; logo_url: string | null }

export type PlayerScoreRow = {
  id: string
  player_id: string
  fantasy_points: number | string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number | string
  runs_conceded: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
  breakdown: Record<string, number> | null
  dismissal?: string | null
  batting_position?: number | null
  player: { name: string; role: string; team_id: string; image_url: string | null; team: { short_name: string; color: string } }
}

export type UserScoreRow = {
  user_id: string
  total_points: number | string
  rank: number | null
  captain_points: number | string
  vc_points: number | string
  profile: { display_name: string }
}

export type SelectionRow = {
  user_id: string
  captain_id: string | null
  vice_captain_id: string | null
  player_ids: string[]
}

type Props = {
  match: {
    id: string
    match_number: number
    status: string
    result_summary: string | null
    cricapi_match_id: string | null
    start_time: string
    venue: string
  }
  home: TeamInfo
  away: TeamInfo
  playerScores: PlayerScoreRow[]
  userScores: UserScoreRow[]
  myScore: UserScoreRow | null
  myPlayerIds: string[]
  myCaptainId: string | null
  myVcId: string | null
  allSelections: SelectionRow[]
  captainPicks: Record<string, { name: string }>
  vcPicks?: Record<string, { name: string }>
  currentUserId: string
  banter?: Array<{ message: string; event_type: string }>
  userLeagues?: { id: string; name: string; memberIds: string[] }[]
  lastBalls?: Array<{ ball: number; runs: number; four: boolean; six: boolean; wicket: boolean }>
  snapshots?: Array<{ over_number: number; scores: Record<string, number> }>
  userNames?: Record<string, string>
  allPlayers?: Array<{ id: string; name: string; role: string; team: { short_name: string; color: string } }>
}

// ─── Component ──────────────────────────────────────────────────────────

export function ScoresClient({
  match, home, away, playerScores, userScores, myScore,
  myPlayerIds, myCaptainId, myVcId, allSelections,
  captainPicks, vcPicks = {}, currentUserId,
  userLeagues = [], lastBalls = [], snapshots = [],
  allPlayers = [],
}: Props) {
  const isLive = match.status === "live"

  // League filter state — defaults to user's first private league if any.
  const [leagueFilter, setLeagueFilter] = useState<string | null>(
    userLeagues.length > 0 ? userLeagues[0].id : null,
  )
  // Single piece of expansion state — replaces the previous drawer-open
  // booleans. null when no row is expanded.
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const myPoints = Number(myScore?.total_points ?? 0)

  const myPlayerSet = useMemo(() => new Set(myPlayerIds), [myPlayerIds])
  const psMap = useMemo(() => {
    const m = new Map<string, PlayerScore>()
    for (const ps of playerScores) m.set(ps.player_id, ps as unknown as PlayerScore)
    return m
  }, [playerScores])

  const rosterMap = useMemo(() => {
    const m = new Map<string, PlayerLite>()
    for (const p of allPlayers) m.set(p.id, p)
    return m
  }, [allPlayers])

  const selMap = useMemo(() => {
    const m = new Map<string, Selection>()
    for (const s of allSelections) m.set(s.user_id, s)
    return m
  }, [allSelections])

  // My XI (with C/VC multiplier applied) for the inline My XI panel.
  const myXI = useMemo(() => {
    return myPlayerIds
      .map((pid) => playerScores.find((ps) => ps.player_id === pid))
      .filter((ps): ps is PlayerScoreRow => Boolean(ps))
      .map((ps) => {
        const isC = myCaptainId === ps.player_id
        const isVC = myVcId === ps.player_id
        const mult = isC ? 2 : isVC ? 1.5 : 1
        return { ...ps, isC, isVC, mult, effective: Math.round(Number(ps.fantasy_points) * mult * 100) / 100 }
      })
      .sort((a, b) => b.effective - a.effective)
  }, [myPlayerIds, myCaptainId, myVcId, playerScores])

  // Filter standings by league.
  const filteredScores = useMemo(() => {
    if (!leagueFilter) return userScores
    const league = userLeagues.find((l) => l.id === leagueFilter)
    if (!league) return userScores
    return userScores.filter((s) => league.memberIds.includes(s.user_id))
  }, [userScores, leagueFilter, userLeagues])

  const rankDeltas = useRankDelta(filteredScores.map((s) => ({ user_id: s.user_id, rank: s.rank })))

  // Selections scoped to active league filter — reused by TopScorers and analysis.
  const scopedSelections = useMemo(() => {
    if (!leagueFilter) return allSelections
    const league = userLeagues.find((l) => l.id === leagueFilter)
    if (!league) return allSelections
    const memberIds = new Set(league.memberIds)
    return allSelections.filter((s) => memberIds.has(s.user_id))
  }, [allSelections, leagueFilter, userLeagues])

  // user_id → display_name map, derived from userScores.
  const userNamesById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of userScores) m.set(u.user_id, u.profile.display_name)
    return m
  }, [userScores])

  const standingsRows = useMemo(() => filteredScores.map((s, idx) => ({
    user_id: s.user_id,
    display_name: s.profile.display_name,
    rank: leagueFilter ? idx + 1 : s.rank,
    total_points: Number(s.total_points),
    captain_name: captainPicks[s.user_id]?.name ?? null,
    vc_name: vcPicks[s.user_id]?.name ?? null,
  })), [filteredScores, leagueFilter, captainPicks, vcPicks])

  // Full league ownership matrix.
  const analysis = useMemo(() => {
    if (scopedSelections.length < 2) return null

    const playerLookup = (pid: string) => {
      const ps = psMap.get(pid)
      if (ps) return { id: pid, name: ps.player.name, role: ps.player.role, team: ps.player.team.short_name }
      const info = rosterMap.get(pid)
      if (info) return { id: pid, name: info.name, role: info.role, team: info.team.short_name }
      return null
    }

    const inputs = scopedSelections.map((s) => {
      const players = s.player_ids
        .map(playerLookup)
        .filter((p): p is { id: string; name: string; role: string; team: string } => Boolean(p))
      return {
        displayName: userNamesById.get(s.user_id) ?? "?",
        captainId: s.captain_id,
        viceCaptainId: s.vice_captain_id,
        captainName: s.captain_id ? captainPicks[s.user_id]?.name ?? null : null,
        vcName: s.vice_captain_id ? vcPicks[s.user_id]?.name ?? null : null,
        players,
      }
    }).filter((s) => s.players.length > 0)

    if (inputs.length < 2) return null
    return buildAnalysis(`M#${match.match_number}`, inputs)
  }, [scopedSelections, userNamesById, psMap, rosterMap, captainPicks, vcPicks, match.match_number])

  // Toggle row expansion.
  const onRowClick = useCallback((userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId))
  }, [])

  const captainName = myCaptainId ? psMap.get(myCaptainId)?.player.name ?? null : null
  const vcName = myVcId ? psMap.get(myVcId)?.player.name ?? null : null
  const captainPoints = Number(myScore?.captain_points ?? 0)
  const vcPoints = Number(myScore?.vc_points ?? 0)
  const leaderPoints = Number(userScores[0]?.total_points ?? 0)

  const mySelection = selMap.get(currentUserId) ?? null
  const meHeader = myScore
    ? { display_name: myScore.profile.display_name, total_points: myPoints }
    : null

  // Render the inline expansion panel for a given user id.
  const renderPanel = useCallback((userId: string) => {
    if (userId === currentUserId) {
      return (
        <MyXIPanel
          myXI={myXI}
          allPlayerScores={playerScores}
          myPlayerSet={myPlayerSet}
          home={home}
          away={away}
        />
      )
    }
    const rivalScore = userScores.find((s) => s.user_id === userId)
    if (!rivalScore) return null
    const rivalSel = selMap.get(userId) ?? null
    return (
      <RivalPanel
        me={meHeader}
        rival={{
          user_id: rivalScore.user_id,
          display_name: rivalScore.profile.display_name,
          total_points: Number(rivalScore.total_points),
        }}
        mySelection={mySelection}
        rivalSelection={rivalSel}
        psMap={psMap}
        rosterMap={rosterMap}
        matchStatus={match.status}
      />
    )
  }, [
    currentUserId, myXI, playerScores, myPlayerSet, home, away,
    userScores, selMap, mySelection, psMap, rosterMap, match.status, meHeader,
  ])

  return (
    <div className="pb-12">
      {isLive && <LiveRefresher interval={30000} />}

      {/* Full-bleed hero band — diagonal team-color split, status chip, venue */}
      <MatchHeroBand
        match={{
          match_number: match.match_number,
          status: match.status as MatchStatus,
          result_summary: match.result_summary,
          cricapi_match_id: match.cricapi_match_id,
          start_time: match.start_time,
          venue: match.venue,
          team_home: home,
          team_away: away,
        }}
      />

      <div className="max-w-3xl mx-auto">
        <StickyHeader
          match={match}
          home={home}
          away={away}
          lastBalls={lastBalls}
          myRank={myScore?.rank ?? null}
          myPoints={myPoints}
          totalUsers={userScores.length}
          leaderPoints={leaderPoints}
          captainName={captainName}
          captainPoints={captainPoints}
          vcName={vcName}
          vcPoints={vcPoints}
        />

      {userScores.length === 0 ? (
        <div className="px-4 pt-6">
          <EmptyState
            icon={Trophy}
            title={isLive ? "Calculating live scores..." : "Scores not yet available"}
            description={
              isLive
                ? "Fantasy points appear here within 5 minutes of the match starting. The page refreshes every 30s."
                : "Check back after the match is completed and scores are published."
            }
            action={{ label: "Back to Matches", href: "/matches" }}
          />
        </div>
      ) : (
        <>
          {userLeagues.length > 0 && (
            <div className="px-3 py-2 bg-background border-b border-overlay-border">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                <FilterPill active={!leagueFilter} onClick={() => setLeagueFilter(null)}>
                  All ({userScores.length})
                </FilterPill>
                {userLeagues.map((league) => (
                  <FilterPill
                    key={league.id}
                    active={leagueFilter === league.id}
                    onClick={() => setLeagueFilter(league.id)}
                  >
                    {league.name} ({league.memberIds.length})
                  </FilterPill>
                ))}
              </div>
            </div>
          )}

          <StandingsTable
            rows={standingsRows}
            currentUserId={currentUserId}
            myPoints={myPoints}
            rankDeltas={rankDeltas}
            snapshots={snapshots}
            onRowClick={onRowClick}
            expandedUserId={expandedUserId}
            renderPanel={renderPanel}
          />

          {filteredScores.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No one in this league has scored yet.
            </p>
          )}

          <TopScorers
            playerScores={playerScores}
            myPlayerSet={myPlayerSet}
            scopedSelections={scopedSelections}
            userNamesById={userNamesById}
            currentUserId={currentUserId}
          />

          {analysis && <OwnershipMatrix analysis={analysis} />}
        </>
      )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
        active ? "bg-primary text-primary-foreground" : "glass-panel text-muted-foreground",
      )}
    >
      {children}
    </button>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Trophy } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { LiveRefresher } from "@/components/live-refresher"
import { cn } from "@/lib/utils"
import { pickDefaultRival, type PlayerLite, type PlayerScore, type Selection } from "@/lib/rivalry"

import { StickyHeader } from "./_components/sticky-header"
import { StandingsTable } from "./_components/standings-table"
import { RivalDrawer } from "./_components/rival-drawer"
import { MyXIDrawer } from "./_components/my-xi-drawer"
import { OwnershipGrid, type OwnershipEntry } from "./_components/ownership-grid"
import { useRankDelta } from "./_hooks/use-rank-delta"

// ─── Types (re-exported for page.tsx + drawers) ─────────────────────────

export type TeamInfo = { short_name: string; color: string; logo_url: string | null }

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
  player: { name: string; role: string; team_id: string; team: { short_name: string; color: string } }
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
  const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null)
  const [rivalOpen, setRivalOpen] = useState(false)
  const [myXIOpen, setMyXIOpen] = useState(false)

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

  // My XI (with C/VC multiplier applied) for the FAB drawer.
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

  // Track rank deltas across polls (mobile shows arrows, desktop shows sparkline).
  const rankDeltas = useRankDelta(filteredScores.map((s) => ({ user_id: s.user_id, rank: s.rank })))

  // Build the row shape for the table.
  const standingsRows = useMemo(() => filteredScores.map((s, idx) => ({
    user_id: s.user_id,
    display_name: s.profile.display_name,
    rank: leagueFilter ? idx + 1 : s.rank,
    total_points: Number(s.total_points),
    captain_name: captainPicks[s.user_id]?.name ?? null,
    vc_name: vcPicks[s.user_id]?.name ?? null,
  })), [filteredScores, leagueFilter, captainPicks, vcPicks])

  // Top owned players across the (filtered) league.
  const ownership: OwnershipEntry[] = useMemo(() => {
    if (allSelections.length < 2) return []
    const memberIds = leagueFilter
      ? new Set(userLeagues.find((l) => l.id === leagueFilter)?.memberIds ?? [])
      : null
    const scopedSelections = memberIds
      ? allSelections.filter((s) => memberIds.has(s.user_id))
      : allSelections
    if (scopedSelections.length < 2) return []
    const total = scopedSelections.length
    const counts = new Map<string, number>()
    for (const sel of scopedSelections) {
      for (const pid of sel.player_ids) counts.set(pid, (counts.get(pid) ?? 0) + 1)
    }
    const out: OwnershipEntry[] = []
    for (const [pid, count] of counts) {
      const ps = psMap.get(pid)
      const name = ps?.player.name ?? rosterMap.get(pid)?.name
      if (!name) continue
      out.push({
        player_id: pid,
        name,
        pct: Math.round((count / total) * 100),
        isMine: myPlayerSet.has(pid),
      })
    }
    return out
      .filter((p) => p.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8)
  }, [allSelections, leagueFilter, userLeagues, psMap, rosterMap, myPlayerSet])

  // Default rival is the person directly above me (or below if leader).
  useEffect(() => {
    if (selectedRivalId) return
    const def = pickDefaultRival(filteredScores, currentUserId)
    if (def) setSelectedRivalId(def)
  }, [filteredScores, currentUserId, selectedRivalId])

  const onRowClick = useCallback((userId: string) => {
    if (userId === currentUserId) {
      setMyXIOpen(true)
      return
    }
    setSelectedRivalId(userId)
    setRivalOpen(true)
  }, [currentUserId])

  const captainName = myCaptainId ? psMap.get(myCaptainId)?.player.name ?? null : null
  const vcName = myVcId ? psMap.get(myVcId)?.player.name ?? null : null
  const captainPoints = Number(myScore?.captain_points ?? 0)
  const vcPoints = Number(myScore?.vc_points ?? 0)
  const leaderPoints = Number(userScores[0]?.total_points ?? 0)

  const rival = selectedRivalId ? userScores.find((s) => s.user_id === selectedRivalId) ?? null : null
  const mySelection = selMap.get(currentUserId) ?? null
  const rivalSelection = selectedRivalId ? selMap.get(selectedRivalId) ?? null : null

  return (
    <div
      className="max-w-3xl mx-auto"
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
    >
      {isLive && <LiveRefresher interval={30000} />}

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
          {/* Toolbar — scrolls with the page (the sticky group above already
              owns the always-visible region). */}
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
          />

          {filteredScores.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No one in this league has scored yet.
            </p>
          )}

          <OwnershipGrid entries={ownership} />
        </>
      )}

      {/* FAB — opens My XI drawer. Sits above the 3.5rem bottom nav. */}
      {(playerScores.length > 0 || myXI.length > 0) && (
        <button
          onClick={() => setMyXIOpen(true)}
          className={cn(
            "fixed z-30 right-4 flex items-center gap-2 px-4 h-12 rounded-full shadow-lg",
            "bg-primary text-primary-foreground font-semibold text-sm",
            "active:scale-95 transition-transform",
          )}
          style={{ bottom: "calc(3.5rem + 1rem + env(safe-area-inset-bottom))" }}
        >
          <ClipboardList className="h-4 w-4" />
          <span>My XI</span>
          <span className="font-display font-bold tabular-nums">
            {Math.round(myXI.reduce((s, p) => s + p.effective, 0))}
          </span>
        </button>
      )}

      {/* Drawers */}
      <RivalDrawer
        open={rivalOpen}
        onOpenChange={setRivalOpen}
        me={myScore ? { display_name: myScore.profile.display_name, total_points: myPoints } : null}
        rival={rival ? { user_id: rival.user_id, display_name: rival.profile.display_name, total_points: Number(rival.total_points) } : null}
        mySelection={mySelection}
        rivalSelection={rivalSelection}
        psMap={psMap}
        rosterMap={rosterMap}
        matchStatus={match.status}
      />

      <MyXIDrawer
        open={myXIOpen}
        onOpenChange={setMyXIOpen}
        myXI={myXI}
        allPlayerScores={playerScores}
        myPlayerSet={myPlayerSet}
        home={home}
        away={away}
      />
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



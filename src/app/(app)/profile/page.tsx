import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Target, TrendingUp, TrendingDown, BookOpen, ChevronRight } from "lucide-react"
import { ProfileNameForm } from "./name-form"
import { SignOutButton } from "./sign-out-button"
import { StatCard } from "@/components/stat-card"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { PageTransition } from "@/components/page-transition"
import { cn } from "@/lib/utils"
import { ProfileTabs } from "./profile-tabs"
import type {
  ScoreTimelineEntry,
  RoleBreakdownData,
  CaptainStatsData,
} from "./profile-tabs"
import type { MatchHistoryRow } from "./match-history-table"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ── Phase 1: all independent queries in parallel ──────────────────────
  const [
    profileRes,
    myRankRes,
    matchScoresRes,
    teamsRes,
    selectionsRes,
    leagueScoresRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("season_leaderboard")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    // `*` already includes captain_points, vc_points, breakdown columns
    supabase
      .from("user_match_scores")
      .select(
        "*, match:matches(match_number, team_home_id, team_away_id, start_time)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("teams").select("id, short_name, color, logo_url").limit(20),
    // Single selections query: id + match context + captain/vc names + is_auto_pick
    supabase
      .from("selections")
      .select(
        "id, match_id, captain_id, vice_captain_id, is_auto_pick, captain:players!selections_captain_id_fkey(name), vc:players!selections_vice_captain_id_fkey(name)"
      )
      .eq("user_id", user.id)
      .limit(200),
    // All users' scores — used to compute league avg per match
    supabase
      .from("user_match_scores")
      .select("match_id, total_points")
      .limit(2000),
  ])

  const profile = profileRes.data
  const myRank = myRankRes.data
  const matchScores = matchScoresRes.data
  const teamMap = new Map(teamsRes.data?.map((t) => [t.id, t]) ?? [])
  const selectionsData = selectionsRes.data
  const leagueScores = leagueScoresRes.data
  const selectionIds = (selectionsData ?? []).map((s) => s.id)

  // ── Phase 2: selection_players — depends on selectionIds ──────────────
  type SelPlayer = {
    player_id: string
    selection_id: string
    player: { role: string; team_id: string } | null
  }
  let selPlayers: SelPlayer[] = []
  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  const teamPickCounts = new Map<string, number>()

  if (selectionIds.length > 0) {
    const { data } = await supabase
      .from("selection_players")
      .select("player_id, selection_id, player:players(role, team_id)")
      .in("selection_id", selectionIds)
      .limit(900)
    selPlayers = (data ?? []) as unknown as SelPlayer[]
    for (const sp of selPlayers) {
      const role = sp.player?.role
      if (role && role in roleCounts) roleCounts[role as keyof typeof roleCounts]++
      if (sp.player?.team_id)
        teamPickCounts.set(
          sp.player.team_id,
          (teamPickCounts.get(sp.player.team_id) ?? 0) + 1
        )
    }
  }

  // ── Hero tint: most-picked IPL team color ─────────────────────────────
  const topTeamId =
    teamPickCounts.size > 0
      ? Array.from(teamPickCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null
  const heroTintColor = topTeamId ? teamMap.get(topTeamId)?.color ?? null : null

  // ── Stat card values ──────────────────────────────────────────────────
  const sortedByScore = [...(matchScores ?? [])].sort(
    (a, b) => b.total_points - a.total_points
  )
  const bestMatch = sortedByScore[0] ?? null
  const worstMatch = sortedByScore.length > 1 ? sortedByScore[sortedByScore.length - 1] : null
  const totalPicks = Object.values(roleCounts).reduce((a, b) => a + b, 0)

  // ── Favorite captain (Overview tab) ──────────────────────────────────
  const captainCounts = new Map<string, { name: string; count: number }>()
  for (const s of selectionsData ?? []) {
    if (!s.captain_id) continue
    const name = (s.captain as unknown as { name: string })?.name ?? "Unknown"
    const existing = captainCounts.get(s.captain_id)
    if (existing) existing.count++
    else captainCounts.set(s.captain_id, { name, count: 1 })
  }
  const favCaptain =
    captainCounts.size > 0
      ? Array.from(captainCounts.values()).sort((a, b) => b.count - a.count)[0]
      : null

  const rankEntry = myRank as unknown as {
    season_rank: number
    total_points: number
    matches_played: number
    avg_points: number
    first_place_count: number
    podium_count: number
  } | null

  // ── League avg per match ──────────────────────────────────────────────
  const leagueMatchGroups = new Map<string, number[]>()
  for (const ls of leagueScores ?? []) {
    const group = leagueMatchGroups.get(ls.match_id) ?? []
    group.push(ls.total_points)
    leagueMatchGroups.set(ls.match_id, group)
  }
  const leagueAvgMap = new Map<string, number>()
  for (const [matchId, pts] of leagueMatchGroups) {
    leagueAvgMap.set(matchId, pts.reduce((a, b) => a + b, 0) / pts.length)
  }
  const leagueSize =
    leagueMatchGroups.size > 0
      ? Math.max(...Array.from(leagueMatchGroups.values()).map((arr) => arr.length))
      : 1

  // ── Score timeline (ascending match order) ───────────────────────────
  const sortedByMatch = [...(matchScores ?? [])].sort((a, b) => {
    const aNum = (a.match as unknown as { match_number: number })?.match_number ?? 0
    const bNum = (b.match as unknown as { match_number: number })?.match_number ?? 0
    return aNum - bNum
  })
  const scoreTimeline: ScoreTimelineEntry[] = sortedByMatch.map((ms, i) => {
    const matchNum =
      (ms.match as unknown as { match_number: number })?.match_number ?? i + 1
    const rolling3: number | null =
      i >= 2
        ? (sortedByMatch[i].total_points +
            sortedByMatch[i - 1].total_points +
            sortedByMatch[i - 2].total_points) /
          3
        : null
    return {
      matchNumber: matchNum,
      label: `M${matchNum}`,
      userScore: ms.total_points,
      leagueAvg: leagueAvgMap.get(ms.match_id) ?? ms.total_points,
      rank: ms.rank ?? 0,
      rolling3,
    }
  })

  // ── Role breakdown (points attributed to each role category) ─────────
  type MatchScoreTyped = {
    id: string
    match_id: string
    total_points: number
    rank: number
    captain_points: number
    vc_points: number
    breakdown: Record<string, number> | null
    match: unknown
  }
  const typedMatchScores = (matchScores ?? []) as unknown as MatchScoreTyped[]

  const selIdToMatchId = new Map<string, string>()
  for (const s of selectionsData ?? []) {
    selIdToMatchId.set(s.id, s.match_id)
  }

  const matchPlayerPts = new Map<string, number>()
  for (const ms of typedMatchScores) {
    if (!ms.breakdown) continue
    for (const [playerId, pts] of Object.entries(ms.breakdown)) {
      matchPlayerPts.set(`${ms.match_id}:${playerId}`, pts)
    }
  }

  const roleBreakdown: RoleBreakdownData = {
    WK: 0,
    BAT: 0,
    AR: 0,
    BOWL: 0,
    captainBonus: 0,
    vcBonus: 0,
  }
  for (const sp of selPlayers) {
    const matchId = selIdToMatchId.get(sp.selection_id)
    if (!matchId) continue
    const role = sp.player?.role
    if (!role || !(role in roleCounts)) continue
    const pts = matchPlayerPts.get(`${matchId}:${sp.player_id}`) ?? 0
    roleBreakdown[role as keyof typeof roleCounts] += pts
  }
  for (const ms of typedMatchScores) {
    roleBreakdown.captainBonus += ms.captain_points ?? 0
    roleBreakdown.vcBonus += ms.vc_points ?? 0
  }

  // ── Captain stats ─────────────────────────────────────────────────────
  const matchScoreById = new Map<string, MatchScoreTyped>()
  for (const ms of typedMatchScores) {
    matchScoreById.set(ms.match_id, ms)
  }

  const captainAggMap = new Map<
    string,
    { name: string; count: number; totalBonus: number }
  >()
  for (const s of selectionsData ?? []) {
    if (!s.captain_id) continue
    const name = (s.captain as unknown as { name: string })?.name ?? "Unknown"
    const bonus = matchScoreById.get(s.match_id)?.captain_points ?? 0
    const existing = captainAggMap.get(s.captain_id)
    if (existing) {
      existing.count++
      existing.totalBonus += bonus
    } else {
      captainAggMap.set(s.captain_id, { name, count: 1, totalBonus: bonus })
    }
  }
  const perCaptain = Array.from(captainAggMap.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      count: v.count,
      totalBonus: v.totalBonus,
      avgBonus: v.count > 0 ? v.totalBonus / v.count : 0,
    }))
    .sort((a, b) => b.totalBonus - a.totalBonus)

  const autoPickSels = (selectionsData ?? []).filter((s) => s.is_auto_pick)
  const manualSels = (selectionsData ?? []).filter((s) => !s.is_auto_pick)
  const autoPickCount = autoPickSels.length
  const avgAutoPickScore =
    autoPickCount > 0
      ? autoPickSels.reduce(
          (sum, s) => sum + (matchScoreById.get(s.match_id)?.total_points ?? 0),
          0
        ) / autoPickCount
      : 0
  const avgManualScore =
    manualSels.length > 0
      ? manualSels.reduce(
          (sum, s) => sum + (matchScoreById.get(s.match_id)?.total_points ?? 0),
          0
        ) / manualSels.length
      : 0

  const captainStats: CaptainStatsData = {
    perCaptain,
    autoPickCount,
    avgManualScore,
    avgAutoPickScore,
    totalCaptainBonus: typedMatchScores.reduce(
      (sum, ms) => sum + (ms.captain_points ?? 0),
      0
    ),
    totalVcBonus: typedMatchScores.reduce(
      (sum, ms) => sum + (ms.vc_points ?? 0),
      0
    ),
    bestMatchCaptainBonus: typedMatchScores.reduce(
      (max, ms) => Math.max(max, ms.captain_points ?? 0),
      0
    ),
  }

  // ── Match history rows (passed to Season Arc tab) ────────────────────
  const matchCaptainMap = new Map<string, { captainName: string; vcName: string }>()
  for (const s of selectionsData ?? []) {
    const captainName = (s.captain as unknown as { name: string })?.name
    const vcName = (s.vc as unknown as { name: string })?.name
    if (s.match_id && (captainName || vcName)) {
      matchCaptainMap.set(s.match_id, {
        captainName: captainName ?? "—",
        vcName: vcName ?? "—",
      })
    }
  }
  const matchHistoryRows: MatchHistoryRow[] = (matchScores ?? []).map((ms) => {
    const m = ms.match as unknown as {
      match_number: number
      team_home_id: string
      team_away_id: string
      start_time: string
    }
    const homeTeam = teamMap.get(m.team_home_id)
    const awayTeam = teamMap.get(m.team_away_id)
    const cap = matchCaptainMap.get(ms.match_id)
    return {
      id: ms.id,
      matchId: ms.match_id,
      matchNumber: m.match_number,
      startTime: m.start_time,
      rank: ms.rank,
      totalPoints: ms.total_points,
      homeShortName: homeTeam?.short_name ?? "—",
      homeColor: homeTeam?.color ?? "#888",
      homeLogoUrl: homeTeam?.logo_url ?? null,
      awayShortName: awayTeam?.short_name ?? "—",
      awayColor: awayTeam?.color ?? "#888",
      awayLogoUrl: awayTeam?.logo_url ?? null,
      captainName: cap?.captainName ?? null,
      vcName: cap?.vcName ?? null,
    }
  })

  const totalPoints = rankEntry?.total_points ?? 0
  const seasonAvg = rankEntry?.avg_points ?? 0

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
        {/* ── Hero: avatar + name + rank + pts ──────────────────── */}
        <div className="relative flex items-center gap-5 py-4 px-4 -mx-4 md:-mx-6 md:px-6 mesh-gradient-bg-strong rounded-3xl overflow-hidden">
          {heroTintColor && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 40% 80% at 16% 50%, ${heroTintColor}29 0%, transparent 60%)`,
              }}
            />
          )}
          <div
            className={cn(
              "h-24 w-24 rounded-full flex items-center justify-center shrink-0 ring-2 shadow-lg",
              getAvatarColor(profile?.display_name ?? "U"),
              rankEntry?.season_rank === 1
                ? "ring-accent shadow-[0_0_24px_oklch(0.78_0.17_86/0.4)]"
                : rankEntry?.season_rank === 2
                ? "ring-[oklch(0.72_0.01_260)]"
                : rankEntry?.season_rank === 3
                ? "ring-[oklch(0.63_0.10_55)]"
                : "ring-overlay-border-hover"
            )}
          >
            <span className="text-white text-3xl font-bold font-display">
              {getInitials(profile?.display_name ?? "U")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <ProfileNameForm currentName={profile?.display_name ?? ""} />
            <p className="text-2xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
            {rankEntry && (
              <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                <div className="flex items-baseline gap-1">
                  <span className="text-gold-stat text-3xl leading-none">
                    #{rankEntry.season_rank}
                  </span>
                  <span className="text-2xs text-muted-foreground uppercase tracking-wider">
                    Rank
                  </span>
                </div>
                <span className="text-muted-foreground/40">·</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-gold-stat text-2xl leading-none">
                    {rankEntry.total_points.toLocaleString()}
                  </span>
                  <span className="text-2xs text-muted-foreground uppercase tracking-wider">
                    Pts
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick stat strip ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={TrendingUp}
            value={bestMatch ? bestMatch.total_points : "—"}
            label="Best Match"
            gradient="from-green-500/10"
            iconColor="bg-green-500/15 text-[var(--tw-green-text)]"
          />
          <StatCard
            icon={TrendingDown}
            value={worstMatch ? worstMatch.total_points : "—"}
            label="Worst Match"
            gradient="from-red-500/10"
            iconColor="bg-red-500/15 text-red-500"
          />
          <StatCard
            icon={Target}
            value={rankEntry?.avg_points?.toFixed(1) ?? "—"}
            label="Avg / Match"
            gradient="from-primary/10"
            iconColor="bg-primary/15 text-primary"
          />
          <StatCard
            icon={Trophy}
            value={String(rankEntry?.matches_played ?? 0)}
            label="Matches"
            gradient="from-amber-500/10"
            iconColor="bg-accent/15 text-accent"
          />
        </div>

        {/* ── 3-tab breakdown ───────────────────────────────────── */}
        <ProfileTabs
          matchesPlayed={rankEntry?.matches_played ?? 0}
          avgPoints={rankEntry?.avg_points ?? 0}
          firstPlaceCount={rankEntry?.first_place_count ?? 0}
          podiumCount={rankEntry?.podium_count ?? 0}
          favCaptain={favCaptain}
          roleCounts={roleCounts}
          totalPicks={totalPicks}
          autoPick={profile?.auto_pick_enabled ?? false}
          scoreTimeline={scoreTimeline}
          roleBreakdown={roleBreakdown}
          matchHistoryRows={matchHistoryRows}
          totalPoints={totalPoints}
          leagueSize={leagueSize}
          seasonAvg={seasonAvg}
          captainStats={captainStats}
        />

        {/* ── Rules link + sign out ─────────────────────────────── */}
        <Link href="/rules">
          <Card className="glass hover:bg-accent/40 transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between py-4 px-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Rules & Scoring Guide</p>
                  <p className="text-xs text-muted-foreground">
                    How to play and points reference
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <SignOutButton />
      </div>
    </PageTransition>
  )
}

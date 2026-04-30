import { createClient, getAuthUser } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"

export const maxDuration = 60
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageTransition } from "@/components/page-transition"
import { CinematicHero } from "@/components/cinematic-hero"
import { RankBlock } from "@/components/rank-block"
import { OnTheBubble } from "@/components/on-the-bubble"
import { MatchWinCabinet } from "@/components/match-win-cabinet"
import { UpcomingCarousel } from "@/components/upcoming-carousel"
import { StandingsTable } from "@/components/standings-table"
import { MatchResultCard } from "@/components/match-result-card"
import { MatchAwards } from "@/components/match-awards"
import type { MatchResultData, TopPerformer } from "@/components/match-result-card"
import type { Award, AwardType } from "@/components/match-awards"
import type { HeadshotPlayer } from "@/components/player-headshot"

// ─── Cached server-side queries (shared TTL with scoring invalidation) ────────

const getCachedMatches = unstable_cache(
  async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from("matches")
      .select(
        "*, team_home:teams!matches_team_home_id_fkey(name, short_name, color, logo_url), team_away:teams!matches_team_away_id_fkey(name, short_name, color, logo_url)"
      )
      .order("start_time", { ascending: false })
      .limit(80)
    return data ?? []
  },
  ["dashboard-matches"],
  { tags: ["matches"], revalidate: 60 }
)

const getCachedLeaderboard = unstable_cache(
  async () => {
    const admin = createAdminClient()
    const { data } = await admin
      .from("season_leaderboard")
      .select("user_id, season_rank, total_points, display_name, avg_points, matches_played, first_place_count")
      .order("season_rank", { ascending: true })
    return data ?? []
  },
  ["dashboard-leaderboard"],
  { tags: ["leaderboard"], revalidate: 60 }
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [user, supabase] = await Promise.all([getAuthUser(), createClient()])
  if (!user) redirect("/login")

  // ─── Phase 1: cached public data + user-specific query in parallel ──────────
  const emptyPlayers = {
    data: [] as Array<{
      name: string
      role: string
      image_url: string | null
      team: { short_name: string; color: string }
    }>,
  }

  const [allMatches, allLeaderboard, matchWinCabinetRes] = await Promise.all([
    getCachedMatches(),
    getCachedLeaderboard(),
    supabase
      .from("user_match_scores")
      .select("match_id, match:matches!user_match_scores_match_id_fkey(match_number)")
      .eq("user_id", user.id)
      .eq("rank", 1)
      .order("created_at", { ascending: false }),
  ])

  const myRank = allLeaderboard.find((e) => e.user_id === user.id) ?? null

  const liveMatches = allMatches.filter((m) => m.status === "live")
  const upcomingMatches = allMatches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5)
  const completedMatches = allMatches.filter(
    (m) => m.status === "completed" || m.status === "no_result"
  )
  const last3CompletedMatches = completedMatches.slice(0, 3)
  const lastMatch = last3CompletedMatches[0] ?? null

  const heroMatch = liveMatches[0] ?? upcomingMatches[0] ?? lastMatch

  // Derive On the Bubble entries
  const mySeasonRank = myRank?.season_rank ?? null
  const totalPlayers = allLeaderboard.length
  const bubbleTarget =
    mySeasonRank != null && mySeasonRank > 1
      ? (allLeaderboard.find((e) => Number(e.season_rank) === mySeasonRank - 1) ?? null)
      : null
  const bubbleThreat =
    mySeasonRank != null
      ? (allLeaderboard.find((e) => Number(e.season_rank) === mySeasonRank + 1) ?? null)
      : null

  // Win cabinet shape
  type WinRow = { match_id: string; match: { match_number: number } | null }
  const matchWins: WinRow[] = (matchWinCabinetRes.data ?? []) as unknown as WinRow[]

  // Win rank: sort leaderboard by first_place_count DESC, find user's position
  const sortedByWins = [...allLeaderboard].sort(
    (a, b) => Number(b.first_place_count ?? 0) - Number(a.first_place_count ?? 0)
  )
  const winsRankIdx = sortedByWins.findIndex((e) => e.user_id === user.id)
  const winsRank = winsRankIdx >= 0 ? winsRankIdx + 1 : null

  // ─── Phase 2: depends on Phase 1 IDs ─────────────────────────────────────
  const allUpcomingLiveIds = [...liveMatches, ...upcomingMatches].map((m) => m.id)
  const last3MatchIds = last3CompletedMatches.map((m) => m.id)
  const lastMatchId = lastMatch?.id ?? null

  const [
    subsRes,
    liveScoresRes,
    featuredHomePlayersRes,
    featuredAwayPlayersRes,
    last3AllScoresRes,
    last3UserSelectionsRes,
    last3TopPerformersRes,
    lastMatchAllSelectionsRes,
  ] = await Promise.all([
    // Pick status for upcoming + live
    allUpcomingLiveIds.length > 0
      ? supabase
          .from("selections")
          .select("match_id")
          .eq("user_id", user.id)
          .in("match_id", allUpcomingLiveIds)
          .limit(10)
      : Promise.resolve({ data: [] as { match_id: string }[] }),

    // Live scores for hero CTA
    liveMatches.length > 0
      ? supabase
          .from("user_match_scores")
          .select("match_id, total_points, rank")
          .eq("user_id", user.id)
          .in("match_id", liveMatches.map((m) => m.id))
          .limit(2)
      : Promise.resolve({ data: [] as { match_id: string; total_points: number; rank: number | null }[] }),

    // Hero featured players (top 2 per team by credit — image_url can be null, PlayerHeadshot handles initials fallback)
    heroMatch
      ? supabase
          .from("players")
          .select("name, role, image_url, team:teams!players_team_id_fkey(short_name, color)")
          .eq("team_id", heroMatch.team_home_id)
          .order("credit_cost", { ascending: false })
          .limit(2)
      : Promise.resolve(emptyPlayers),

    heroMatch
      ? supabase
          .from("players")
          .select("name, role, image_url, team:teams!players_team_id_fkey(short_name, color)")
          .eq("team_id", heroMatch.team_away_id)
          .order("credit_cost", { ascending: false })
          .limit(2)
      : Promise.resolve(emptyPlayers),

    // All users' scores for last 3 completed matches (for winners, awards, H2H)
    last3MatchIds.length > 0
      ? supabase
          .from("user_match_scores")
          .select(
            "user_id, match_id, total_points, rank, captain_points, vc_points, user:profiles!user_match_scores_user_id_fkey(display_name)"
          )
          .in("match_id", last3MatchIds)
      : Promise.resolve({
          data: [] as {
            user_id: string
            match_id: string
            total_points: number
            rank: number | null
            captain_points: number
            vc_points: number
            user: { display_name: string } | null
          }[],
        }),

    // User's captain/VC for last 3 completed matches
    last3MatchIds.length > 0
      ? supabase
          .from("selections")
          .select(
            "match_id, captain_id, vice_captain_id, captain:players!selections_captain_id_fkey(name)"
          )
          .eq("user_id", user.id)
          .in("match_id", last3MatchIds)
      : Promise.resolve({
          data: [] as {
            match_id: string
            captain_id: string
            vice_captain_id: string | null
            captain: { name: string } | null
          }[],
        }),

    // Top performers: include player_id so we can cross-reference unique picks
    last3MatchIds.length > 0
      ? supabase
          .from("match_player_scores")
          .select(
            "match_id, player_id, fantasy_points, player:players!match_player_scores_player_id_fkey(name, role, team:teams!players_team_id_fkey(short_name))"
          )
          .in("match_id", last3MatchIds)
          .order("fantasy_points", { ascending: false })
          .limit(30)
      : Promise.resolve({
          data: [] as {
            match_id: string
            player_id: string
            fantasy_points: number
            player: { name: string; role: string; team: { short_name: string } | null } | null
          }[],
        }),

    // All users' selections for the last match (for Best Captain/VC award detail + unique picks)
    lastMatchId
      ? supabase
          .from("selections")
          .select(
            "id, user_id, captain_id, vice_captain_id, captain:players!selections_captain_id_fkey(name), vc:players!selections_vice_captain_id_fkey(name)"
          )
          .eq("match_id", lastMatchId)
      : Promise.resolve({
          data: [] as {
            id: string
            user_id: string
            captain_id: string | null
            vice_captain_id: string | null
            captain: { name: string } | null
            vc: { name: string } | null
          }[],
        }),
  ])

  // ─── Derived data ─────────────────────────────────────────────────────────

  const submittedMatchIds = new Set<string>()
  for (const s of subsRes.data ?? []) submittedMatchIds.add(s.match_id)

  const liveScoreMap = new Map<string, { total_points: number; rank: number | null }>()
  for (const s of liveScoresRes.data ?? []) {
    liveScoreMap.set(s.match_id, { total_points: s.total_points, rank: s.rank })
  }

  type ScoreRow = {
    user_id: string
    match_id: string
    total_points: number
    rank: number | null
    captain_points: number
    vc_points: number
    user: { display_name: string } | null
  }
  const allScores: ScoreRow[] = (last3AllScoresRes.data ?? []) as ScoreRow[]

  type SelectionRow = {
    match_id: string
    captain_id: string
    vice_captain_id: string | null
    captain: { name: string } | null
  }
  const userSelections: SelectionRow[] = (last3UserSelectionsRes.data ?? []) as SelectionRow[]

  type PerformerRow = {
    match_id: string
    player_id: string
    fantasy_points: number
    player: { name: string; role: string; team: { short_name: string } | null } | null
  }
  const allPerformers: PerformerRow[] = (last3TopPerformersRes.data ?? []) as unknown as PerformerRow[]

  type LastMatchSelectionRow = {
    id: string
    user_id: string
    captain_id: string | null
    vice_captain_id: string | null
    captain: { name: string } | null
    vc: { name: string } | null
  }
  const lastMatchAllSelections: LastMatchSelectionRow[] =
    (lastMatchAllSelectionsRes.data ?? []) as unknown as LastMatchSelectionRow[]

  // Group scores by match
  const scoresByMatch = new Map<string, ScoreRow[]>()
  for (const s of allScores) {
    if (!scoresByMatch.has(s.match_id)) scoresByMatch.set(s.match_id, [])
    scoresByMatch.get(s.match_id)!.push(s)
  }

  // Top performers per match (already ordered by fantasy_points DESC, take first 3 per match)
  const topPerformersByMatch = new Map<string, TopPerformer[]>()
  for (const p of allPerformers) {
    if (!p.player) continue
    const list = topPerformersByMatch.get(p.match_id) ?? []
    if (list.length < 3) {
      list.push({
        name: p.player.name,
        role: p.player.role,
        teamShortName: p.player.team?.short_name ?? "",
        fantasyPoints: Number(p.fantasy_points),
      })
      topPerformersByMatch.set(p.match_id, list)
    }
  }

  // ─── Phase 3: unique picks for Hidden Gem (selection_players for last match) ──
  type SpRow = { selection_id: string; player_id: string }
  let selectionPlayers: SpRow[] = []
  if (lastMatchAllSelections.length > 0) {
    const selectionIds = lastMatchAllSelections.map((s) => s.id)
    const spRes = await supabase
      .from("selection_players")
      .select("selection_id, player_id")
      .in("selection_id", selectionIds)
    selectionPlayers = (spRes.data ?? []) as SpRow[]
  }

  // Map selection_id → user_id (from lastMatchAllSelections)
  const selectionIdToUserId = new Map<string, string>()
  for (const s of lastMatchAllSelections) selectionIdToUserId.set(s.id, s.user_id)

  // Count how many unique users picked each player in the last match
  const playerPickerCount = new Map<string, Set<string>>() // player_id → Set of user_ids
  for (const sp of selectionPlayers) {
    const uid = selectionIdToUserId.get(sp.selection_id)
    if (!uid) continue
    if (!playerPickerCount.has(sp.player_id)) playerPickerCount.set(sp.player_id, new Set())
    playerPickerCount.get(sp.player_id)!.add(uid)
  }

  // Build MatchResultData for last 3 completed matches
  // Phase 3 (continued): captain base points
  const captainNeeded = userSelections.map((s) => ({ matchId: s.match_id, captainId: s.captain_id }))

  let captainPointsMap = new Map<string, number>() // `${matchId}-${captainId}` → base pts
  if (captainNeeded.length > 0) {
    const captainPlayerIds = [...new Set(captainNeeded.map((c) => c.captainId))]
    const captainScoresRes = await supabase
      .from("match_player_scores")
      .select("match_id, player_id, fantasy_points")
      .in("match_id", last3MatchIds)
      .in("player_id", captainPlayerIds)

    for (const row of captainScoresRes.data ?? []) {
      captainPointsMap.set(`${row.match_id}-${row.player_id}`, Number(row.fantasy_points))
    }
  }

  // H2H target: bubble target user's scores in last 3 matches
  const h2hUserId = bubbleTarget?.user_id ?? bubbleThreat?.user_id ?? null
  const h2hScoreMap = new Map<string, number>()
  for (const s of allScores) {
    if (s.user_id === h2hUserId) {
      h2hScoreMap.set(s.match_id, Number(s.total_points))
    }
  }
  const h2hDisplayName =
    bubbleTarget?.display_name ?? bubbleThreat?.display_name ?? null

  // Build match result cards data
  const matchResultsData: MatchResultData[] = last3CompletedMatches.map((match) => {
    const matchScores = scoresByMatch.get(match.id) ?? []
    const myScore = matchScores.find((s) => s.user_id === user.id)
    const winner = matchScores.find((s) => s.rank === 1)
    const selectionForMatch = userSelections.find((s) => s.match_id === match.id)
    const captainId = selectionForMatch?.captain_id
    const captainBasePoints = captainId
      ? (captainPointsMap.get(`${match.id}-${captainId}`) ?? null)
      : null

    const scores = matchScores.map((s) => Number(s.total_points)).filter(Boolean)
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const maxScore = scores.length > 0 ? Math.max(...scores) : null

    const home = match.team_home as unknown as {
      short_name: string; name?: string | null; color: string; logo_url?: string | null
    }
    const away = match.team_away as unknown as {
      short_name: string; name?: string | null; color: string; logo_url?: string | null
    }

    return {
      matchId: match.id,
      matchNumber: match.match_number,
      startTime: match.start_time,
      teamHome: home,
      teamAway: away,
      winnerDisplayName: (winner?.user as unknown as { display_name: string } | null)?.display_name ?? null,
      winnerPoints: winner ? Number(winner.total_points) : null,
      userScore: myScore ? Number(myScore.total_points) : 0,
      userRank: myScore?.rank ?? null,
      captainName: (selectionForMatch?.captain as unknown as { name: string } | null)?.name ?? null,
      captainBasePoints,
      avgScore,
      maxScore,
      h2hTarget:
        h2hDisplayName && h2hScoreMap.has(match.id)
          ? { displayName: h2hDisplayName, score: h2hScoreMap.get(match.id)! }
          : null,
      topPerformers: topPerformersByMatch.get(match.id) ?? [],
    }
  })

  // ─── Match Awards (most recent completed match) ────────────────────────────
  const awards: Award[] = []
  if (lastMatch && scoresByMatch.has(lastMatch.id)) {
    const lastMatchScores = scoresByMatch.get(lastMatch.id)!

    // Award: Match Winner
    const matchWinner = lastMatchScores.find((s) => s.rank === 1)
    if (matchWinner) {
      const winnerName = (matchWinner.user as unknown as { display_name: string } | null)?.display_name ?? "—"
      awards.push({
        type: "winner",
        winnerName,
        detail: `${Math.round(Number(matchWinner.total_points))} pts`,
        isYou: matchWinner.user_id === user.id,
      })
    }

    // Award: Best Captain Pick (max captain_points) — include player name from lastMatchAllSelections
    const bestCaptain = [...lastMatchScores].sort(
      (a, b) => Number(b.captain_points) - Number(a.captain_points)
    )[0]
    if (bestCaptain && Number(bestCaptain.captain_points) > 0) {
      const winnerName = (bestCaptain.user as unknown as { display_name: string } | null)?.display_name ?? "—"
      const winnerSelection = lastMatchAllSelections.find((s) => s.user_id === bestCaptain.user_id)
      const captainPlayerName = (winnerSelection?.captain as unknown as { name: string } | null)?.name ?? null
      awards.push({
        type: "best_captain",
        winnerName,
        detail: captainPlayerName
          ? `© ${captainPlayerName} · ${Math.round(Number(bestCaptain.captain_points))} pts`
          : `${Math.round(Number(bestCaptain.captain_points))} pts captain contribution`,
        isYou: bestCaptain.user_id === user.id,
      })
    }

    // Award: Best VC Pick (max vc_points) — include player name
    const bestVC = [...lastMatchScores].sort(
      (a, b) => Number(b.vc_points) - Number(a.vc_points)
    )[0]
    if (bestVC && Number(bestVC.vc_points) > 0) {
      const winnerName = (bestVC.user as unknown as { display_name: string } | null)?.display_name ?? "—"
      const winnerSelection = lastMatchAllSelections.find((s) => s.user_id === bestVC.user_id)
      const vcPlayerName = (winnerSelection?.vc as unknown as { name: string } | null)?.name ?? null
      awards.push({
        type: "best_vc",
        winnerName,
        detail: vcPlayerName
          ? `VC ${vcPlayerName} · ${Math.round(Number(bestVC.vc_points))} pts`
          : `${Math.round(Number(bestVC.vc_points))} pts VC contribution`,
        isYou: bestVC.user_id === user.id,
      })
    }

    // Award: Biggest Mover (best match rank vs season rank)
    const movers = lastMatchScores
      .map((s) => {
        const seasonEntry = allLeaderboard.find((e) => e.user_id === s.user_id)
        const seasonRank = seasonEntry ? Number(seasonEntry.season_rank) : null
        const matchRank = s.rank
        if (seasonRank == null || matchRank == null) return null
        return { ...s, movement: seasonRank - matchRank }
      })
      .filter(Boolean)
      .sort((a, b) => b!.movement - a!.movement)

    const biggestMover = movers[0]
    if (biggestMover && biggestMover.movement > 0) {
      const name = (biggestMover.user as unknown as { display_name: string } | null)?.display_name ?? "—"
      awards.push({
        type: "biggest_mover",
        winnerName: name,
        detail: `↑${biggestMover.movement} positions above season rank`,
        isYou: biggestMover.user_id === user.id,
      })
    }

    // Award: Hidden Gem — unique pick (only one person chose this player) who scored well
    // Find players picked by exactly 1 person, then find the highest scorer among them
    const lastMatchPerformers = allPerformers.filter((p) => p.match_id === lastMatch.id)
    const uniquePickCandidates = lastMatchPerformers.filter((p) => {
      const pickers = playerPickerCount.get(p.player_id)
      return pickers != null && pickers.size === 1
    })

    if (uniquePickCandidates.length > 0) {
      // Already ordered by fantasy_points DESC (from the original query)
      const gem = uniquePickCandidates[0]
      const gemPickers = playerPickerCount.get(gem.player_id)!
      const gemOwnerUserId = [...gemPickers][0]
      const gemOwnerName =
        lastMatchAllSelections.find((s) => s.user_id === gemOwnerUserId)
          ? ((allLeaderboard.find((e) => e.user_id === gemOwnerUserId)?.display_name) ?? "—")
          : "—"
      const isYou = gemOwnerUserId === user.id
      awards.push({
        type: "hidden_gem",
        winnerName: gemOwnerName,
        detail: `${gem.player?.name ?? "?"} · unique pick · ${Math.round(Number(gem.fantasy_points))} pts`,
        isYou,
      })
    }
  }

  // ─── Hero data ─────────────────────────────────────────────────────────────
  const featuredHomePlayers = (featuredHomePlayersRes.data ?? []).map(
    (p): HeadshotPlayer => ({
      name: p.name,
      role: p.role,
      image_url: p.image_url,
      team: p.team as unknown as { short_name: string; color: string },
    })
  )
  const featuredAwayPlayers = (featuredAwayPlayersRes.data ?? []).map(
    (p): HeadshotPlayer => ({
      name: p.name,
      role: p.role,
      image_url: p.image_url,
      team: p.team as unknown as { short_name: string; color: string },
    })
  )

  const heroSubmitted = heroMatch ? submittedMatchIds.has(heroMatch.id) : false
  const heroLiveScore = heroMatch ? liveScoreMap.get(heroMatch.id) : undefined

  // Carousel matches: first 5 upcoming + any live
  const carouselMatches = [...liveMatches, ...upcomingMatches].slice(0, 5)

  // Season stats
  const gapToLead =
    myRank && allLeaderboard[0]
      ? Number(myRank.total_points) - Number(allLeaderboard[0].total_points)
      : null

  const lastMatchLabel = lastMatch
    ? (() => {
        const home = lastMatch.team_home as unknown as { short_name: string }
        const away = lastMatch.team_away as unknown as { short_name: string }
        return `${home.short_name} vs ${away.short_name} · M${lastMatch.match_number}`
      })()
    : ""

  return (
    <PageTransition>
      <div className="pb-10">
        {/* ── Cinematic Hero (296px) ─────────────────────────── */}
        {heroMatch ? (
          <CinematicHero
            match={heroMatch as Parameters<typeof CinematicHero>[0]["match"]}
            hasSubmitted={heroSubmitted}
            liveScore={heroLiveScore}
            featuredHomePlayers={featuredHomePlayers}
            featuredAwayPlayers={featuredAwayPlayers}
          />
        ) : (
          <div className="px-4 pt-8 pb-4">
            <h1 className="text-2xl font-display font-bold">TIPL Fantasy 2026</h1>
            <p className="text-sm text-muted-foreground mt-1">No matches scheduled</p>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────── */}
        <div className="px-4 md:px-6 max-w-2xl lg:max-w-5xl mx-auto mt-5 space-y-6">

          {/* 1. Upcoming Matches */}
          {carouselMatches.length > 0 && (
            <div className="space-y-3">
              <SectionHeader title="Upcoming Matches" href="/matches" linkLabel="See all ›" />
              <UpcomingCarousel
                matches={carouselMatches as unknown as Parameters<typeof UpcomingCarousel>[0]["matches"]}
                pickedMatchIds={submittedMatchIds}
              />
            </div>
          )}

          {carouselMatches.length > 0 && <Divider />}

          {/* 2. Championship Standings */}
          <div className="space-y-3">
            <SectionHeader title="Championship Standings" href="/leaderboard" linkLabel="Full table ›" />
            <StandingsTable
              entries={allLeaderboard.slice(0, 6) as unknown as Parameters<typeof StandingsTable>[0]["entries"]}
              currentUserId={user.id}
              myRank={myRank as unknown as Parameters<typeof StandingsTable>[0]["myRank"]}
            />
          </div>

          <Divider />

          {/* 3. Last 3 Match Results */}
          {matchResultsData.length > 0 && (
            <div className="space-y-3">
              <SectionHeader title="Last 3 Match Results" />
              <div className="space-y-3">
                {matchResultsData.map((data) => (
                  <MatchResultCard key={data.matchId} data={data} />
                ))}
              </div>
            </div>
          )}

          {matchResultsData.length > 0 && <Divider />}

          {/* 4. Your Season */}
          <div className="space-y-4">
            <SectionHeader title="Your Season" />

            <RankBlock
              rank={myRank?.season_rank ?? null}
              totalPlayers={totalPlayers}
              points={Number(myRank?.total_points ?? 0)}
              avgPerMatch={myRank ? Number((myRank as unknown as { avg_points?: number }).avg_points ?? 0) : null}
              gapToLead={gapToLead}
            />

            <OnTheBubble
              target={
                bubbleTarget
                  ? {
                      displayName: bubbleTarget.display_name,
                      rank: Number(bubbleTarget.season_rank),
                      gap: Number(myRank?.total_points ?? 0) - Number(bubbleTarget.total_points),
                    }
                  : null
              }
              threat={
                bubbleThreat
                  ? {
                      displayName: bubbleThreat.display_name,
                      rank: Number(bubbleThreat.season_rank),
                      gap: Number(myRank?.total_points ?? 0) - Number(bubbleThreat.total_points),
                    }
                  : null
              }
            />

            <MatchWinCabinet
              wins={matchWins.map((w) => ({
                matchId: w.match_id,
                matchNumber: (w.match as { match_number: number } | null)?.match_number ?? 0,
              }))}
              winsRank={winsRank}
              totalMatches={completedMatches.length}
            />
          </div>

          {awards.length > 0 && <Divider />}

          {/* 5. Last Match Awards */}
          {awards.length > 0 && lastMatch && (
            <div className="space-y-3">
              <SectionHeader
                title={`Match ${lastMatch.match_number} Awards`}
                subtitle={lastMatchLabel}
              />
              <MatchAwards
                awards={awards}
                matchLabel={lastMatchLabel}
                matchId={lastMatch.id}
              />
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">
          <span className="h-3.5 w-0.5 rounded-full bg-primary shrink-0" aria-hidden />
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 pl-[10px]">{subtitle}</p>
        )}
      </div>
      {href && linkLabel && (
        <Link href={href} className="text-xs text-primary font-semibold shrink-0 flex items-center gap-0.5">
          {linkLabel} <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function Divider() {
  return <div className="border-t border-white/[0.05]" />
}

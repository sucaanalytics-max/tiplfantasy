import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchMatchPoints, parseScorecardToStats, fuzzyMatchName } from "@/lib/api/cricapi"
import { loadScoringRules, calculatePlayerPoints, calculateUserMatchScore } from "@/lib/scoring"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find live matches with a cricapi_match_id — exit early if none (zero CricAPI calls)
  const { data: liveMatches } = await admin
    .from("matches")
    .select("id, cricapi_match_id, team_home_id, team_away_id")
    .eq("status", "live")
    .not("cricapi_match_id", "is", null)

  if (!liveMatches || liveMatches.length === 0) {
    return Response.json({ updated: [], message: "No live matches" })
  }

  const rules = await loadScoringRules()
  const updated: string[] = []
  const errors: Array<{ matchId: string; error: string }> = []

  for (const match of liveMatches) {
    try {
      // 1. Fetch fantasy points from CricAPI
      const result = await fetchMatchPoints(match.cricapi_match_id)
      if (!result || result.innings.length === 0) {
        errors.push({ matchId: match.id, error: "No innings data yet" })
        continue
      }

      // 2. Parse innings into normalised player stats
      const parsed = parseScorecardToStats(result.innings)

      // 3. Load DB players for this match's two teams
      const { data: dbPlayers } = await admin
        .from("players")
        .select("id, name")
        .in("team_id", [match.team_home_id, match.team_away_id])

      if (!dbPlayers) {
        errors.push({ matchId: match.id, error: "Failed to load players" })
        continue
      }

      // 4. Build normalised name → db id lookup
      const nameMap = new Map<string, string>()
      for (const p of dbPlayers) {
        const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
        nameMap.set(norm, p.id)
      }

      // 5. Match API names → DB ids and compute fantasy points
      const scoreRows: Array<{
        match_id: string
        player_id: string
        runs: number
        balls_faced: number
        fours: number
        sixes: number
        wickets: number
        overs_bowled: number
        runs_conceded: number
        maidens: number
        catches: number
        stumpings: number
        run_outs: number
        fantasy_points: number
        breakdown: unknown
      }> = []

      for (const [apiName, stats] of parsed) {
        const dbId = fuzzyMatchName(apiName, nameMap)
        if (!dbId) continue
        const { total, breakdown } = calculatePlayerPoints(stats, rules)
        scoreRows.push({
          match_id: match.id,
          player_id: dbId,
          runs: stats.runs,
          balls_faced: stats.balls_faced,
          fours: stats.fours,
          sixes: stats.sixes,
          wickets: stats.wickets,
          overs_bowled: stats.overs_bowled,
          runs_conceded: stats.runs_conceded,
          maidens: stats.maidens,
          catches: stats.catches,
          stumpings: stats.stumpings,
          run_outs: stats.run_outs,
          fantasy_points: total,
          breakdown,
        })
      }

      if (scoreRows.length === 0) {
        errors.push({ matchId: match.id, error: "No players matched" })
        continue
      }

      // 6. Overwrite player scores (delete + insert mirrors savePlayerScores)
      await admin.from("match_player_scores").delete().eq("match_id", match.id)
      const { error: insertErr } = await admin.from("match_player_scores").insert(scoreRows)
      if (insertErr) {
        errors.push({ matchId: match.id, error: insertErr.message })
        continue
      }

      // 7. Build score map for user calculation
      const scoreMap = new Map(scoreRows.map((r) => [r.player_id, r.fantasy_points]))

      // 8. Load all selections for this match
      const { data: selections } = await admin
        .from("selections")
        .select("id, user_id, captain_id, vice_captain_id, is_auto_pick")
        .eq("match_id", match.id)
        .limit(200)

      if (!selections || selections.length === 0) {
        errors.push({ matchId: match.id, error: "No selections found" })
        continue
      }

      // 9. Load selection players
      const selectionIds = selections.map((s) => s.id)
      const { data: selPlayers } = await admin
        .from("selection_players")
        .select("selection_id, player_id")
        .in("selection_id", selectionIds)
        .limit(2200)

      if (!selPlayers) {
        errors.push({ matchId: match.id, error: "Failed to load selection players" })
        continue
      }

      // 10. Group players by selection
      const playersBySelection = new Map<string, string[]>()
      for (const sp of selPlayers) {
        const arr = playersBySelection.get(sp.selection_id) ?? []
        arr.push(sp.player_id)
        playersBySelection.set(sp.selection_id, arr)
      }

      // 11. Calculate per-user scores with captain/VC multipliers
      const userScores = selections.map((sel) => {
        const res = calculateUserMatchScore(
          {
            userId: sel.user_id,
            selectionId: sel.id,
            captainId: sel.captain_id,
            viceCaptainId: sel.vice_captain_id,
            isAutoPick: sel.is_auto_pick,
            playerIds: playersBySelection.get(sel.id) ?? [],
          },
          scoreMap
        )
        return { userId: sel.user_id, total: res.total, captainPoints: res.captainPoints, vcPoints: res.vcPoints, rank: 0 }
      })

      // 12. Sort and assign ranks (ties share a rank)
      userScores.sort((a, b) => b.total - a.total)
      let currentRank = 1
      for (let i = 0; i < userScores.length; i++) {
        if (i > 0 && userScores[i].total < userScores[i - 1].total) currentRank = i + 1
        userScores[i].rank = currentRank
      }

      // 13. Upsert user match scores — safe to run repeatedly
      const userRows = userScores.map((s) => ({
        user_id: s.userId,
        match_id: match.id,
        total_points: s.total,
        rank: s.rank,
        captain_points: s.captainPoints,
        vc_points: s.vcPoints,
        breakdown: null,
      }))

      const { error: upsertErr } = await admin
        .from("user_match_scores")
        .upsert(userRows, { onConflict: "user_id,match_id" })

      if (upsertErr) {
        errors.push({ matchId: match.id, error: upsertErr.message })
        continue
      }

      // 14. Stamp when live points were last calculated
      await admin.from("matches").update({ live_scores_at: new Date().toISOString() }).eq("id", match.id)

      updated.push(match.id)
    } catch (err) {
      errors.push({ matchId: match.id, error: String(err) })
    }
  }

  return Response.json({ updated, errors })
}

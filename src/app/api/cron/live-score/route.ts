import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchMatchPoints, parseScorecardToStats, fuzzyMatchName, fetchMatchInfo } from "@/lib/api/sportmonks"
import { loadScoringRules, calculatePlayerPoints, calculateUserMatchScore } from "@/lib/scoring"
import { detectBanterEvents, detectRankBanter, generateBanter, type BanterEvent } from "@/lib/banter"
import { sendPushToAll } from "@/lib/push"

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
      // 1. Fetch fixture stats from SportMonks
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
        .select("id, name, team_id, cricapi_id")
        .in("team_id", [match.team_home_id, match.team_away_id])

      if (!dbPlayers) {
        errors.push({ matchId: match.id, error: "Failed to load players" })
        continue
      }

      // 3b. Auto-populate playing_xi if not yet done (saves a separate cron + API call)
      const { count: xiCount } = await admin
        .from("playing_xi")
        .select("id", { count: "exact", head: true })
        .eq("match_id", match.id)

      if (!xiCount || xiCount < 22) {
        const cricapiIdMap = new Map<string, { id: string; team_id: string }>()
        for (const p of dbPlayers) {
          if (p.cricapi_id) cricapiIdMap.set(p.cricapi_id, { id: p.id, team_id: p.team_id })
        }
        const xiMatched = new Map<string, string>()
        for (const apiPlayer of result.totals) {
          const byId = cricapiIdMap.get(apiPlayer.id)
          if (byId) { xiMatched.set(byId.id, byId.team_id); continue }
          const nameNorm = apiPlayer.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
          const dbMatch = dbPlayers.find((p) => {
            const pNorm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
            return pNorm === nameNorm || pNorm.includes(nameNorm) || nameNorm.includes(pNorm)
          })
          if (dbMatch) xiMatched.set(dbMatch.id, dbMatch.team_id)
        }
        const byTeam = new Map<string, string[]>()
        for (const [pid, tid] of xiMatched) {
          const list = byTeam.get(tid) ?? []; list.push(pid); byTeam.set(tid, list)
        }
        const teamCounts = [...byTeam.values()].map((v) => v.length)
        if (teamCounts.length === 2 && teamCounts.every((c) => c === 11)) {
          await admin.from("playing_xi").delete().eq("match_id", match.id)
          await admin.from("playing_xi").insert(
            [...xiMatched.entries()].map(([pid, tid]) => ({ match_id: match.id, player_id: pid, team_id: tid }))
          )
        }
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

      // 6. Upsert player scores (atomic — no gap between delete and insert)
      const { error: upsertPlayerErr } = await admin
        .from("match_player_scores")
        .upsert(scoreRows, { onConflict: "match_id,player_id" })
      if (upsertPlayerErr) {
        errors.push({ matchId: match.id, error: upsertPlayerErr.message })
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
        const playerIds = playersBySelection.get(sel.id) ?? []
        const res = calculateUserMatchScore(
          {
            userId: sel.user_id,
            selectionId: sel.id,
            captainId: sel.captain_id,
            viceCaptainId: sel.vice_captain_id,
            isAutoPick: sel.is_auto_pick,
            playerIds,
          },
          scoreMap
        )
        // Build per-player breakdown so the UI can show score bars during live matches
        const breakdown: Record<string, number> = {}
        for (const pid of playerIds) {
          const pts = scoreMap.get(pid) ?? 0
          if (pts > 0) breakdown[pid] = pts
        }
        return { userId: sel.user_id, total: res.total, captainPoints: res.captainPoints, vcPoints: res.vcPoints, rank: 0, breakdown }
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
        breakdown: s.breakdown,
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

      // 14b. Generate banter for noteworthy events
      try {
        // Load display names for league members
        const userIds = selections.map((s) => s.user_id)
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds)
        const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]))

        // Build player name lookup from dbPlayers
        const playerNameMap = new Map(dbPlayers.map((p) => [p.id, p.name]))

        const banterRows: Array<{ match_id: string; user_id: string | null; player_id: string | null; message: string; event_type: string }> = []

        // Build: who owns each player + captain/VC owners
        const playerOwners = new Map<string, string[]>()
        const playerCaptains = new Map<string, string[]>()
        const playerVCs = new Map<string, string[]>()
        for (const sel of selections) {
          const mn = nameMap.get(sel.user_id) ?? "Unknown"
          const pids = playersBySelection.get(sel.id) ?? []
          for (const pid of pids) {
            const o = playerOwners.get(pid) ?? []; o.push(mn); playerOwners.set(pid, o)
            if (sel.captain_id === pid) { const c = playerCaptains.get(pid) ?? []; c.push(mn); playerCaptains.set(pid, c) }
            if (sel.vice_captain_id === pid) { const v = playerVCs.get(pid) ?? []; v.push(mn); playerVCs.set(pid, v) }
          }
        }

        // For each scored player, detect events ONCE, group all owners
        for (const ps of scoreRows) {
          const owners = playerOwners.get(ps.player_id)
          if (!owners || owners.length === 0) continue
          const pn = playerNameMap.get(ps.player_id) ?? "Unknown"

          const events = detectBanterEvents(
            { player_id: ps.player_id, playerName: pn, runs: ps.runs, balls_faced: ps.balls_faced, wickets: ps.wickets, overs_bowled: Number(ps.overs_bowled), runs_conceded: ps.runs_conceded, fantasy_points: ps.fantasy_points },
            { memberName: owners[0], isCaptain: false, isViceCaptain: false }
          )
          for (const evt of events.filter(e => !["captain_fail","captain_haul","vc_fail"].includes(e.type))) {
            evt.memberNames = owners
            const msg = generateBanter(evt)
            if (msg) banterRows.push({ match_id: match.id, user_id: null, player_id: ps.player_id, message: msg, event_type: evt.type })
          }
          // Captain/VC specific
          const co = playerCaptains.get(ps.player_id) ?? []
          if (co.length > 0 && ps.fantasy_points < 15) {
            const e: BanterEvent = { type: "captain_fail", memberNames: co, memberName: co[0], playerName: pn, detail: `${ps.fantasy_points} pts` }
            const m = generateBanter(e); if (m) banterRows.push({ match_id: match.id, user_id: null, player_id: ps.player_id, message: m, event_type: "captain_fail" })
          } else if (co.length > 0 && ps.fantasy_points >= 60) {
            const e: BanterEvent = { type: "captain_haul", memberNames: co, memberName: co[0], playerName: pn, detail: `${ps.fantasy_points} pts at 2x` }
            const m = generateBanter(e); if (m) banterRows.push({ match_id: match.id, user_id: null, player_id: ps.player_id, message: m, event_type: "captain_haul" })
          }
          const vo = playerVCs.get(ps.player_id) ?? []
          if (vo.length > 0 && ps.fantasy_points < 10) {
            const e: BanterEvent = { type: "vc_fail", memberNames: vo, memberName: vo[0], playerName: pn, detail: `${ps.fantasy_points} pts` }
            const m = generateBanter(e); if (m) banterRows.push({ match_id: match.id, user_id: null, player_id: ps.player_id, message: m, event_type: "vc_fail" })
          }
        }

        // Rank-based banter — user-specific
        const sorted = [...userScores].sort((a, b) => b.total - a.total)
        for (const us of sorted) {
          const rank = us.rank
          const evt = detectRankBanter(nameMap.get(us.userId) ?? "Unknown", rank, sorted.length)
          if (evt) {
            const msg = generateBanter(evt)
            if (msg) banterRows.push({ match_id: match.id, user_id: us.userId, player_id: null, message: msg, event_type: evt.type })
          }
        }

        // Insert banter — delete old first to avoid duplicates (simpler than upsert with NULLs)
        if (banterRows.length > 0) {
          await admin.from("match_banter").delete().eq("match_id", match.id)
          await admin.from("match_banter").insert(banterRows)
        }
      } catch {
        // Banter generation is non-critical — don't fail the cron
      }

      // 15. Auto-detect match finished — only check API when both innings have data
      if (result.innings.length >= 2) {
      const fixtureInfo = await fetchMatchInfo(match.cricapi_match_id)
      if (fixtureInfo && fixtureInfo.status === "Finished") {
        const note = (fixtureInfo.note ?? "")
          .replace(/\s{2,}/g, " ")
          .trim()
        await admin.from("matches").update({
          status: "completed",
          ...(note ? { result_summary: note } : {}),
        }).eq("id", match.id)
        // Refresh season leaderboard materialized view
        await admin.rpc("refresh_leaderboard")

        // Push notification: match completed
        const winner = userScores.sort((a, b) => b.total - a.total)[0]
        const winnerName = nameMap?.get(winner?.userId ?? "") ?? "Unknown"
        try {
          await sendPushToAll({
            title: `🏆 Match #${match.cricapi_match_id ? "" : ""}${note ? "" : "Final"} Results`,
            body: `${winnerName} wins with ${winner?.total ?? 0} pts! ${note || ""}`.trim(),
            url: `/match/${match.id}/scores`,
            tag: `match-${match.id}-final`,
          })
        } catch { /* non-critical */ }
      }
      }

      updated.push(match.id)
    } catch (err) {
      errors.push({ matchId: match.id, error: String(err) })
    }
  }

  return Response.json({ updated, errors })
}

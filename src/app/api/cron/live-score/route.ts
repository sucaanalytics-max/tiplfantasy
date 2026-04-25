import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchMatchPoints, parseScorecardToStats, fuzzyMatchName, fetchMatchInfo } from "@/lib/api/sportmonks"
import { loadScoringRules, calculatePlayerPoints, calculateUserMatchScore } from "@/lib/scoring"
import { recalculateUserMatchScores } from "@/actions/scoring"
import { detectBanterEvents, detectRankBanter, generateBanter, type BanterEvent } from "@/lib/banter"
import { sendPushToAll, sendPushToUsers } from "@/lib/push"
import { generateText } from "@/lib/ai"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // ── Push: Lock reminder (30 min before match start) ──
  // Runs every 1 min, so check for upcoming matches starting in 29-31 min
  try {
    const now = new Date()
    const in25 = new Date(now.getTime() + 29 * 60 * 1000).toISOString()
    const in35 = new Date(now.getTime() + 31 * 60 * 1000).toISOString()

    const { data: soonMatches } = await admin
      .from("matches")
      .select("id, match_number, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
      .eq("status", "upcoming")
      .gte("start_time", in25)
      .lte("start_time", in35)

    for (const sm of soonMatches ?? []) {
      // Find users who have NOT submitted a selection for this match
      const { data: allUsers } = await admin.from("profiles").select("id").limit(200)
      const { data: submitted } = await admin.from("selections").select("user_id").eq("match_id", sm.id)
      const submittedIds = new Set((submitted ?? []).map((s) => s.user_id))
      const missingIds = (allUsers ?? []).map((u) => u.id).filter((id) => !submittedIds.has(id))

      const home = (sm.team_home as unknown as { short_name: string })?.short_name ?? "?"
      const away = (sm.team_away as unknown as { short_name: string })?.short_name ?? "?"

      if (missingIds.length > 0) {
        await sendPushToUsers(missingIds, {
          title: "⏰ Team Not Submitted!",
          body: `${home} vs ${away} starts in ~30 min — pick your XI!`,
          url: `/match/${sm.id}/pick`,
          tag: `lock-reminder-${sm.id}`,
        })
      }
    }
  } catch { /* lock reminder is non-critical */ }

  // Find live matches with a cricapi_match_id — exit early if none (zero CricAPI calls)
  const { data: liveMatches } = await admin
    .from("matches")
    .select("id, cricapi_match_id, team_home_id, team_away_id, live_scores_at, halfway_notified_at, last_banter_push_at, last_banter_message, last_lead_push_at, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
    .eq("status", "live")
    .eq("is_relay_paused", false)
    .not("cricapi_match_id", "is", null)

  if (!liveMatches || liveMatches.length === 0) {
    return Response.json({ updated: [], message: "No live matches" })
  }

  const rules = await loadScoringRules()
  const updated: string[] = []
  const errors: Array<{ matchId: string; error: string }> = []

  for (const match of liveMatches) {
    try {
      const isFirstLiveTick = !match.live_scores_at
      if (isFirstLiveTick) {
        await admin.from("matches").update({ live_scores_at: new Date().toISOString() }).eq("id", match.id)
      }

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
        .select("id, name, team_id, cricapi_id, role")
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
        if (teamCounts.length === 2 && teamCounts.every((c) => c >= 11 && c <= 12)) {
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
        dismissal: string | null
        batting_position: number | null
      }> = []

      // Build id → role lookup for duck eligibility
      const roleMap = new Map(dbPlayers.map((p) => [p.id, p.role ?? ""]))

      for (const [apiName, stats] of parsed) {
        const dbId = fuzzyMatchName(apiName, nameMap)
        if (!dbId) continue
        const { total, breakdown } = calculatePlayerPoints({ ...stats, role: roleMap.get(dbId) ?? "" }, rules)
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
          dismissal: stats.dismissal ?? null,
          batting_position: stats.batting_position ?? null,
        })
      }

      if (scoreRows.length === 0) {
        errors.push({ matchId: match.id, error: "No players matched" })
        continue
      }

      // 6. Delete stale player scores not in current scorecard, then upsert
      const currentPlayerIds = scoreRows.map((r) => r.player_id)
      await admin
        .from("match_player_scores")
        .delete()
        .eq("match_id", match.id)
        .not("player_id", "in", `(${currentPlayerIds.join(",")})`)

      const { error: upsertPlayerErr } = await admin
        .from("match_player_scores")
        .upsert(scoreRows, { onConflict: "match_id,player_id" })
      if (upsertPlayerErr) {
        errors.push({ matchId: match.id, error: upsertPlayerErr.message })
        continue
      }

      // 6b. Fetch fixture info (reused for POTM + match-complete detection)
      const fixtureInfo = await fetchMatchInfo(match.cricapi_match_id)

      // 6c. Apply POTM bonus BEFORE building scoreMap so user totals include it
      const potmPoints = rules.find((r) => r.name === "potm")?.points ?? 0
      if (fixtureInfo?.status === "Finished" && fixtureInfo.man_of_match_id && potmPoints > 0) {
        try {
          const { data: potmPlayer } = await admin
            .from("players").select("id").eq("cricapi_id", String(fixtureInfo.man_of_match_id)).single()
          if (potmPlayer) {
            const row = scoreRows.find((r) => r.player_id === potmPlayer.id)
            if (row) {
              const bd = row.breakdown as Record<string, number>
              if (!bd.potm) {
                bd.potm = potmPoints
                row.fantasy_points = Object.values(bd).reduce((a, b) => a + b, 0)
                row.breakdown = bd
                await admin.from("match_player_scores")
                  .update({ fantasy_points: row.fantasy_points, breakdown: bd })
                  .eq("match_id", match.id).eq("player_id", potmPlayer.id)
              }
            }
          }
        } catch { /* POTM bonus is non-critical */ }
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

      // 12a. Load display names (used by push notifications + banter)
      const userIds = selections.map((s) => s.user_id)
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds)
      const profileNameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]))

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

      // 14. Stamp when live points were last calculated + store last balls for ticker
      await admin.from("matches").update({
        live_scores_at: new Date().toISOString(),
        ...(result.balls && result.balls.length > 0 ? { last_balls: result.balls.slice(-12) } : {}),
      }).eq("id", match.id)

      // 14-snapshot. Store per-over fantasy point snapshot for momentum graph
      if (result.totalOversPlayed && result.totalOversPlayed > 0) {
        try {
          const scores: Record<string, number> = {}
          for (const us of userScores) scores[us.userId] = us.total
          await admin.from("match_score_snapshots").upsert({
            match_id: match.id,
            over_number: result.totalOversPlayed,
            scores,
          }, { onConflict: "match_id,over_number" })
        } catch { /* snapshots non-critical */ }
      }

      // 14a. ── Push: Halfway leaderboard (2nd innings started) ──
      if (!match.halfway_notified_at && result.innings.length >= 2) {
        try {
          const sortedHalf = [...userScores].sort((a, b) => b.total - a.total)
          const top3 = sortedHalf.slice(0, 3)
          // We need profile names — load them now (they'll be reused below)
          const halfUserIds = selections!.map((s) => s.user_id)
          const { data: halfProfiles } = await admin.from("profiles").select("id, display_name").in("id", halfUserIds)
          const halfNameMap = new Map((halfProfiles ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]))

          const leaderText = top3.map((u, i) => `${i + 1}. ${halfNameMap.get(u.userId) ?? "Unknown"} (${u.total})`).join(" · ")
          await sendPushToAll({
            title: "📊 Halfway Leaderboard",
            body: leaderText,
            url: `/match/${match.id}/scores`,
            tag: `match-${match.id}-halfway`,
          })
          await admin.from("matches").update({ halfway_notified_at: new Date().toISOString() }).eq("id", match.id)
        } catch { /* non-critical */ }
      }

      // 14b. Generate banter for noteworthy events
      try {
        const nameMap = profileNameMap

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

      // 14c. ── Push: factual cricket milestones (deduped per match+player+event) ──
      try {
        const homeTeamId = match.team_home_id as string
        const awayTeamId = match.team_away_id as string
        const homeShort = (match.team_home as unknown as { short_name: string })?.short_name ?? "?"
        const awayShort = (match.team_away as unknown as { short_name: string })?.short_name ?? "?"
        const playerTeamMap = new Map(dbPlayers.map((p) => [p.id, p.team_id as string]))
        const playerNameMap = new Map(dbPlayers.map((p) => [p.id, p.name]))
        const teamShort = (tid: string) => (tid === homeTeamId ? homeShort : tid === awayTeamId ? awayShort : "?")

        const captainCounts = new Map<string, number>()
        for (const sel of selections) {
          if (sel.captain_id) captainCounts.set(sel.captain_id, (captainCounts.get(sel.captain_id) ?? 0) + 1)
        }

        type Milestone = { event_type: string; title: string; body: string }
        const candidates: Array<{ player_id: string; m: Milestone }> = []

        for (const ps of scoreRows) {
          const name = playerNameMap.get(ps.player_id) ?? "Player"
          const team = teamShort(playerTeamMap.get(ps.player_id) ?? "")

          if (ps.runs >= 100) {
            candidates.push({
              player_id: ps.player_id,
              m: {
                event_type: "century",
                title: "🏏 Century",
                body: `${name} · ${ps.runs}${ps.balls_faced ? ` (${ps.balls_faced})` : ""} for ${team}`,
              },
            })
          } else if (ps.runs >= 50) {
            candidates.push({
              player_id: ps.player_id,
              m: {
                event_type: "fifty",
                title: "🏏 Fifty",
                body: `${name} · ${ps.runs}${ps.balls_faced ? ` (${ps.balls_faced})` : ""} for ${team}`,
              },
            })
          }

          if (ps.wickets >= 3) {
            candidates.push({
              player_id: ps.player_id,
              m: {
                event_type: "three_plus_wickets",
                title: "🎯 3-fer",
                body: `${name} · ${ps.wickets}/${ps.runs_conceded} for ${team}`,
              },
            })
          }

          const cCount = captainCounts.get(ps.player_id) ?? 0
          if (cCount > 0 && ps.fantasy_points >= 60) {
            candidates.push({
              player_id: ps.player_id,
              m: {
                event_type: "captain_haul",
                title: "⭐ Captain haul",
                body: `${name} · ${ps.fantasy_points} pts as C — picked by ${cCount} of you`,
              },
            })
          }
        }

        for (const { player_id, m } of candidates) {
          const { data: inserted } = await admin
            .from("match_milestone_pushes")
            .upsert(
              { match_id: match.id, player_id, event_type: m.event_type },
              { onConflict: "match_id,player_id,event_type", ignoreDuplicates: true }
            )
            .select()
          if (inserted && inserted.length > 0) {
            await sendPushToAll({
              title: m.title,
              body: m.body,
              url: `/match/${match.id}/scores`,
              tag: `milestone-${match.id}-${player_id}-${m.event_type}`,
            })
          }
        }
      } catch { /* non-critical */ }

      // 15. Auto-detect match finished (reuses fixtureInfo fetched at step 6b)
      if (fixtureInfo && fixtureInfo.status === "Finished" && fixtureInfo.winner_team_id) {
        const note = (fixtureInfo.note ?? "")
          .replace(/\s{2,}/g, " ")
          .trim()

        // POTM bonus already applied at step 6c (before user scores were calculated)

        await admin.from("matches").update({
          status: "completed",
          ...(note ? { result_summary: note } : {}),
        }).eq("id", match.id)
        // Refresh season leaderboard materialized view
        await admin.rpc("refresh_leaderboard")

        // Push notification: match completed — show top 2
        const sortedForPush = [...userScores].sort((a, b) => b.total - a.total)
        const top2 = sortedForPush.slice(0, 2).map((u) => {
          const name = profileNameMap.get(u.userId) ?? "Unknown"
          return `${name} (${u.total})`
        })
        try {
          await sendPushToAll({
            title: `🏆 Match Complete`,
            body: `${top2.join(" · ")}${note ? ` · ${note}` : ""}`,
            url: `/match/${match.id}/scores`,
            tag: `match-${match.id}-final`,
          })
        } catch { /* non-critical */ }
      }

      updated.push(match.id)
    } catch (err) {
      errors.push({ matchId: match.id, error: String(err) })
    }
  }

  // ── POTM backfill: apply bonus to recently completed matches where POTM was delayed ──
  try {
    const backfillRules = updated.length > 0 ? rules : await loadScoringRules()
    const potmPts = backfillRules.find((r) => r.name === "potm")?.points ?? 0

    if (potmPts > 0) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: recentCompleted } = await admin
        .from("matches")
        .select("id, cricapi_match_id")
        .eq("status", "completed")
        .not("cricapi_match_id", "is", null)
        .gte("updated_at", thirtyMinAgo)

      for (const cm of recentCompleted ?? []) {
        // Skip if POTM already applied for this match
        const { data: existingScores } = await admin
          .from("match_player_scores")
          .select("breakdown")
          .eq("match_id", cm.id)
          .limit(50)

        const alreadyApplied = (existingScores ?? []).some((s) => {
          const bd = s.breakdown as Record<string, number> | null
          return bd && bd.potm != null
        })
        if (alreadyApplied) continue

        const info = await fetchMatchInfo(cm.cricapi_match_id)
        if (!info?.man_of_match_id) continue

        // Apply POTM bonus
        const { data: potmPlayer } = await admin
          .from("players").select("id").eq("cricapi_id", String(info.man_of_match_id)).single()
        if (!potmPlayer) continue

        const { data: mps } = await admin
          .from("match_player_scores")
          .select("fantasy_points, breakdown")
          .eq("match_id", cm.id).eq("player_id", potmPlayer.id).single()
        if (!mps) continue

        const bd = (mps.breakdown as Record<string, number>) ?? {}
        if (bd.potm) continue

        bd.potm = potmPts
        const newTotal = Object.values(bd).reduce((a, b) => a + b, 0)
        await admin.from("match_player_scores")
          .update({ fantasy_points: newTotal, breakdown: bd })
          .eq("match_id", cm.id).eq("player_id", potmPlayer.id)

        // Recalculate user scores to reflect the POTM bonus
        await recalculateUserMatchScores(cm.id)

        updated.push(`potm-backfill:${cm.id}`)
      }
    }
  } catch { /* POTM backfill is non-critical */ }

  return Response.json({ updated, errors })
}

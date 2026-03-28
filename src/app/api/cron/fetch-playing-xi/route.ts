import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchMatchPoints, fuzzyMatchName } from "@/lib/api/cricapi"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find live matches that still have no playing_xi entries
  const { data: liveMatches } = await admin
    .from("matches")
    .select("id, cricapi_match_id, team_home_id, team_away_id, start_time")
    .eq("status", "live")
    .not("cricapi_match_id", "is", null)

  if (!liveMatches || liveMatches.length === 0) {
    return Response.json({ message: "No live matches" })
  }

  const results: Array<{ matchId: string; status: string }> = []

  for (const match of liveMatches) {
    try {
      // Check if playing_xi already populated
      const { count } = await admin
        .from("playing_xi")
        .select("id", { count: "exact", head: true })
        .eq("match_id", match.id)

      if (count && count >= 22) {
        results.push({ matchId: match.id, status: "already_populated" })
        continue
      }

      // Fetch match_points — returns totals[] with all players in the match
      const pointsResult = await fetchMatchPoints(match.cricapi_match_id)
      if (!pointsResult || pointsResult.totals.length === 0) {
        results.push({ matchId: match.id, status: "no_match_points_yet" })
        continue
      }

      // Load DB players for both teams
      const { data: dbPlayers } = await admin
        .from("players")
        .select("id, name, team_id, cricapi_id")
        .in("team_id", [match.team_home_id, match.team_away_id])

      if (!dbPlayers) {
        results.push({ matchId: match.id, status: "db_player_load_failed" })
        continue
      }

      // Build lookup maps
      const cricapiIdMap = new Map<string, { id: string; team_id: string }>()
      const nameMap = new Map<string, string>()
      for (const p of dbPlayers) {
        if (p.cricapi_id) {
          cricapiIdMap.set(p.cricapi_id, { id: p.id, team_id: p.team_id })
        }
        const norm = p.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
        nameMap.set(norm, p.id)
      }

      // Match API players to DB — prefer cricapi_id, fallback to fuzzy name
      const matched = new Map<string, string>() // player_id → team_id
      const unmatched: string[] = []

      for (const apiPlayer of pointsResult.totals) {
        // Try cricapi_id match first
        const byId = cricapiIdMap.get(apiPlayer.id)
        if (byId) {
          matched.set(byId.id, byId.team_id)
          continue
        }

        // Fallback to fuzzy name match
        const dbId = fuzzyMatchName(apiPlayer.name, nameMap)
        if (dbId) {
          const playerTeam = dbPlayers.find((p) => p.id === dbId)
          if (playerTeam) {
            matched.set(dbId, playerTeam.team_id)
          }
        } else {
          unmatched.push(apiPlayer.name)
        }
      }

      // Group by team and validate 11+11
      const byTeam = new Map<string, string[]>()
      for (const [pid, tid] of matched) {
        const list = byTeam.get(tid) ?? []
        list.push(pid)
        byTeam.set(tid, list)
      }

      const teamCounts = [...byTeam.values()].map((v) => v.length)
      if (teamCounts.length !== 2 || teamCounts.some((c) => c !== 11)) {
        results.push({
          matchId: match.id,
          status: `partial (${matched.size} matched: ${teamCounts.join("+")}${unmatched.length > 0 ? `, ${unmatched.length} unmatched` : ""})`,
        })
        continue
      }

      // Valid 11+11 — insert into playing_xi
      await admin.from("playing_xi").delete().eq("match_id", match.id)

      const rows = [...matched.entries()].map(([pid, tid]) => ({
        match_id: match.id,
        player_id: pid,
        team_id: tid,
      }))

      const { error: insertError } = await admin.from("playing_xi").insert(rows)
      if (insertError) {
        results.push({ matchId: match.id, status: `insert_error: ${insertError.message}` })
      } else {
        results.push({ matchId: match.id, status: `ok (${rows.length} players inserted)` })
      }
    } catch (err) {
      results.push({ matchId: match.id, status: `error: ${String(err)}` })
    }
  }

  return Response.json({ checked: results.length, results })
}

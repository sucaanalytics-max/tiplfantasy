import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const CRICAPI_BASE = "https://api.cricapi.com/v1"

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function fuzzyMatchName(
  apiName: string,
  dbNames: Map<string, string>
): string | null {
  const normalized = normalizeName(apiName)

  // Exact match
  if (dbNames.has(normalized)) return dbNames.get(normalized)!

  // Partial match — check includes both directions
  for (const [dbNorm, dbId] of dbNames) {
    if (dbNorm.includes(normalized) || normalized.includes(dbNorm)) {
      return dbId
    }
  }

  // Last name match
  const apiLast = normalized.split(" ").pop() ?? ""
  for (const [dbNorm, dbId] of dbNames) {
    const dbLast = dbNorm.split(" ").pop() ?? ""
    if (apiLast === dbLast && apiLast.length > 3) {
      return dbId
    }
  }

  return null
}

async function fetchMatchInfo(matchId: string, apiKey: string) {
  const res = await fetch(
    `${CRICAPI_BASE}/match_info?apikey=${apiKey}&id=${matchId}`
  )
  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? null
}

async function fetchSquad(matchId: string, apiKey: string) {
  const res = await fetch(
    `${CRICAPI_BASE}/match_squad?apikey=${apiKey}&id=${matchId}`
  )
  if (!res.ok) return null
  const json = await res.json()
  const players: Array<{ name: string; id: string }> = []
  for (const team of json.data ?? []) {
    for (const p of team.players ?? []) {
      players.push({ name: p.name, id: p.id })
    }
  }
  return players
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const apiKey = Deno.env.get("CRICDATA_KEY")
    if (!apiKey) throw new Error("CRICDATA_KEY not set")

    // Find upcoming matches starting within the next 60 minutes
    const now = new Date()
    const soon = new Date(now.getTime() + 60 * 60 * 1000)

    const { data: matches, error: matchError } = await supabase
      .from("matches")
      .select("id, cricapi_match_id, team_home_id, team_away_id, start_time")
      .eq("status", "upcoming")
      .not("cricapi_match_id", "is", null)
      .lte("start_time", soon.toISOString())
      .gte("start_time", now.toISOString())

    if (matchError) throw matchError

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming matches within 60 minutes" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const results: Array<{ match_id: string; status: string }> = []

    for (const match of matches) {
      try {
        // Check if playing_xi already populated for this match
        const { count } = await supabase
          .from("playing_xi")
          .select("id", { count: "exact", head: true })
          .eq("match_id", match.id)

        if (count && count >= 22) {
          results.push({ match_id: match.id, status: "already_populated" })
          continue
        }

        // Check if toss has happened via match_info
        const matchInfo = await fetchMatchInfo(match.cricapi_match_id, apiKey)
        if (!matchInfo?.tossWinner) {
          results.push({ match_id: match.id, status: "no_toss_yet" })
          continue
        }

        // Toss done — fetch squad and try to get Playing XI
        const squad = await fetchSquad(match.cricapi_match_id, apiKey)
        if (!squad || squad.length === 0) {
          results.push({ match_id: match.id, status: "no_squad_data" })
          continue
        }

        // Load DB players for both teams
        const { data: dbPlayers } = await supabase
          .from("players")
          .select("id, name, team_id")
          .in("team_id", [match.team_home_id, match.team_away_id])

        if (!dbPlayers) {
          results.push({ match_id: match.id, status: "db_player_load_failed" })
          continue
        }

        const nameMap = new Map<string, string>()
        for (const p of dbPlayers) {
          nameMap.set(normalizeName(p.name), p.id)
        }

        // Match API players to DB
        const matched: string[] = []
        for (const apiPlayer of squad) {
          const dbId = fuzzyMatchName(apiPlayer.name, nameMap)
          if (dbId) matched.push(dbId)
        }

        // Deduplicate — fuzzyMatchName can map multiple API names to the same DB player
        const deduped = [...new Set(matched)]

        // Group by team and validate 11 per team
        const playerTeamMap = new Map(dbPlayers.map((p) => [p.id, p.team_id]))
        const byTeam = new Map<string, string[]>()
        for (const pid of deduped) {
          const tid = playerTeamMap.get(pid)
          if (!tid) continue
          const list = byTeam.get(tid) ?? []
          list.push(pid)
          byTeam.set(tid, list)
        }

        const teamCounts = [...byTeam.values()].map((v) => v.length)
        if (teamCounts.length !== 2 || teamCounts.some((c) => c !== 11)) {
          results.push({
            match_id: match.id,
            status: `not_xi_yet (${deduped.length} players: ${teamCounts.join("+")})`
          })
          continue
        }

        // Valid 11+11 — insert into playing_xi
        await supabase.from("playing_xi").delete().eq("match_id", match.id)

        const rows = deduped.map((pid) => ({
          match_id: match.id,
          player_id: pid,
          team_id: playerTeamMap.get(pid)!,
        }))

        const { error: insertError } = await supabase.from("playing_xi").insert(rows)
        if (insertError) {
          results.push({ match_id: match.id, status: `insert_error: ${insertError.message}` })
        } else {
          results.push({ match_id: match.id, status: `ok (${rows.length} players inserted)` })
        }

        // Small delay between matches
        await new Promise((r) => setTimeout(r, 500))
      } catch (e) {
        results.push({ match_id: match.id, status: `error: ${(e as Error).message}` })
      }
    }

    return new Response(
      JSON.stringify({ checked: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SPORTMONKS_BASE = "https://cricket.sportmonks.com/api/v2.0"

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

  if (dbNames.has(normalized)) return dbNames.get(normalized)!

  for (const [dbNorm, dbId] of dbNames) {
    if (dbNorm.includes(normalized) || normalized.includes(dbNorm)) {
      return dbId
    }
  }

  const apiLast = normalized.split(" ").pop() ?? ""
  for (const [dbNorm, dbId] of dbNames) {
    const dbLast = dbNorm.split(" ").pop() ?? ""
    if (apiLast === dbLast && apiLast.length > 3) {
      return dbId
    }
  }

  return null
}

async function fetchFixtureInfo(fixtureId: string, token: string) {
  const res = await fetch(
    `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${token}`
  )
  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? null
}

async function fetchLineup(fixtureId: string, token: string) {
  const res = await fetch(
    `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${token}&include=lineup`
  )
  if (!res.ok) return null
  const json = await res.json()
  const lineup = json.data?.lineup ?? []
  return lineup.map((p: { id: number; fullname: string; lineup?: { team_id: number } }) => ({
    name: p.fullname,
    id: String(p.id),
    team_id: p.lineup?.team_id,
  }))
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

    const token = Deno.env.get("SPORTMONKS_TOKEN")
    if (!token) throw new Error("SPORTMONKS_TOKEN not set")

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

        // Check if toss has happened via fixture info
        const fixtureInfo = await fetchFixtureInfo(match.cricapi_match_id, token)
        if (!fixtureInfo?.toss_won_team_id) {
          results.push({ match_id: match.id, status: "no_toss_yet" })
          continue
        }

        // Toss done — fetch lineup (Playing XI)
        const lineup = await fetchLineup(match.cricapi_match_id, token)
        if (!lineup || lineup.length === 0) {
          results.push({ match_id: match.id, status: "no_lineup_data" })
          continue
        }

        // Load DB players for both teams
        const { data: dbPlayers } = await supabase
          .from("players")
          .select("id, name, team_id, cricapi_id")
          .in("team_id", [match.team_home_id, match.team_away_id])

        if (!dbPlayers) {
          results.push({ match_id: match.id, status: "db_player_load_failed" })
          continue
        }

        // Build lookup maps
        const cricapiIdMap = new Map<string, { id: string; team_id: string }>()
        const nameMap = new Map<string, string>()
        for (const p of dbPlayers) {
          if (p.cricapi_id) cricapiIdMap.set(p.cricapi_id, { id: p.id, team_id: p.team_id })
          nameMap.set(normalizeName(p.name), p.id)
        }

        // Match lineup players to DB — prefer cricapi_id, fallback to fuzzy name
        const matched = new Map<string, string>() // player_id → team_id
        for (const apiPlayer of lineup) {
          const byId = cricapiIdMap.get(apiPlayer.id)
          if (byId) { matched.set(byId.id, byId.team_id); continue }
          const dbId = fuzzyMatchName(apiPlayer.name, nameMap)
          if (dbId) {
            const playerTeam = dbPlayers.find((p) => p.id === dbId)
            if (playerTeam) matched.set(dbId, playerTeam.team_id)
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
            match_id: match.id,
            status: `not_xi_yet (${matched.size} players: ${teamCounts.join("+")})`
          })
          continue
        }

        // Valid 11+11 — insert into playing_xi
        await supabase.from("playing_xi").delete().eq("match_id", match.id)

        const rows = [...matched.entries()].map(([pid, tid]) => ({
          match_id: match.id,
          player_id: pid,
          team_id: tid,
        }))

        const { error: insertError } = await supabase.from("playing_xi").insert(rows)
        if (insertError) {
          results.push({ match_id: match.id, status: `insert_error: ${insertError.message}` })
        } else {
          results.push({ match_id: match.id, status: `ok (${rows.length} players inserted)` })
        }
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

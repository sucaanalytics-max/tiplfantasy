import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface PlayerStats {
  ipl_matches: number | null
  ipl_innings: number | null
  ipl_runs: number | null
  ipl_batting_avg: number | null
  ipl_strike_rate: number | null
  ipl_highest_score: string | null
  ipl_fifties: number | null
  ipl_hundreds: number | null
  ipl_fours: number | null
  ipl_sixes: number | null
  ipl_wickets: number | null
  ipl_bowling_avg: number | null
  ipl_economy: number | null
  ipl_best_bowling: string | null
  ipl_catches: number | null
  ipl_recent_scores: number[] | null
}

function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[^0-9.-]/g, "")
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function extractTableRows(html: string, tableIndex: number): string[][] {
  // Find all TableLined tables
  const tableRegex = /<table[^>]*class="TableLined"[^>]*>([\s\S]*?)<\/table>/gi
  const tables: string[] = []
  let match
  while ((match = tableRegex.exec(html)) !== null) {
    tables.push(match[1])
  }
  if (tableIndex >= tables.length) return []

  const tableHtml = tables[tableIndex]
  const rows: string[][] = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells: string[] = []
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let cellMatch
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim())
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

function parseStats(html: string): PlayerStats {
  const stats: PlayerStats = {
    ipl_matches: null,
    ipl_innings: null,
    ipl_runs: null,
    ipl_batting_avg: null,
    ipl_strike_rate: null,
    ipl_highest_score: null,
    ipl_fifties: null,
    ipl_hundreds: null,
    ipl_fours: null,
    ipl_sixes: null,
    ipl_wickets: null,
    ipl_bowling_avg: null,
    ipl_economy: null,
    ipl_best_bowling: null,
    ipl_catches: null,
    ipl_recent_scores: null,
  }

  // Batting stats table (usually first TableLined)
  const battingRows = extractTableRows(html, 0)
  // Look for the "Overall" or last data row in batting
  for (const row of battingRows) {
    if (row[0]?.toLowerCase().includes("overall") || row[0]?.toLowerCase().includes("total")) {
      stats.ipl_matches = parseNumber(row[1] ?? "")
      stats.ipl_innings = parseNumber(row[2] ?? "")
      stats.ipl_runs = parseNumber(row[4] ?? "")
      stats.ipl_highest_score = row[5]?.trim() || null
      stats.ipl_batting_avg = parseNumber(row[6] ?? "")
      stats.ipl_strike_rate = parseNumber(row[8] ?? "")
      stats.ipl_hundreds = parseNumber(row[9] ?? "")
      stats.ipl_fifties = parseNumber(row[10] ?? "")
      stats.ipl_fours = parseNumber(row[11] ?? "")
      stats.ipl_sixes = parseNumber(row[12] ?? "")
      stats.ipl_catches = parseNumber(row[13] ?? "")
      break
    }
  }

  // Bowling stats table (usually second TableLined)
  const bowlingRows = extractTableRows(html, 1)
  for (const row of bowlingRows) {
    if (row[0]?.toLowerCase().includes("overall") || row[0]?.toLowerCase().includes("total")) {
      stats.ipl_wickets = parseNumber(row[5] ?? "")
      stats.ipl_bowling_avg = parseNumber(row[6] ?? "")
      stats.ipl_economy = parseNumber(row[7] ?? "")
      stats.ipl_best_bowling = row[9]?.trim() || null
      break
    }
  }

  // Recent scores — try to parse from innings table (usually third or fourth)
  const inningsRows = extractTableRows(html, 2)
  if (inningsRows.length > 1) {
    const recentScores: number[] = []
    // Skip header row, take last 5 innings
    for (let i = 1; i < inningsRows.length && recentScores.length < 5; i++) {
      const scoreStr = inningsRows[i][3] ?? inningsRows[i][2] ?? ""
      const score = parseNumber(scoreStr)
      if (score !== null) recentScores.push(score)
    }
    if (recentScores.length > 0) {
      stats.ipl_recent_scores = recentScores
    }
  }

  return stats
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

    const body = await req.json().catch(() => ({}))
    const targetPlayerId = body.player_id as string | undefined

    // Get players with howstat_id
    let query = supabase
      .from("players")
      .select("id, name, howstat_id")
      .not("howstat_id", "is", null)

    if (targetPlayerId) {
      query = query.eq("id", targetPlayerId)
    }

    const { data: players, error: fetchError } = await query
    if (fetchError) throw fetchError

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ message: "No players with howstat_id found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const results: { name: string; status: string }[] = []

    for (const player of players) {
      try {
        const url = `https://www.howstat.com/Cricket/Statistics/IPL/PlayerOverview.asp?PlayerID=${encodeURIComponent(String(player.howstat_id))}`
        const res = await fetch(url)
        if (!res.ok) {
          results.push({ name: player.name, status: `HTTP ${res.status}` })
          continue
        }

        const html = await res.text()
        const stats = parseStats(html)

        const { error: updateError } = await supabase
          .from("players")
          .update({
            ...stats,
            stats_updated_at: new Date().toISOString(),
          })
          .eq("id", player.id)

        if (updateError) {
          results.push({ name: player.name, status: `DB error: ${updateError.message}` })
        } else {
          results.push({ name: player.name, status: "ok" })
        }

        // Small delay to be polite to howstat
        await new Promise((r) => setTimeout(r, 500))
      } catch (e) {
        results.push({ name: player.name, status: `Error: ${(e as Error).message}` })
      }
    }

    return new Response(
      JSON.stringify({ synced: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})

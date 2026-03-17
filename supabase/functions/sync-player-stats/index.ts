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
  const cleaned = text.replace(/<[^>]*>/g, "").replace(/[^0-9.-]/g, "").trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Extract a field value from howstat's FieldName2/FieldValue pattern
// Looks for: <span class="FieldName2">label:</span> ... <td class="FieldValue">value</td>
function extractField(html: string, label: string): string | null {
  // Match the label followed by its value cell (FieldValue or FieldValueAsterisk)
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(
    `<span[^>]*class="FieldName2"[^>]*>${escaped}:?</span>[\\s\\S]*?<td[^>]*class="FieldValue(?:Asterisk)?"[^>]*>([\\s\\S]*?)</td>`,
    "i"
  )
  const match = regex.exec(html)
  if (!match) return null
  // Strip HTML tags and trim
  return match[1].replace(/<[^>]*>/g, "").trim() || null
}

// Extract Matches from the profile section (uses FieldName class, not FieldName2)
function extractMatches(html: string): number | null {
  const regex = /<td[^>]*class="FieldName"[^>]*>Matches:<\/td>\s*<td[^>]*>\s*(\d+)/i
  const match = regex.exec(html)
  return match ? parseNumber(match[1]) : null
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

  // Matches from profile section
  stats.ipl_matches = extractMatches(html)

  // Batting stats
  stats.ipl_innings = parseNumber(extractField(html, "Innings") ?? "")
  stats.ipl_runs = parseNumber(extractField(html, "Aggregate") ?? "")
  stats.ipl_highest_score = extractField(html, "Highest Score")
  stats.ipl_batting_avg = parseNumber(extractField(html, "Average") ?? "")
  stats.ipl_strike_rate = parseNumber(extractField(html, "Scoring Rate") ?? "")
  stats.ipl_fifties = parseNumber(extractField(html, "50s") ?? "")
  stats.ipl_hundreds = parseNumber(extractField(html, "100s") ?? "")
  stats.ipl_fours = parseNumber(extractField(html, "4s") ?? "")
  stats.ipl_sixes = parseNumber(extractField(html, "6s") ?? "")

  // Bowling stats — these labels appear after the "Bowling" section header
  // Extract bowling section to avoid conflicting with batting "Average"
  const bowlingSectionMatch = html.match(/background-color:\s*#a5d3ca[^>]*>\s*Bowling[\s\S]*?(?:background-color:\s*#a5d3ca|$)/i)
  if (bowlingSectionMatch) {
    const bowlingHtml = bowlingSectionMatch[0]
    stats.ipl_wickets = parseNumber(extractField(bowlingHtml, "Wickets") ?? "")
    // Bowling average — extract from bowling section
    const bowlAvgMatch = bowlingHtml.match(/<span[^>]*class="FieldName2"[^>]*>Average:?<\/span>[\s\S]*?<td[^>]*class="FieldValue[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    if (bowlAvgMatch) {
      stats.ipl_bowling_avg = parseNumber(bowlAvgMatch[1].replace(/<[^>]*>/g, ""))
    }
    stats.ipl_economy = parseNumber(extractField(bowlingHtml, "Economy Rate") ?? "")
    stats.ipl_best_bowling = extractField(bowlingHtml, "Best")
  }

  // Fielding stats — extract from Fielding section
  const fieldingSectionMatch = html.match(/background-color:\s*#a5d3ca[^>]*>\s*Fielding[\s\S]*?(?:background-color:\s*#a5d3ca|$)/i)
  if (fieldingSectionMatch) {
    stats.ipl_catches = parseNumber(extractField(fieldingSectionMatch[0], "Catches") ?? "")
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

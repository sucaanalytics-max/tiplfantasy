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
}

function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[^0-9.-]/g, "").trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/**
 * Parse Statsguru career averages table.
 * Statsguru HTML has rows like:
 *   <td class="left">filtered</td>
 *   <td class="left" nowrap="nowrap">2015-2023</td>
 *   <td>50</td> <td>37</td> ...
 *
 * We find the "filtered" label, then collect all subsequent <td> values
 * until the next </tr> or profile link.
 *
 * Batting: [Span, Mat, Inns, NO, Runs, HS, Ave, BF, SR, 100, 50, 0, 4s, 6s]
 * Bowling: [Span, Mat, Inns, Overs, Mdns, Runs, Wkts, BBI, Ave, Econ, SR, 4, 5]
 */
function extractFilteredRow(html: string): string[] | null {
  // Find position of ">filtered<" label
  const filteredIdx = html.indexOf(">filtered<")
  if (filteredIdx === -1) return null

  // Extract everything after the "filtered" label until </tr>
  const afterFiltered = html.substring(filteredIdx)
  const trEnd = afterFiltered.indexOf("</tr>")
  const rowHtml = trEnd > 0 ? afterFiltered.substring(0, trEnd) : afterFiltered.substring(0, 2000)

  // Extract all <td> cell values (handle cells with inner tags like <a>)
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const cells: string[] = []
  let cellMatch
  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    // Strip HTML tags from cell content
    const text = cellMatch[1].replace(/<[^>]*>/g, "").trim()
    cells.push(text)
  }

  // The filtered row may start with a year span like "2015-2023" or just the matches count.
  // Single-season players have no year span — first cell is just the number of matches.
  // Try to find year span first, otherwise take cells from the start.
  const yearIdx = cells.findIndex((c) => /^\d{4}(-\d{4})?$/.test(c))
  if (yearIdx >= 0) {
    return cells.slice(yearIdx)
  }

  // No year span — cells start directly with Mat, Inns, etc.
  // Prepend a dummy span so column indices stay consistent
  if (cells.length >= 5 && /^\d+$/.test(cells[0])) {
    return ["-", ...cells]
  }

  return null
}

async function fetchBattingStats(cricinfoId: number): Promise<Partial<PlayerStats>> {
  const url = `https://stats.espncricinfo.com/ci/engine/player/${cricinfoId}.html?class=6;template=results;trophy=117;type=batting`
  const res = await fetch(url)
  if (!res.ok) return {}

  const html = await res.text()
  const row = extractFilteredRow(html)
  if (!row || row.length < 14) return {}

  return {
    ipl_matches: parseNumber(row[1]),
    ipl_innings: parseNumber(row[2]),
    ipl_runs: parseNumber(row[4]),
    ipl_highest_score: row[5] || null,
    ipl_batting_avg: parseNumber(row[6]),
    ipl_strike_rate: parseNumber(row[8]),
    ipl_hundreds: parseNumber(row[9]),
    ipl_fifties: parseNumber(row[10]),
    ipl_fours: parseNumber(row[12]),
    ipl_sixes: parseNumber(row[13]),
  }
}

async function fetchBowlingStats(cricinfoId: number): Promise<Partial<PlayerStats>> {
  const url = `https://stats.espncricinfo.com/ci/engine/player/${cricinfoId}.html?class=6;template=results;trophy=117;type=bowling`
  const res = await fetch(url)
  if (!res.ok) return {}

  const html = await res.text()
  const row = extractFilteredRow(html)
  if (!row || row.length < 11) return {}

  return {
    ipl_matches: parseNumber(row[1]), // fallback if batting page had no data
    ipl_wickets: parseNumber(row[6]),
    ipl_bowling_avg: parseNumber(row[8]),
    ipl_economy: parseNumber(row[9]),
    ipl_best_bowling: row[7] || null,
  }
}

async function fetchFieldingStats(cricinfoId: number): Promise<Partial<PlayerStats>> {
  const url = `https://stats.espncricinfo.com/ci/engine/player/${cricinfoId}.html?class=6;template=results;trophy=117;type=fielding`
  const res = await fetch(url)
  if (!res.ok) return {}

  const html = await res.text()
  const row = extractFilteredRow(html)
  if (!row || row.length < 5) return {}

  return {
    ipl_catches: parseNumber(row[4]),
  }
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

    let query = supabase
      .from("players")
      .select("id, name, cricinfo_id")
      .not("cricinfo_id", "is", null)

    if (targetPlayerId) {
      query = query.eq("id", targetPlayerId)
    } else {
      query = query.is("ipl_matches", null)
    }

    const { data: players, error: fetchError } = await query
    if (fetchError) throw fetchError

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ message: "No players to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const results: { name: string; status: string; matches?: number | null }[] = []

    for (const player of players) {
      try {
        const cricinfoId = player.cricinfo_id as number

        const [batting, bowling, fielding] = await Promise.all([
          fetchBattingStats(cricinfoId),
          fetchBowlingStats(cricinfoId),
          fetchFieldingStats(cricinfoId),
        ])

        const stats: Partial<PlayerStats> = { ...batting, ...bowling, ...fielding }

        if (stats.ipl_matches && stats.ipl_matches > 0) {
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
            results.push({ name: player.name, status: "ok", matches: stats.ipl_matches })
          }
        } else {
          results.push({ name: player.name, status: "no_ipl_data" })
        }

        await new Promise((r) => setTimeout(r, 800))
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

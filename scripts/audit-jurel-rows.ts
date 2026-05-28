// Quick read-only inspection of Dhruv Jurel's match_player_scores rows
// to understand why the on-screen Match Log only shows 6 of 11 matches.

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const envPath = path.resolve(__dirname, "../.env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=")
  if (key && !key.startsWith("#")) {
    const raw = rest.join("=").trim()
    const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
    process.env[key.trim()] = unquoted
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: jurel } = await supabase
    .from("players")
    .select("id, name")
    .ilike("name", "%Dhruv Jurel%")
    .maybeSingle()
  if (!jurel) {
    console.error("Jurel not found")
    return
  }

  const { data: rows } = await supabase
    .from("match_player_scores")
    .select("match_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, catches, stumpings, run_outs, fantasy_points, matches(match_number, status)")
    .eq("player_id", jurel.id)

  const sorted = (rows ?? []).slice().sort((a: { matches: { match_number: number } }, b: { matches: { match_number: number } }) =>
    a.matches.match_number - b.matches.match_number
  )
  console.log(`\nDhruv Jurel — ${sorted.length} match_player_scores row(s):\n`)
  console.table(
    sorted.map((r: { matches: { match_number: number; status: string }; runs: number; balls_faced: number; fours: number; sixes: number; wickets: number; overs_bowled: number; catches: number; stumpings: number; fantasy_points: number }) => ({
      M: `M${r.matches.match_number}`,
      status: r.matches.status,
      runs: r.runs,
      balls: r.balls_faced,
      "4s": r.fours,
      "6s": r.sixes,
      wkts: r.wickets,
      overs: r.overs_bowled,
      ct: r.catches,
      st: r.stumpings,
      pts: Math.round(Number(r.fantasy_points)),
    }))
  )

  console.log("\nPlaying XI membership (was he announced in the XI for each RR completed match?):\n")
  const { data: rrTeam } = await supabase.from("teams").select("id").eq("short_name", "RR").maybeSingle()
  const { data: rrMatches } = await supabase
    .from("matches")
    .select("id, match_number")
    .or(`team_home_id.eq.${rrTeam!.id},team_away_id.eq.${rrTeam!.id}`)
    .eq("status", "completed")
    .order("match_number")

  const { data: xiRows } = await supabase
    .from("playing_xi")
    .select("match_id")
    .eq("player_id", jurel.id)
  const xiMatchIds = new Set((xiRows ?? []).map((r: { match_id: string }) => r.match_id))

  console.table(
    (rrMatches ?? []).map((m: { id: string; match_number: number }) => ({
      M: `M${m.match_number}`,
      inXI: xiMatchIds.has(m.id) ? "yes" : "NO",
    }))
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

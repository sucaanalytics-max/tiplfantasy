/**
 * Insert IPL 2026 knockout matches into matches table.
 * Data sourced from SportMonks season 1795 fixtures on 2026-05-26.
 *
 * Adds Qualifier 1 (M71) and Eliminator (M72). Qualifier 2 and Final are
 * skipped because both teams are TBC — they should be added after the
 * preceding result is in.
 *
 * Usage: npx tsx scripts/insert-knockouts.ts
 *        npx tsx scripts/insert-knockouts.ts --dry-run
 */

import * as fs from "fs"
import * as path from "path"
import { createClient } from "@supabase/supabase-js"

const envPath = path.resolve(__dirname, "../.env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=")
  if (key && !key.startsWith("#")) {
    const raw = rest.join("=").trim()
    process.env[key.trim()] = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes("--dry-run")

type Knockout = {
  match_number: number
  home_short: string
  away_short: string
  venue: string
  start_time: string  // ISO UTC
  cricapi_match_id: string  // Sportmonks fixture id
  label: string
}

const KNOCKOUTS: Knockout[] = [
  {
    match_number: 71,
    home_short: "RCB",
    away_short: "GT",
    venue: "Himachal Pradesh Cricket Association Stadium, Dharamsala",
    start_time: "2026-05-26T14:00:00Z",
    cricapi_match_id: "69665",
    label: "Qualifier 1",
  },
  {
    match_number: 72,
    home_short: "SRH",
    away_short: "RR",
    venue: "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur",
    start_time: "2026-05-27T14:00:00Z",
    cricapi_match_id: "69666",
    label: "Eliminator",
  },
  {
    match_number: 73,
    home_short: "RR",
    away_short: "GT",
    venue: "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur",
    start_time: "2026-05-29T14:00:00Z",
    cricapi_match_id: "69667",
    label: "Qualifier 2",
  },
]

async function main() {
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, short_name")
  if (teamsErr || !teams) throw teamsErr ?? new Error("no teams")
  const teamId = new Map(teams.map((t) => [t.short_name, t.id]))

  for (const k of KNOCKOUTS) {
    const home = teamId.get(k.home_short)
    const away = teamId.get(k.away_short)
    if (!home || !away) {
      console.error(`! cannot map ${k.home_short} or ${k.away_short}`)
      continue
    }

    const { data: existing } = await supabase
      .from("matches")
      .select("id, match_number")
      .eq("match_number", k.match_number)
      .maybeSingle()

    if (existing) {
      console.log(`= M${k.match_number} already exists (id=${existing.id}) — skipping`)
      continue
    }

    const row = {
      match_number: k.match_number,
      team_home_id: home,
      team_away_id: away,
      venue: k.venue,
      start_time: k.start_time,
      status: "upcoming" as const,
      cricapi_match_id: k.cricapi_match_id,
    }

    if (DRY_RUN) {
      console.log(`+ [DRY] M${k.match_number} (${k.label}) ${k.home_short} vs ${k.away_short} @ ${k.start_time}`)
      console.log(`       venue=${k.venue}`)
      continue
    }

    const { error } = await supabase.from("matches").insert(row)
    if (error) {
      console.error(`! M${k.match_number} insert failed:`, error)
      continue
    }
    console.log(`+ M${k.match_number} (${k.label}) ${k.home_short} vs ${k.away_short} @ ${k.start_time} — inserted`)
  }

  console.log(`\nFinal (M74) skipped — Q2 winner TBC. Re-run after Q2 to insert.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

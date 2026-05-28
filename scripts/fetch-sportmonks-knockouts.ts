/**
 * Fetch all IPL 2026 fixtures from SportMonks and surface knockout matches
 * (Qualifier 1, Eliminator, Qualifier 2, Final) that aren't yet in our DB.
 *
 * Usage: npx tsx scripts/fetch-sportmonks-knockouts.ts
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
    const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
    process.env[key.trim()] = unquoted
  }
}

const TOKEN = process.env.SPORTMONKS_TOKEN!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const IPL_SEASON_ID = 1795

async function main() {
  // 1. Fetch season fixtures with team info
  const url = `https://cricket.sportmonks.com/api/v2.0/seasons/${IPL_SEASON_ID}?api_token=${TOKEN}&include=fixtures.localteam,fixtures.visitorteam`
  const res = await fetch(url)
  if (!res.ok) {
    console.error("[SportMonks] season fetch failed:", res.status, await res.text())
    process.exit(1)
  }
  const json = await res.json()
  const fixtures = json.data?.fixtures ?? []
  console.log(`Total fixtures: ${fixtures.length}`)

  // 2. Show full round distribution
  const rounds = new Map<string, number>()
  for (const f of fixtures) rounds.set(f.round, (rounds.get(f.round) ?? 0) + 1)
  console.log("\nRound distribution:")
  for (const [r, c] of [...rounds.entries()].sort()) console.log(`  ${r}: ${c}`)

  // 3. Identify knockouts: anything not a plain numeric "Match X" round
  const knockouts = fixtures.filter((f: any) => {
    const r = String(f.round ?? "").toLowerCase()
    return (
      r.includes("qualifier") ||
      r.includes("eliminator") ||
      r.includes("final") ||
      r.includes("playoff")
    )
  })

  console.log(`\nKnockouts found: ${knockouts.length}`)
  for (const f of knockouts) {
    const local = f.localteam?.name ?? f.localteam?.code ?? f.localteam_id
    const visitor = f.visitorteam?.name ?? f.visitorteam?.code ?? f.visitorteam_id
    const venue = f.venue?.name ?? "(venue tbd)"
    console.log(
      `  • [${f.round}] ${local} vs ${visitor} — ${f.starting_at} @ ${venue} — status=${f.status} — fixture_id=${f.id}`
    )
  }

  // 4. Show last 6 league + all upcoming so we can see what's around today
  console.log("\nLast 8 fixtures by starting_at:")
  const sorted = [...fixtures].sort((a: any, b: any) =>
    String(a.starting_at).localeCompare(String(b.starting_at))
  )
  for (const f of sorted.slice(-8)) {
    const local = f.localteam?.code ?? f.localteam?.name ?? f.localteam_id
    const visitor = f.visitorteam?.code ?? f.visitorteam?.name ?? f.visitorteam_id
    console.log(
      `  ${f.starting_at}  [${f.round}]  ${local} vs ${visitor}  status=${f.status}  id=${f.id}`
    )
  }

  // 5. Map to our DB teams + show what we'd insert
  const { data: teams } = await supabase.from("teams").select("id, short_name, name")
  const teamByName = new Map<string, any>()
  for (const t of teams ?? []) {
    teamByName.set(t.name.toLowerCase(), t)
    teamByName.set(t.short_name.toLowerCase(), t)
  }

  console.log("\nMapped to our teams:")
  for (const f of knockouts) {
    const localName = String(f.localteam?.name ?? "").toLowerCase()
    const visitorName = String(f.visitorteam?.name ?? "").toLowerCase()
    const home = teamByName.get(localName)
    const away = teamByName.get(visitorName)
    console.log(
      `  ${f.round}: ${localName} → ${home?.short_name ?? "?"}  |  ${visitorName} → ${away?.short_name ?? "?"}  start=${f.starting_at}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

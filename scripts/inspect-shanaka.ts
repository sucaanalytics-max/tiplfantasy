/**
 * Inspect: find Dasun Shanaka's SportMonks player ID within the RR (team id 7)
 * squad for IPL 2026 (season 1795), and show our DB's current RR roster so we
 * can confirm he's actually missing before inserting.
 *
 * Usage: npx tsx scripts/inspect-shanaka.ts
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

const RR_SM_TEAM_ID = 7
const IPL_SEASON_ID = 1795
const BASE = "https://cricket.sportmonks.com/api/v2.0"

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()

async function main() {
  // 1. SportMonks RR squad for the season
  const url = `${BASE}/teams/${RR_SM_TEAM_ID}/squad/${IPL_SEASON_ID}?api_token=${TOKEN}&include=squad.position`
  const res = await fetch(url)
  if (!res.ok) {
    console.error("[SportMonks] squad fetch failed:", res.status, await res.text())
    process.exit(1)
  }
  const json = await res.json()
  const squad = json.data?.squad ?? []
  console.log(`SportMonks RR squad size: ${squad.length}\n`)

  type Row = { id: number; name: string; position?: string }
  const players: Row[] = squad.map((s: any) => ({
    id: s.id,
    name: s.fullname ?? s.lastname ?? String(s.id),
    position: s.position?.name,
  }))

  for (const p of players.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${p.id}\t${p.name}${p.position ? `  (${p.position})` : ""}`)
  }

  // 2. Find Shanaka
  const matches = players.filter((p) => norm(p.name).includes("shanaka"))
  console.log(`\nShanaka match(es): ${JSON.stringify(matches, null, 2)}`)

  // 3. Our DB RR roster
  const { data: rr } = await supabase
    .from("teams")
    .select("id, short_name")
    .eq("short_name", "RR")
    .single()
  const { data: dbPlayers } = await supabase
    .from("players")
    .select("id, name, role, is_active, cricapi_id")
    .eq("team_id", rr!.id)
    .order("name")

  console.log(`\nDB RR roster (${dbPlayers?.length ?? 0}):`)
  for (const p of dbPlayers ?? []) {
    console.log(`  ${p.name}\t${p.role}\tactive=${p.is_active}\tcricapi_id=${p.cricapi_id}`)
  }
  const dbShanaka = (dbPlayers ?? []).filter((p) => norm(p.name).includes("shanaka"))
  console.log(`\nDB Shanaka match(es): ${JSON.stringify(dbShanaka)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

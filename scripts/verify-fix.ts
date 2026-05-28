// End-to-end verification of the pagination fix.
// 1. Confirms the helper returns all 1390 rows (not the broken 1000).
// 2. Compares per-player aggregates BEFORE vs AFTER pagination across every
//    active player in the system — anyone whose lifetime row count exceeded
//    what landed in the first 1000 rows will show as undercounted.

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import { fetchAllIn } from "../src/lib/supabase/paginated"

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

type ScoreRow = {
  id: string
  player_id: string
  match_id: string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  fantasy_points: number | string
}

async function main() {
  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "completed")
  const matchIds = (matches ?? []).map((m: { id: string }) => m.id)
  console.log(`Completed matches:          ${matchIds.length}`)

  // BROKEN path: single .in()
  const { data: oldRows } = await supabase
    .from("match_player_scores")
    .select("player_id, runs, fantasy_points")
    .in("match_id", matchIds)
  console.log(`OLD .in() row count:        ${oldRows?.length ?? 0}`)

  // FIXED path: paginated
  const newRows = await fetchAllIn<ScoreRow>(
    supabase,
    "match_player_scores",
    "id, player_id, match_id, runs, balls_faced, fours, sixes, fantasy_points",
    "match_id",
    matchIds
  )
  console.log(`NEW fetchAllIn row count:   ${newRows.length}`)

  // For every active player, compare matches/runs/pts before vs after
  type Agg = { matches: number; runs: number; pts: number }
  const oldAgg = new Map<string, Agg>()
  for (const r of (oldRows ?? []) as Array<{ player_id: string; runs: number; fantasy_points: number | string }>) {
    const a = oldAgg.get(r.player_id) ?? { matches: 0, runs: 0, pts: 0 }
    a.matches++; a.runs += r.runs; a.pts += Number(r.fantasy_points)
    oldAgg.set(r.player_id, a)
  }
  const newAgg = new Map<string, Agg>()
  for (const r of newRows) {
    const a = newAgg.get(r.player_id) ?? { matches: 0, runs: 0, pts: 0 }
    a.matches++; a.runs += r.runs; a.pts += Number(r.fantasy_points)
    newAgg.set(r.player_id, a)
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, name, team:teams(short_name)")
    .eq("is_active", true)
  const nameMap = new Map<string, string>()
  for (const p of (players ?? []) as Array<{ id: string; name: string; team: { short_name: string } | null }>) {
    nameMap.set(p.id, `${p.name} (${p.team?.short_name ?? "?"})`)
  }

  // Surface impact: players whose match count changed
  const impacted: Array<{ name: string; old: Agg; new: Agg }> = []
  for (const [pid, newA] of newAgg) {
    const oldA = oldAgg.get(pid) ?? { matches: 0, runs: 0, pts: 0 }
    if (oldA.matches !== newA.matches) {
      impacted.push({ name: nameMap.get(pid) ?? pid, old: oldA, new: newA })
    }
  }
  impacted.sort((a, b) => (b.new.matches - b.old.matches) - (a.new.matches - a.old.matches))

  console.log(`\nPlayers affected by the bug: ${impacted.length} of ${newAgg.size} (${Math.round((impacted.length / Math.max(newAgg.size, 1)) * 100)}%)`)
  console.log(`\nTop 20 worst-affected (matches missing in old):\n`)
  console.table(
    impacted.slice(0, 20).map((i) => ({
      player: i.name,
      "matches old→new": `${i.old.matches}→${i.new.matches}`,
      "runs old→new": `${i.old.runs}→${i.new.runs}`,
      "pts old→new": `${Math.round(i.old.pts)}→${Math.round(i.new.pts)}`,
    }))
  )

  // Dhruv Jurel specifically (the reported case)
  const jurelId = [...nameMap.entries()].find(([, n]) => n.includes("Dhruv Jurel"))?.[0]
  if (jurelId) {
    const oa = oldAgg.get(jurelId) ?? { matches: 0, runs: 0, pts: 0 }
    const na = newAgg.get(jurelId) ?? { matches: 0, runs: 0, pts: 0 }
    console.log(`\nReported case — Dhruv Jurel:`)
    console.log(`  before fix:  ${oa.matches} matches, ${oa.runs} runs, ${Math.round(oa.pts)} pts`)
    console.log(`  after fix:   ${na.matches} matches, ${na.runs} runs, ${Math.round(na.pts)} pts`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Read-only audit: compare match_player_scores rows against the SportMonks
 * fixture API for a curated sample of players, across all completed matches
 * their team has played in the current TIPL season.
 *
 * Writes NOTHING to the database. Only .select() queries + SportMonks fetches.
 *
 * Usage: npx tsx scripts/audit-match-scores.ts
 * Env:   .env.local must define NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPORTMONKS_TOKEN
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import {
  fetchMatchPoints,
  parseScorecardToStats,
  fuzzyMatchName,
  type CricAPIMatchPointsResult,
} from "../src/lib/api/sportmonks"

// ─── Env loading (quote-stripping pattern from sync-missing-careers.ts) ──
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
if (!process.env.SPORTMONKS_TOKEN) {
  console.error("Missing SPORTMONKS_TOKEN in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── Configurable sample ────────────────────────────────────────────────
// Substring (case-insensitive) match against players.name. Comma separates
// alternates so we tolerate variants like "Dhruv Jurel" vs "D Jurel".
const SAMPLE_PLAYERS: string[] = [
  "Dhruv Jurel",
  "Virat Kohli",
  "Jasprit Bumrah",
  "Hardik Pandya",
  "Rishabh Pant",
  "Sanju Samson",
]

const STAT_FIELDS = [
  "runs",
  "balls_faced",
  "fours",
  "sixes",
  "wickets",
  "overs_bowled",
  "runs_conceded",
  "maidens",
  "catches",
  "stumpings",
  "run_outs",
] as const

type StatField = (typeof STAT_FIELDS)[number]

type DbRow = {
  match_id: string
  player_id: string
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number | string
  runs_conceded: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
  fantasy_points: number | string
}

type SmStats = {
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
  maidens: number
  catches: number
  stumpings: number
  run_outs: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Pre-fetch active player roster for fuzzyMatchName ──────────────────
async function loadAllActivePlayers(): Promise<{
  byId: Map<string, { id: string; name: string; team_id: string; role: string }>
  normalizedNameMap: Map<string, string>
}> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, team_id, role")
    .eq("is_active", true)
  if (error) throw error

  const byId = new Map<string, { id: string; name: string; team_id: string; role: string }>()
  const normalizedNameMap = new Map<string, string>()
  for (const p of data ?? []) {
    byId.set(p.id, p)
    const norm = p.name
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
    normalizedNameMap.set(norm, p.id)
  }
  return { byId, normalizedNameMap }
}

// ─── Find players matching sample names ──────────────────────────────────
async function resolveSamplePlayers(names: string[]) {
  const matches: Array<{ id: string; name: string; team_id: string; role: string; team_short: string }> = []
  for (const q of names) {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, team_id, role, team:teams(short_name)")
      .ilike("name", `%${q}%`)
      .eq("is_active", true)
      .limit(2)
    if (error) {
      console.warn(`[resolve] "${q}" → ${error.message}`)
      continue
    }
    if (!data || data.length === 0) {
      console.warn(`[resolve] "${q}" → not found`)
      continue
    }
    if (data.length > 1) {
      console.warn(`[resolve] "${q}" matched multiple: ${data.map((p: { name: string }) => p.name).join(", ")} — using first`)
    }
    const p = data[0] as unknown as { id: string; name: string; team_id: string; role: string; team: { short_name: string } }
    matches.push({ id: p.id, name: p.name, team_id: p.team_id, role: p.role, team_short: p.team.short_name })
  }
  return matches
}

// ─── Fetch completed matches for a team ──────────────────────────────────
async function teamMatches(teamId: string) {
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_number, cricapi_match_id, team_home_id, team_away_id, status, venue, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
    .or(`team_home_id.eq.${teamId},team_away_id.eq.${teamId}`)
    .eq("status", "completed")
    .order("match_number")
  if (error) throw error
  return (data ?? []) as unknown as Array<{
    id: string
    match_number: number
    cricapi_match_id: string | null
    team_home_id: string
    team_away_id: string
    status: string
    venue: string
    team_home: { short_name: string }
    team_away: { short_name: string }
  }>
}

// ─── DB row lookup ───────────────────────────────────────────────────────
async function dbScoreFor(playerId: string, matchId: string): Promise<DbRow | null> {
  const { data, error } = await supabase
    .from("match_player_scores")
    .select("match_id, player_id, runs, balls_faced, fours, sixes, wickets, overs_bowled, runs_conceded, maidens, catches, stumpings, run_outs, fantasy_points")
    .eq("player_id", playerId)
    .eq("match_id", matchId)
    .maybeSingle()
  if (error) {
    console.warn(`[db] mps lookup (${playerId}, ${matchId}) → ${error.message}`)
    return null
  }
  return (data as DbRow) ?? null
}

// ─── SportMonks fixture cache + lookup ───────────────────────────────────
const fixtureCache = new Map<string, CricAPIMatchPointsResult | null>()
let smCalls = 0

async function getFixture(fixtureId: string): Promise<CricAPIMatchPointsResult | null> {
  if (fixtureCache.has(fixtureId)) return fixtureCache.get(fixtureId)!
  smCalls++
  const res = await fetchMatchPoints(fixtureId)
  fixtureCache.set(fixtureId, res)
  await sleep(250)
  return res
}

function smStatsForPlayer(
  fixture: CricAPIMatchPointsResult,
  playerId: string,
  normalizedNameMap: Map<string, string>
): SmStats | null {
  const parsed = parseScorecardToStats(fixture.innings)
  for (const [normName, stats] of parsed.entries()) {
    const matchedId = fuzzyMatchName(normName, normalizedNameMap)
    if (matchedId === playerId) {
      return {
        runs: stats.runs,
        balls_faced: stats.balls_faced,
        fours: stats.fours,
        sixes: stats.sixes,
        wickets: stats.wickets,
        overs_bowled: stats.overs_bowled,
        runs_conceded: stats.runs_conceded,
        maidens: stats.maidens,
        catches: stats.catches,
        stumpings: stats.stumpings,
        run_outs: stats.run_outs,
      }
    }
  }
  return null
}

// ─── Diff comparison ─────────────────────────────────────────────────────
type ClassifyResult =
  | { kind: "OK" }
  | { kind: "STAT_DIFF"; diffs: Array<{ field: StatField; db: number; sm: number }> }
  | { kind: "DROPPED" }
  | { kind: "PHANTOM" }
  | { kind: "NOT_PLAYED" }
  | { kind: "NO_FIXTURE" }

function classify(db: DbRow | null, sm: SmStats | null): ClassifyResult {
  if (!db && !sm) return { kind: "NOT_PLAYED" }
  if (!db && sm) return { kind: "DROPPED" }
  if (db && !sm) return { kind: "PHANTOM" }

  const diffs: Array<{ field: StatField; db: number; sm: number }> = []
  for (const f of STAT_FIELDS) {
    const dbVal = Number(db![f])
    const smVal = sm![f]
    if (f === "overs_bowled") {
      if (Math.abs(dbVal - smVal) > 0.01) diffs.push({ field: f, db: dbVal, sm: smVal })
    } else {
      if (dbVal !== smVal) diffs.push({ field: f, db: dbVal, sm: smVal })
    }
  }
  return diffs.length === 0 ? { kind: "OK" } : { kind: "STAT_DIFF", diffs }
}

function shortDiffs(diffs: Array<{ field: StatField; db: number; sm: number }>) {
  return diffs.map((d) => `${d.field}:${d.db}→${d.sm}`).join(" ")
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log("Audit: match_player_scores vs SportMonks (read-only)\n")
  const t0 = Date.now()

  const { normalizedNameMap } = await loadAllActivePlayers()
  console.log(`Loaded ${normalizedNameMap.size} active players for fuzzy-match lookup\n`)

  const sample = await resolveSamplePlayers(SAMPLE_PLAYERS)
  if (sample.length === 0) {
    console.error("No sample players resolved — aborting.")
    return
  }
  console.log(`Auditing ${sample.length} player(s): ${sample.map((p) => `${p.name} (${p.team_short}/${p.role})`).join(", ")}\n`)

  // Global counters
  const globalCounts: Record<string, number> = {
    OK: 0,
    STAT_DIFF: 0,
    DROPPED: 0,
    PHANTOM: 0,
    NOT_PLAYED: 0,
    NO_FIXTURE: 0,
  }
  const fieldDiffCounts: Record<StatField, number> = {
    runs: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    overs_bowled: 0,
    runs_conceded: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    run_outs: 0,
  }
  const flagged: Array<{ player: string; match: number; status: string; detail: string }> = []

  for (const player of sample) {
    console.log(`━━━ ${player.name} (${player.team_short} ${player.role}) ━━━`)
    const matches = await teamMatches(player.team_id)
    if (matches.length === 0) {
      console.log("  No completed matches found for team.\n")
      continue
    }

    const rows: Array<{ M: string; vs: string; status: string; detail: string }> = []
    for (const m of matches) {
      const opponentShort = m.team_home_id === player.team_id ? m.team_away.short_name : m.team_home.short_name

      const db = await dbScoreFor(player.id, m.id)

      let sm: SmStats | null = null
      let smAvailable = false
      if (m.cricapi_match_id) {
        const fixture = await getFixture(m.cricapi_match_id)
        if (fixture) {
          smAvailable = true
          sm = smStatsForPlayer(fixture, player.id, normalizedNameMap)
        }
      }

      let res: ClassifyResult
      if (!smAvailable) {
        res = { kind: "NO_FIXTURE" }
      } else {
        res = classify(db, sm)
      }

      globalCounts[res.kind]++
      let detail = ""
      if (res.kind === "STAT_DIFF") {
        detail = shortDiffs(res.diffs)
        for (const d of res.diffs) fieldDiffCounts[d.field]++
      } else if (res.kind === "DROPPED" && sm) {
        detail = `sm runs=${sm.runs} 4s=${sm.fours} 6s=${sm.sixes} w=${sm.wickets} ct=${sm.catches}`
      } else if (res.kind === "PHANTOM" && db) {
        detail = `db runs=${db.runs} 4s=${db.fours} 6s=${db.sixes} w=${db.wickets} ct=${db.catches}`
      } else if (res.kind === "NO_FIXTURE") {
        detail = `cricapi_match_id=${m.cricapi_match_id ?? "null"}`
      }

      rows.push({
        M: `M${m.match_number}`,
        vs: opponentShort,
        status: res.kind,
        detail,
      })

      if (res.kind === "STAT_DIFF" || res.kind === "DROPPED" || res.kind === "PHANTOM") {
        flagged.push({ player: player.name, match: m.match_number, status: res.kind, detail })
      }
    }

    console.table(rows)
    console.log("")
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log("━━━━━━━━━━━━━━━━━━━━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`Sample size:   ${sample.length} players × per-team completed matches`)
  console.log(`SM API calls:  ${smCalls} (unique fixtures fetched)`)
  console.log(`Elapsed:       ${elapsed}s\n`)
  console.log("Anomaly counts:")
  for (const [k, v] of Object.entries(globalCounts)) {
    console.log(`  ${k.padEnd(11)} ${v}`)
  }
  console.log("\nField-level diffs (counts of rows where DB ≠ SM):")
  const sortedFields = (Object.entries(fieldDiffCounts) as Array<[StatField, number]>)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  if (sortedFields.length === 0) {
    console.log("  (none)")
  } else {
    for (const [f, v] of sortedFields) {
      console.log(`  ${f.padEnd(15)} ${v}`)
    }
  }
  console.log("\nTop flagged rows (DROPPED / PHANTOM / STAT_DIFF):")
  flagged.slice(0, 15).forEach((f, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. M${f.match.toString().padStart(2)} ${f.player.padEnd(18)} ${f.status.padEnd(10)} ${f.detail}`)
  })
  if (flagged.length > 15) console.log(`  ... and ${flagged.length - 15} more`)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})

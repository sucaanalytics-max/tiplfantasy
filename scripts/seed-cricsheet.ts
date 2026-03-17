/**
 * Cricsheet IPL Data Seed Script
 *
 * Downloads IPL ball-by-ball JSON data from cricsheet.org and populates:
 *   - player_season_stats
 *   - player_venue_stats
 *   - player_vs_team_stats
 *
 * Usage: npx tsx scripts/seed-cricsheet.ts
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import { execFileSync } from "child_process"

// Load env from .env.local
const envPath = path.resolve(__dirname, "../.env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=")
  if (key && !key.startsWith("#")) {
    process.env[key.trim()] = rest.join("=").trim()
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Load player name map (Cricsheet name → our DB name)
const nameMap: Record<string, string> = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "player-name-map.json"), "utf-8")
)

// Cache: our DB player name → UUID
let playerUuidMap: Record<string, string> = {}

// IPL team short names used by Cricsheet → normalized
const TEAM_SHORT: Record<string, string> = {
  "Chennai Super Kings": "CSK",
  "Delhi Capitals": "DC",
  "Delhi Daredevils": "DC",
  "Gujarat Titans": "GT",
  "Kolkata Knight Riders": "KKR",
  "Lucknow Super Giants": "LSG",
  "Mumbai Indians": "MI",
  "Rajasthan Royals": "RR",
  "Royal Challengers Bangalore": "RCB",
  "Royal Challengers Bengaluru": "RCB",
  "Sunrisers Hyderabad": "SRH",
  "Punjab Kings": "PBKS",
  "Kings XI Punjab": "PBKS",
  "Deccan Chargers": "DC_OLD",
  "Kochi Tuskers Kerala": "KTK",
  "Pune Warriors": "PW",
  "Gujarat Lions": "GL",
  "Rising Pune Supergiant": "RPS",
  "Rising Pune Supergiants": "RPS",
}

// ---- Types for aggregation ----

interface BatStats {
  matches: Set<string>
  innings: number
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  highestScore: number
  fifties: number
  hundreds: number
  notOuts: number
}

interface BowlStats {
  ballsBowled: number
  runsConceded: number
  wickets: number
  maidens: number
}

interface FieldStats {
  catches: number
  stumpings: number
  runOuts: number
}

interface PlayerMatchStats {
  bat: BatStats
  bowl: BowlStats
  field: FieldStats
}

function emptyBat(): BatStats {
  return { matches: new Set(), innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, highestScore: 0, fifties: 0, hundreds: 0, notOuts: 0 }
}
function emptyBowl(): BowlStats {
  return { ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 }
}
function emptyField(): FieldStats {
  return { catches: 0, stumpings: 0, runOuts: 0 }
}

// Aggregation maps
const seasonStats = new Map<string, PlayerMatchStats>()
const venueStats = new Map<string, PlayerMatchStats>()
const vsTeamStats = new Map<string, PlayerMatchStats>()

function getKey(parts: string[]): string {
  return parts.join("|")
}

function getOrCreate(map: Map<string, PlayerMatchStats>, key: string): PlayerMatchStats {
  let s = map.get(key)
  if (!s) {
    s = { bat: emptyBat(), bowl: emptyBowl(), field: emptyField() }
    map.set(key, s)
  }
  return s
}

function resolvePlayerName(cricsheetName: string): string | null {
  if (nameMap[cricsheetName]) return nameMap[cricsheetName]
  if (playerUuidMap[cricsheetName]) return cricsheetName
  return null
}

// ---- Cricsheet JSON types ----
interface CricsheetMatch {
  meta: { data_version: string }
  info: {
    dates: string[]
    venue: string
    teams: string[]
    season: string
    event?: { name: string; match_number?: number }
    outcome?: { winner?: string }
    players?: Record<string, string[]>
  }
  innings: Array<{
    team: string
    overs: Array<{
      over: number
      deliveries: Array<{
        batter: string
        bowler: string
        non_striker: string
        runs: { batter: number; extras: number; total: number }
        extras?: Record<string, number>
        wickets?: Array<{
          kind: string
          player_out: string
          fielders?: Array<{ name: string }>
        }>
      }>
    }>
  }>
}

function bowlingTeamName(battingTeam: string, teams: string[]): string {
  return teams.indexOf(battingTeam) === 0 ? teams[1] : teams[0]
}

function processMatch(match: CricsheetMatch, matchId: string) {
  const season = parseInt(match.info.season) || new Date(match.info.dates[0]).getFullYear()
  const venue = match.info.venue
  const teams = match.info.teams

  const batterInningsRuns: Record<string, number> = {}
  const batterDismissed: Set<string> = new Set()
  const matchBatters: Set<string> = new Set()

  for (const innings of match.innings) {
    const battingTeam = innings.team
    const bowlingTeam = bowlingTeamName(battingTeam, teams)

    const overRuns: Record<string, Record<number, number>> = {}

    for (const over of innings.overs) {
      for (const delivery of over.deliveries) {
        const batter = resolvePlayerName(delivery.batter)
        const bowler = resolvePlayerName(delivery.bowler)

        const isWide = delivery.extras?.wides ? true : false
        const isNoBall = delivery.extras?.noballs ? true : false
        const batterRuns = delivery.runs.batter
        const totalRuns = delivery.runs.total

        // ---- Batting ----
        if (batter) {
          const keys = [
            [seasonStats, getKey([batter, String(season)])],
            [venueStats, getKey([batter, venue])],
            [vsTeamStats, getKey([batter, TEAM_SHORT[bowlingTeam] || bowlingTeam])],
          ] as [Map<string, PlayerMatchStats>, string][]

          for (const [map, key] of keys) {
            const s = getOrCreate(map, key)
            s.bat.matches.add(matchId)
            s.bat.runs += batterRuns
            if (!isWide) s.bat.ballsFaced += 1
            if (batterRuns === 4 && !delivery.extras?.byes && !delivery.extras?.legbyes) s.bat.fours += 1
            if (batterRuns === 6) s.bat.sixes += 1
          }

          if (!matchBatters.has(delivery.batter)) {
            matchBatters.add(delivery.batter)
            batterInningsRuns[delivery.batter] = 0
          }
          batterInningsRuns[delivery.batter] += batterRuns
        }

        // ---- Bowling ----
        if (bowler) {
          const keys = [
            [seasonStats, getKey([bowler, String(season)])],
            [venueStats, getKey([bowler, venue])],
            [vsTeamStats, getKey([bowler, TEAM_SHORT[battingTeam] || battingTeam])],
          ] as [Map<string, PlayerMatchStats>, string][]

          for (const [map, key] of keys) {
            const s = getOrCreate(map, key)
            s.bat.matches.add(matchId)
            if (!isWide && !isNoBall) s.bowl.ballsBowled += 1
            s.bowl.runsConceded += totalRuns - (delivery.extras?.byes || 0) - (delivery.extras?.legbyes || 0)
          }

          if (!overRuns[delivery.bowler]) overRuns[delivery.bowler] = {}
          if (!overRuns[delivery.bowler][over.over]) overRuns[delivery.bowler][over.over] = 0
          overRuns[delivery.bowler][over.over] += totalRuns
        }

        // ---- Wickets ----
        if (delivery.wickets) {
          for (const wkt of delivery.wickets) {
            batterDismissed.add(wkt.player_out)

            if (bowler && !["run out", "retired hurt", "retired out", "obstructing the field"].includes(wkt.kind)) {
              const keys = [
                [seasonStats, getKey([bowler, String(season)])],
                [venueStats, getKey([bowler, venue])],
                [vsTeamStats, getKey([bowler, TEAM_SHORT[battingTeam] || battingTeam])],
              ] as [Map<string, PlayerMatchStats>, string][]
              for (const [map, key] of keys) {
                getOrCreate(map, key).bowl.wickets += 1
              }
            }

            if (wkt.fielders) {
              for (const fielder of wkt.fielders) {
                const fName = resolvePlayerName(fielder.name)
                if (!fName) continue
                const keys = [
                  [seasonStats, getKey([fName, String(season)])],
                  [venueStats, getKey([fName, venue])],
                  [vsTeamStats, getKey([fName, TEAM_SHORT[battingTeam] || battingTeam])],
                ] as [Map<string, PlayerMatchStats>, string][]
                for (const [map, key] of keys) {
                  const s = getOrCreate(map, key)
                  if (wkt.kind === "caught") s.field.catches += 1
                  if (wkt.kind === "stumped") s.field.stumpings += 1
                  if (wkt.kind === "run out") s.field.runOuts += 1
                }
              }
            }
          }
        }
      }
    }

    // Maiden detection
    for (const [bowlerName, overs] of Object.entries(overRuns)) {
      const resolved = resolvePlayerName(bowlerName)
      if (!resolved) continue
      for (const [, runs] of Object.entries(overs)) {
        if (runs === 0) {
          const keys = [
            [seasonStats, getKey([resolved, String(season)])],
            [venueStats, getKey([resolved, venue])],
            [vsTeamStats, getKey([resolved, TEAM_SHORT[battingTeam] || battingTeam])],
          ] as [Map<string, PlayerMatchStats>, string][]
          for (const [map, key] of keys) {
            getOrCreate(map, key).bowl.maidens += 1
          }
        }
      }
    }
  }

  // Post-match: innings-level stats
  for (const [cricName, runs] of Object.entries(batterInningsRuns)) {
    const playerName = resolvePlayerName(cricName)
    if (!playerName) continue
    const isNotOut = !batterDismissed.has(cricName)

    // Find batter's team
    let batterTeam = ""
    outer: for (const innings of match.innings) {
      for (const over of innings.overs) {
        for (const d of over.deliveries) {
          if (d.batter === cricName) { batterTeam = innings.team; break outer }
        }
      }
    }
    const opponent = bowlingTeamName(batterTeam, teams)

    const keys = [
      [seasonStats, getKey([playerName, String(season)])],
      [venueStats, getKey([playerName, venue])],
      [vsTeamStats, getKey([playerName, TEAM_SHORT[opponent] || opponent])],
    ] as [Map<string, PlayerMatchStats>, string][]

    for (const [map, key] of keys) {
      const s = getOrCreate(map, key)
      s.bat.innings += 1
      if (isNotOut) s.bat.notOuts += 1
      if (runs >= 100) s.bat.hundreds += 1
      else if (runs >= 50) s.bat.fifties += 1
      if (runs > s.bat.highestScore) s.bat.highestScore = runs
    }
  }
}

async function loadPlayerUuids() {
  const { data, error } = await supabase.from("players").select("id, name")
  if (error) throw error
  for (const p of data || []) {
    playerUuidMap[p.name] = p.id
  }
  console.log(`Loaded ${Object.keys(playerUuidMap).length} players from DB`)
}

async function downloadAndExtract(): Promise<string> {
  const tmpDir = path.resolve(__dirname, "../.cricsheet-tmp")
  const zipPath = path.join(tmpDir, "ipl_json.zip")
  const extractDir = path.join(tmpDir, "matches")

  if (fs.existsSync(extractDir) && fs.readdirSync(extractDir).length > 100) {
    console.log(`Using cached Cricsheet data (${fs.readdirSync(extractDir).length} files)`)
    return extractDir
  }

  fs.mkdirSync(tmpDir, { recursive: true })
  fs.mkdirSync(extractDir, { recursive: true })

  console.log("Downloading cricsheet.org/downloads/ipl_json.zip ...")
  execFileSync("curl", ["-sL", "-o", zipPath, "https://cricsheet.org/downloads/ipl_json.zip"])
  console.log("Extracting...")
  execFileSync("unzip", ["-o", "-q", zipPath, "-d", extractDir])

  const files = fs.readdirSync(extractDir).filter((f) => f.endsWith(".json"))
  console.log(`Extracted ${files.length} match files`)
  return extractDir
}

async function processAllMatches(matchDir: string) {
  const files = fs.readdirSync(matchDir).filter((f) => f.endsWith(".json"))
  let processed = 0
  let skipped = 0

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(matchDir, file), "utf-8")
      const match: CricsheetMatch = JSON.parse(content)

      if (!match.info.event?.name?.includes("Indian Premier League") &&
          !match.info.event?.name?.includes("IPL")) {
        skipped++
        continue
      }

      processMatch(match, file)
      processed++

      if (processed % 100 === 0) console.log(`  Processed ${processed} matches...`)
    } catch {
      skipped++
    }
  }

  console.log(`Processed ${processed} matches, skipped ${skipped}`)
}

async function upsertStats() {
  console.log("\nUpserting season stats...")
  let seasonRows = 0
  const seasonBatch: Array<Record<string, unknown>> = []

  for (const [key, stats] of seasonStats) {
    const [playerName, seasonStr] = key.split("|")
    const uuid = playerUuidMap[playerName]
    if (!uuid) continue

    const oversBowled = Math.floor(stats.bowl.ballsBowled / 6) + (stats.bowl.ballsBowled % 6) / 10

    seasonBatch.push({
      player_id: uuid,
      season: parseInt(seasonStr),
      matches: stats.bat.matches.size,
      innings: stats.bat.innings,
      runs: stats.bat.runs,
      balls_faced: stats.bat.ballsFaced,
      fours: stats.bat.fours,
      sixes: stats.bat.sixes,
      highest_score: stats.bat.highestScore,
      fifties: stats.bat.fifties,
      hundreds: stats.bat.hundreds,
      not_outs: stats.bat.notOuts,
      overs_bowled: oversBowled,
      runs_conceded: stats.bowl.runsConceded,
      wickets: stats.bowl.wickets,
      maidens: stats.bowl.maidens,
      catches: stats.field.catches,
      stumpings: stats.field.stumpings,
      run_outs: stats.field.runOuts,
    })
    seasonRows++
  }

  for (let i = 0; i < seasonBatch.length; i += 500) {
    const chunk = seasonBatch.slice(i, i + 500)
    const { error } = await supabase.from("player_season_stats").upsert(chunk, { onConflict: "player_id,season" })
    if (error) console.error("Season upsert error:", error.message)
  }
  console.log(`  Upserted ${seasonRows} season stat rows`)

  console.log("Upserting venue stats...")
  let venueRows = 0
  const venueBatch: Array<Record<string, unknown>> = []

  for (const [key, stats] of venueStats) {
    const parts = key.split("|")
    const playerName = parts[0]
    const venue = parts.slice(1).join("|") // venue may contain |
    const uuid = playerUuidMap[playerName]
    if (!uuid) continue

    const oversBowled = Math.floor(stats.bowl.ballsBowled / 6) + (stats.bowl.ballsBowled % 6) / 10

    venueBatch.push({
      player_id: uuid,
      venue,
      matches: stats.bat.matches.size,
      runs: stats.bat.runs,
      balls_faced: stats.bat.ballsFaced,
      wickets: stats.bowl.wickets,
      overs_bowled: oversBowled,
      runs_conceded: stats.bowl.runsConceded,
    })
    venueRows++
  }

  for (let i = 0; i < venueBatch.length; i += 500) {
    const chunk = venueBatch.slice(i, i + 500)
    const { error } = await supabase.from("player_venue_stats").upsert(chunk, { onConflict: "player_id,venue" })
    if (error) console.error("Venue upsert error:", error.message)
  }
  console.log(`  Upserted ${venueRows} venue stat rows`)

  console.log("Upserting vs-team stats...")
  let vsRows = 0
  const vsBatch: Array<Record<string, unknown>> = []

  for (const [key, stats] of vsTeamStats) {
    const [playerName, opponent] = key.split("|")
    const uuid = playerUuidMap[playerName]
    if (!uuid) continue

    const oversBowled = Math.floor(stats.bowl.ballsBowled / 6) + (stats.bowl.ballsBowled % 6) / 10

    vsBatch.push({
      player_id: uuid,
      opponent_team: opponent,
      matches: stats.bat.matches.size,
      runs: stats.bat.runs,
      balls_faced: stats.bat.ballsFaced,
      wickets: stats.bowl.wickets,
      overs_bowled: oversBowled,
      runs_conceded: stats.bowl.runsConceded,
    })
    vsRows++
  }

  for (let i = 0; i < vsBatch.length; i += 500) {
    const chunk = vsBatch.slice(i, i + 500)
    const { error } = await supabase.from("player_vs_team_stats").upsert(chunk, { onConflict: "player_id,opponent_team" })
    if (error) console.error("Vs-team upsert error:", error.message)
  }
  console.log(`  Upserted ${vsRows} vs-team stat rows`)
}

async function main() {
  console.log("=== Cricsheet IPL Data Seed ===\n")

  await loadPlayerUuids()
  const matchDir = await downloadAndExtract()
  await processAllMatches(matchDir)
  await upsertStats()

  console.log("\nDone!")
}

main().catch(console.error)

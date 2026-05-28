/**
 * Compute IPL 2026 league-stage standings from the matches table.
 *
 * Usage: npx tsx scripts/compute-standings.ts
 * Env:   .env.local must define NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// ─── Env loading (quote-stripping pattern) ──────────────────────────────
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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

type TeamInfo = { id: string; short_name: string; name: string }
type MatchRow = {
  id: string
  match_number: number | null
  status: string
  start_time: string
  team_home_id: string
  team_away_id: string
  result_summary: string | null
  team_home: { short_name: string; name: string } | null
  team_away: { short_name: string; name: string } | null
}

type Standing = {
  team_id: string
  short_name: string
  name: string
  played: number
  won: number
  lost: number
  nr: number
  points: number
}

type ParseResult =
  | { kind: "winner"; winner_team_id: string }
  | { kind: "no_result" }
  | { kind: "tie" }
  | { kind: "unparsed" }

function parseResult(
  summary: string | null,
  status: string,
  home: TeamInfo,
  away: TeamInfo,
): ParseResult {
  // Status-based: abandoned == no result (1 pt each)
  if (status === "abandoned") return { kind: "no_result" }

  if (!summary || !summary.trim()) {
    // Completed match with no summary recorded — treat as unparsed so it shows up
    return { kind: "unparsed" }
  }
  const s = summary.toLowerCase().trim()

  // No-result / abandoned wording
  if (
    s.includes("no result") ||
    s.includes("abandoned") ||
    s.includes("match abandoned") ||
    s.includes("called off")
  ) {
    return { kind: "no_result" }
  }

  // Tie without "won" clause — super-over results say "{Team} won the super over"
  if (/\btied\b/.test(s) && !/\bwon\b/.test(s)) {
    return { kind: "tie" }
  }

  // Build per-team candidate needles (full name + short name)
  const candidates: Array<{ id: string; needles: string[] }> = [
    {
      id: home.id,
      needles: [home.name.toLowerCase(), home.short_name.toLowerCase()],
    },
    {
      id: away.id,
      needles: [away.name.toLowerCase(), away.short_name.toLowerCase()],
    },
  ]

  // Case A: "{Team} won [by ...|the super over]"
  for (const c of candidates) {
    for (const needle of c.needles) {
      if (!needle) continue
      const re = new RegExp(`\\b${escapeRegex(needle)}\\b[^.]*\\bwon\\b`, "i")
      if (re.test(summary)) {
        return { kind: "winner", winner_team_id: c.id }
      }
    }
  }

  // Case B: prefix-before-"won by" matches a team
  const wonByIdx = s.indexOf("won by")
  const wonSuperIdx = s.indexOf("won the super over")
  const wonIdx = wonByIdx >= 0 ? wonByIdx : wonSuperIdx
  if (wonIdx > 0) {
    const prefix = s.slice(0, wonIdx)
    for (const c of candidates) {
      for (const needle of c.needles) {
        if (needle && prefix.includes(needle)) {
          return { kind: "winner", winner_team_id: c.id }
        }
      }
    }
  }

  // Case C: result_summary is literally just the winning team's full or short name
  // (e.g. "Gujarat Titans" or "PBKS")
  for (const c of candidates) {
    for (const needle of c.needles) {
      if (!needle) continue
      if (s === needle) return { kind: "winner", winner_team_id: c.id }
    }
  }

  return { kind: "unparsed" }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function main() {
  // ─── 1. Load teams ────────────────────────────────────────────────────
  const { data: teamsData, error: teamsErr } = await supabase
    .from("teams")
    .select("id, short_name, name")
  if (teamsErr) {
    console.error("Failed to load teams:", teamsErr.message)
    process.exit(1)
  }
  const teams = (teamsData ?? []) as TeamInfo[]
  const teamById = new Map<string, TeamInfo>()
  for (const t of teams) teamById.set(t.id, t)

  // ─── 2. Load all completed matches ────────────────────────────────────
  const { data: matchesData, error: matchesErr } = await supabase
    .from("matches")
    .select(
      "id, match_number, status, start_time, team_home_id, team_away_id, result_summary, " +
        "team_home:teams!matches_team_home_id_fkey(short_name, name), " +
        "team_away:teams!matches_team_away_id_fkey(short_name, name)",
    )
    .in("status", ["completed", "abandoned"])
    .order("match_number", { ascending: true })
  if (matchesErr) {
    console.error("Failed to load matches:", matchesErr.message)
    process.exit(1)
  }
  const matches = (matchesData ?? []) as unknown as MatchRow[]

  const completedCount = matches.filter((m) => m.status === "completed").length
  const abandonedCount = matches.filter((m) => m.status === "abandoned").length
  console.log(
    `Loaded ${teams.length} teams, ${matches.length} matches ` +
      `(${completedCount} completed, ${abandonedCount} abandoned)\n`,
  )

  // ─── 3. Initialise standings ──────────────────────────────────────────
  const standings = new Map<string, Standing>()
  for (const t of teams) {
    standings.set(t.id, {
      team_id: t.id,
      short_name: t.short_name,
      name: t.name,
      played: 0,
      won: 0,
      lost: 0,
      nr: 0,
      points: 0,
    })
  }

  // ─── 4. Walk completed matches ────────────────────────────────────────
  const unparsed: Array<{ match_number: number | null; matchup: string; summary: string | null }> = []

  for (const m of matches) {
    const home = teamById.get(m.team_home_id)
    const away = teamById.get(m.team_away_id)
    if (!home || !away) {
      console.warn(`[skip] match ${m.match_number}: missing team mapping`)
      continue
    }
    const matchup = `${home.short_name} v ${away.short_name}`
    const r = parseResult(m.result_summary, m.status, home, away)

    if (r.kind === "unparsed") {
      unparsed.push({
        match_number: m.match_number,
        matchup,
        summary: m.result_summary,
      })
      continue
    }

    const h = standings.get(home.id)!
    const a = standings.get(away.id)!
    h.played += 1
    a.played += 1

    if (r.kind === "no_result" || r.kind === "tie") {
      h.nr += 1
      a.nr += 1
      h.points += 1
      a.points += 1
    } else if (r.kind === "winner") {
      if (r.winner_team_id === home.id) {
        h.won += 1
        h.points += 2
        a.lost += 1
      } else {
        a.won += 1
        a.points += 2
        h.lost += 1
      }
    }
  }

  // ─── 5. Sort standings ────────────────────────────────────────────────
  const sorted = [...standings.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    const xPct = x.played ? x.won / x.played : 0
    const yPct = y.played ? y.won / y.played : 0
    return yPct - xPct
  })

  // ─── 6. Detect tie groups (same points) — flag for NRR ────────────────
  const tieGroups: Standing[][] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && sorted[j].points === sorted[i].points) j++
    if (j - i > 1) tieGroups.push(sorted.slice(i, j))
    i = j
  }

  // ─── 7. Output ────────────────────────────────────────────────────────
  console.log("━━━ Full standings (Pts desc, Win% tiebreaker) ━━━")
  console.table(
    sorted.map((s, idx) => ({
      pos: idx + 1,
      team: s.short_name,
      P: s.played,
      W: s.won,
      L: s.lost,
      NR: s.nr,
      Pts: s.points,
      "Win%": s.played ? ((s.won / s.played) * 100).toFixed(1) : "0.0",
      name: s.name,
    })),
  )
  console.log("")

  console.log("━━━ Top 4 (league-stage qualifiers) ━━━")
  for (let k = 0; k < Math.min(4, sorted.length); k++) {
    const s = sorted[k]
    console.log(
      `  ${k + 1}. ${s.short_name.padEnd(4)} — ${s.points} pts (${s.won}W ${s.lost}L ${s.nr}NR, P${s.played})  ${s.name}`,
    )
  }
  console.log("")

  if (tieGroups.length) {
    console.log("⚠️  Teams tied on points — NRR needed to confirm true order:")
    for (const grp of tieGroups) {
      const labels = grp.map((g) => `${g.short_name}(${g.points})`).join(", ")
      console.log(`  - ${grp[0].points} pts: ${labels}`)
    }
    console.log("")
  } else {
    console.log("(No teams tied on points — Win% tiebreaker not actually invoked.)\n")
  }

  console.log("━━━ Result parsing diagnostics ━━━")
  console.log(`  Parsed:   ${matches.length - unparsed.length} / ${matches.length}`)
  console.log(`  Unparsed: ${unparsed.length}`)
  if (unparsed.length) {
    console.log("  Match numbers + summaries that failed to parse:")
    for (const u of unparsed) {
      console.log(`    #${u.match_number ?? "?"}  ${u.matchup}  ::  ${JSON.stringify(u.summary)}`)
    }
  }

  // ─── 8. Sanity: total team-matches should be 2 * matches counted ──────
  const counted = matches.length - unparsed.length
  const totalAppearances = sorted.reduce((acc, s) => acc + s.played, 0)
  const totalPoints = sorted.reduce((acc, s) => acc + s.points, 0)
  console.log("")
  console.log(
    `Sanity: counted matches=${counted}, sum(played)=${totalAppearances} (expect ${counted * 2}), ` +
      `sum(points)=${totalPoints} (expect ${counted * 2} when no NR/tie, less when present)`,
  )
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})

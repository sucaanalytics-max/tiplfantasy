/**
 * Read-only inspection of the matches table for IPL 2026 knockout planning.
 *
 * Usage: npx tsx scripts/inspect-matches.ts
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

type MatchRow = {
  id: string
  match_number: number | null
  status: string
  start_time: string
  venue: string | null
  cricapi_match_id: string | null
  result_summary: string | null
  team_home: { short_name: string } | null
  team_away: { short_name: string } | null
}

const SELECT_COLS =
  "id, match_number, status, start_time, venue, cricapi_match_id, result_summary, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)"

function fmtIST(iso: string): string {
  // Render in IST for human readability
  const d = new Date(iso)
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function row(m: MatchRow) {
  return {
    "#": m.match_number ?? "—",
    matchup: `${m.team_home?.short_name ?? "?"} v ${m.team_away?.short_name ?? "?"}`,
    start_IST: fmtIST(m.start_time),
    status: m.status,
    venue: (m.venue ?? "").slice(0, 32),
    cricapi: m.cricapi_match_id ? `${m.cricapi_match_id.slice(0, 8)}…` : "—",
    result: (m.result_summary ?? "").slice(0, 38),
  }
}

async function main() {
  // ─── 1. Max match_number ──────────────────────────────────────────────
  const { data: maxRow, error: maxErr } = await supabase
    .from("matches")
    .select("match_number")
    .order("match_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (maxErr) console.warn(`[max] ${maxErr.message}`)
  console.log("━━━ 1. Max match_number ━━━")
  console.log(`  ${maxRow?.match_number ?? "(none)"}\n`)

  // ─── 2. Upcoming OR start_time >= 2026-05-20 ─────────────────────────
  const { data: upcoming, error: upErr } = await supabase
    .from("matches")
    .select(SELECT_COLS)
    .or("status.eq.upcoming,start_time.gte.2026-05-20T00:00:00+05:30")
    .order("start_time", { ascending: true })
  if (upErr) console.warn(`[upcoming] ${upErr.message}`)
  console.log("━━━ 2. Upcoming or start_time >= 2026-05-20 IST ━━━")
  console.log(`  ${upcoming?.length ?? 0} rows`)
  if (upcoming?.length) console.table((upcoming as unknown as MatchRow[]).map(row))
  console.log("")

  // ─── 3. Last 5 completed ─────────────────────────────────────────────
  const { data: completed, error: cErr } = await supabase
    .from("matches")
    .select(SELECT_COLS)
    .eq("status", "completed")
    .order("start_time", { ascending: false })
    .limit(5)
  if (cErr) console.warn(`[completed] ${cErr.message}`)
  console.log("━━━ 3. Last 5 completed (most recent first) ━━━")
  if (completed?.length) console.table((completed as unknown as MatchRow[]).map(row))
  console.log("")

  // ─── 4. Today (2026-05-26 IST) ───────────────────────────────────────
  // 2026-05-26 00:00 IST  = 2026-05-25 18:30 UTC
  // 2026-05-27 00:00 IST  = 2026-05-26 18:30 UTC
  const { data: today, error: tErr } = await supabase
    .from("matches")
    .select("*, team_home:teams!matches_team_home_id_fkey(short_name, name), team_away:teams!matches_team_away_id_fkey(short_name, name)")
    .gte("start_time", "2026-05-25T18:30:00+00:00")
    .lt("start_time", "2026-05-26T18:30:00+00:00")
    .order("start_time", { ascending: true })
  if (tErr) console.warn(`[today] ${tErr.message}`)
  console.log("━━━ 4. Today (2026-05-26 IST window) — all fields ━━━")
  if (!today?.length) {
    console.log("  (no matches in window)")
  } else {
    for (const m of today as unknown as Array<Record<string, unknown> & {
      team_home: { short_name: string; name: string } | null
      team_away: { short_name: string; name: string } | null
      start_time: string
    }>) {
      console.log(`  ${m.team_home?.short_name ?? "?"} vs ${m.team_away?.short_name ?? "?"}  (${fmtIST(m.start_time)} IST)`)
      for (const [k, v] of Object.entries(m)) {
        if (k === "team_home" || k === "team_away") continue
        console.log(`    ${k.padEnd(22)} ${JSON.stringify(v)}`)
      }
      console.log("")
    }
  }
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})

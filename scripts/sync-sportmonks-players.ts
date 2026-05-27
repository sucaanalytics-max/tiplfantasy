/**
 * Sync SportMonks IPL 2026 squad data onto our EXISTING players.
 *
 * Scope (confirmed with product owner): enrich existing players + flag SM-only
 * extras. NO inserts, NO deletes — SportMonks rosters are partially stale and
 * our DB holds the curated 2026 squads.
 *
 * Matching is id-first: SportMonks player id lives in players.cricapi_id
 * (migration 041 / live-score route). The handful of DB players missing an id
 * are resolved by surname within their team and the id is backfilled.
 *
 * Writes (gaps only, never overwrites good data):
 *   - cricapi_id      : backfill SportMonks id where missing
 *   - bowling_style   : set 'pace'/'spin' where null/'unknown'
 *   - image_url       : set where null (skips SM placeholders)
 *   - date_of_birth   : set where null            (requires migration 042)
 *   - batting_style   : set where null            (requires migration 042)
 *
 * Usage:
 *   npx tsx scripts/sync-sportmonks-players.ts            # dry-run (default)
 *   npx tsx scripts/sync-sportmonks-players.ts --apply    # write to DB
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const envPath = path.resolve(__dirname, "../.env.local")
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=")
  if (k && !k.startsWith("#"))
    process.env[k.trim()] = rest.join("=").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
}

const TOKEN = process.env.SPORTMONKS_TOKEN!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SPORTMONKS_TOKEN / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const APPLY = process.argv.includes("--apply")
const SEASON_ID = 1795
const TEAM_MAP: Record<number, string> = {
  2: "CSK", 3: "DC", 4: "PBKS", 5: "KKR", 6: "MI",
  7: "RR", 8: "RCB", 9: "SRH", 1976: "GT", 1979: "LSG",
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type SmPlayer = {
  id: number
  fullname: string
  image_path: string | null
  dateofbirth: string | null
  battingstyle: string | null
  bowlingstyle: string | null
  position: string | null
  smTeamId: number
  shortName: string
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
const surname = (s: string) => {
  const t = norm(s).split(" ")
  return t[t.length - 1] || ""
}

// SportMonks raw bowlingstyle -> our 'pace' | 'spin' (or null if unclassifiable)
function mapBowling(sm: string | null): "pace" | "spin" | null {
  if (!sm) return null
  const s = sm.toLowerCase()
  if (s.includes("fast") || s.includes("medium") || s.includes("seam")) return "pace"
  if (
    s.includes("break") || s.includes("orthodox") || s.includes("chinaman") ||
    s.includes("googly") || s.includes("wrist") || s.includes("spin") || s.includes("slow")
  )
    return "spin"
  return null
}

function isPlaceholder(url: string | null): boolean {
  return !url || /placeholder|no[-_]?image|default/i.test(url)
}

async function fetchSquad(smTeamId: number, shortName: string): Promise<SmPlayer[]> {
  const url = `https://cricket.sportmonks.com/api/v2.0/teams/${smTeamId}/squad/${SEASON_ID}?api_token=${TOKEN}&include=squad`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${shortName} squad fetch failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const squad: any[] = json.data?.squad ?? []
  return squad.map((p) => ({
    id: p.id,
    fullname: p.fullname ?? `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim(),
    image_path: p.image_path ?? null,
    dateofbirth: p.dateofbirth ?? null,
    battingstyle: p.battingstyle ?? null,
    bowlingstyle: p.bowlingstyle ?? null,
    position: p.position?.name ?? null,
    smTeamId,
    shortName,
  }))
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}\n`)

  // Detect whether migration 042 columns exist.
  let bioCols = true
  {
    const probe = await supabase.from("players").select("id, date_of_birth, batting_style").limit(1)
    if (probe.error) {
      bioCols = false
      console.log(`! date_of_birth/batting_style columns not present yet — skipping those fields.`)
      console.log(`  (apply migration 042_player_sportmonks_bio.sql, then re-run)\n`)
    }
  }

  const { data: teams, error: te } = await supabase.from("teams").select("id, short_name")
  if (te) throw te
  const teamByShort = new Map(teams!.map((t) => [t.short_name, t.id as string]))

  const baseCols = "id, name, team_id, role, cricapi_id, bowling_style, image_url"
  const { data: players, error: pe } = await supabase
    .from("players")
    .select(bioCols ? `${baseCols}, date_of_birth, batting_style` : baseCols)
  if (pe) throw pe

  const dbById = new Map<string, any>() // cricapi_id -> db player
  const dbNoId: any[] = []
  for (const p of players as any[]) {
    if (p.cricapi_id) dbById.set(String(p.cricapi_id), p)
    else dbNoId.push(p)
  }
  console.log(`DB players: ${players!.length} (with id: ${dbById.size}, without id: ${dbNoId.length})`)

  // Fetch all SM squads.
  const sm: SmPlayer[] = []
  for (const [tid, short] of Object.entries(TEAM_MAP)) {
    sm.push(...(await fetchSquad(Number(tid), short)))
    await sleep(250)
  }
  const smById = new Map<number, SmPlayer>(sm.map((p) => [p.id, p]))
  console.log(`SportMonks squad players: ${sm.length}\n`)

  // --- Resolve the DB players that lack a cricapi_id, by surname within team ---
  const backfills: Array<{ db: any; sm: SmPlayer }> = []
  const unresolvedDb: any[] = []
  const usedSmIds = new Set<number>(dbById.keys() ? [...dbById.keys()].map(Number) : [])
  for (const p of dbNoId) {
    const teamShort = [...teamByShort.entries()].find(([, id]) => id === p.team_id)?.[0]
    const sn = surname(p.name)
    const cands = sm.filter(
      (s) => s.shortName === teamShort && surname(s.fullname) === sn && !usedSmIds.has(s.id)
    )
    if (cands.length === 1) {
      backfills.push({ db: p, sm: cands[0] })
      usedSmIds.add(cands[0].id)
    } else {
      unresolvedDb.push({ p, teamShort, sn, cands: cands.map((c) => c.fullname) })
    }
  }

  // --- Build the set of matched DB players (id match + surname backfill) ---
  type Match = { db: any; sm: SmPlayer }
  const matches: Match[] = []
  for (const [cid, dbp] of dbById.entries()) {
    const s = smById.get(Number(cid))
    if (s) matches.push({ db: dbp, sm: s })
  }
  for (const b of backfills) matches.push({ db: b.db, sm: b.sm })

  // --- SM-only extras: SM players not matched to any DB player ---
  const matchedSmIds = new Set<number>(matches.map((m) => m.sm.id))
  const extras = sm.filter((s) => !matchedSmIds.has(s.id))

  // --- Compute enrichment updates (gaps only) ---
  let nBowl = 0, nImg = 0, nDob = 0, nBat = 0
  const updates: Array<{ id: string; patch: Record<string, any>; name: string }> = []
  for (const m of matches) {
    const patch: Record<string, any> = {}
    const bowl = mapBowling(m.sm.bowlingstyle)
    if (bowl && (!m.db.bowling_style || m.db.bowling_style === "unknown")) {
      patch.bowling_style = bowl
      nBowl++
    }
    if (!m.db.image_url && !isPlaceholder(m.sm.image_path)) {
      patch.image_url = m.sm.image_path
      nImg++
    }
    if (bioCols) {
      if (!m.db.date_of_birth && m.sm.dateofbirth) {
        patch.date_of_birth = m.sm.dateofbirth
        nDob++
      }
      if (!m.db.batting_style && m.sm.battingstyle) {
        patch.batting_style = m.sm.battingstyle
        nBat++
      }
    }
    if (Object.keys(patch).length) updates.push({ id: m.db.id, patch, name: m.db.name })
  }

  // ---------- REPORT ----------
  console.log(`Matched DB players: ${matches.length}`)
  console.log(`\ncricapi_id backfills (${backfills.length}):`)
  for (const b of backfills)
    console.log(`  + ${b.db.name} [${b.sm.shortName}]  ->  SM ${b.sm.id} (${b.sm.fullname})`)
  if (unresolvedDb.length) {
    console.log(`\nDB players still WITHOUT an id, unresolved (${unresolvedDb.length}) — review manually:`)
    for (const u of unresolvedDb)
      console.log(`  ? ${u.p.name} [${u.teamShort}] surname='${u.sn}' candidates=${JSON.stringify(u.cands)}`)
  }

  console.log(`\nEnrichment (gaps only): bowling_style=${nBowl}, image_url=${nImg}, date_of_birth=${nDob}, batting_style=${nBat}`)
  console.log(`Rows to update: ${updates.length}`)
  for (const u of updates.slice(0, 40))
    console.log(`  ~ ${u.name}: ${JSON.stringify(u.patch)}`)
  if (updates.length > 40) console.log(`  ... and ${updates.length - 40} more`)

  console.log(`\nSM-only extras (NOT inserted, flag for review) (${extras.length}):`)
  for (const e of extras)
    console.log(`  ! [${e.shortName}] ${e.fullname} (SM ${e.id}, pos=${e.position})`)

  // ---------- WRITE ----------
  if (!APPLY) {
    console.log(`\nDRY-RUN complete. Re-run with --apply to write.`)
    return
  }

  console.log(`\nApplying...`)
  let ok = 0, fail = 0
  // Backfill ids
  for (const b of backfills) {
    const { error } = await supabase.from("players").update({ cricapi_id: String(b.sm.id) }).eq("id", b.db.id)
    if (error) { console.error(`  cricapi_id backfill failed for ${b.db.name}: ${error.message}`); fail++ }
    else ok++
  }
  // Enrichment
  for (const u of updates) {
    const { error } = await supabase.from("players").update(u.patch).eq("id", u.id)
    if (error) { console.error(`  update failed for ${u.name}: ${error.message}`); fail++ }
    else ok++
  }
  console.log(`Done. writes ok=${ok}, failed=${fail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

// Usage: npx tsx scripts/sync-missing-careers.ts

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Load env from .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const invokeEdgeFunction = async (
  fnName: string,
  playerId: string
): Promise<{ ok: boolean; msg: string }> => {
  const url = `${supabaseUrl}/functions/v1/${fnName}`
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ player_id: playerId }),
    })
  } catch (e) {
    return { ok: false, msg: `fetch error: ${(e as Error).message}` }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false, msg: `HTTP ${res.status}: ${text.slice(0, 120)}` }
  }

  const json = await res.json().catch(() => ({}))
  // The function returns { synced, results } — check the inner result status
  const results: { name: string; status: string }[] = json.results ?? []
  const first = results[0]
  if (!first) return { ok: true, msg: "ok (no result row)" }
  if (first.status === "ok") return { ok: true, msg: "ok" }
  if (first.status === "no_ipl_data") return { ok: false, msg: "no_ipl_data (scraped page had no match count)" }
  return { ok: false, msg: first.status }
}

const main = async () => {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, cricinfo_id, howstat_id")
    .eq("is_active", true)
    .is("ipl_matches", null)
    .or("cricinfo_id.not.is.null,howstat_id.not.is.null")

  if (error) {
    console.error("Query failed:", error.message)
    process.exit(1)
  }

  if (!players || players.length === 0) {
    console.log("No players with missing ipl_matches found — nothing to do.")
    return
  }

  const total = players.length
  let succeeded = 0
  let failed = 0

  console.log(`Found ${total} player(s) with missing ipl_matches. Starting sync...\n`)

  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const fnName = p.cricinfo_id != null ? "sync-cricinfo-stats" : "sync-player-stats"
    const label = `[${i + 1}/${total}] ${p.name} via ${fnName}`

    const { ok, msg } = await invokeEdgeFunction(fnName, p.id)

    if (ok) {
      succeeded++
      console.log(`${label} → ok`)
    } else {
      failed++
      console.log(`${label} → error: ${msg}`)
    }

    // Extra courtesy delay on top of each function's internal throttle
    if (i < players.length - 1) {
      await sleep(500)
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Processed : ${total}`)
  console.log(`Succeeded : ${succeeded}`)
  console.log(`Failed    : ${failed}`)
  console.log(`\nVerification SQL (should return 0 after full success):`)
  console.log(
    `  SELECT COUNT(*) FROM players WHERE is_active = true AND ipl_matches IS NULL AND (cricinfo_id IS NOT NULL OR howstat_id IS NOT NULL);`
  )
}

main().catch((e) => {
  console.error("Unexpected error:", e)
  process.exit(1)
})

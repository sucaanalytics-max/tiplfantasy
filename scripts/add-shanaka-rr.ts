/**
 * Add Dasun Shanaka to the RR squad. He was in the SportMonks RR squad
 * (season 1795, player id 178, Allrounder) but missing from our DB roster.
 *
 * Sets cricapi_id='178' (SportMonks player id) so live-score matching keys
 * off the id directly instead of falling back to fuzzy name matching.
 *
 * Idempotent: re-running is a no-op if he already exists for RR.
 *
 * Usage: npx tsx scripts/add-shanaka-rr.ts [--dry-run]
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

const NAME = "Dasun Shanaka"
const ROLE = "AR"
const SPORTMONKS_ID = "178"

async function main() {
  const { data: rr, error: teamErr } = await supabase
    .from("teams")
    .select("id")
    .eq("short_name", "RR")
    .single()
  if (teamErr || !rr) throw teamErr ?? new Error("RR team not found")

  const { data: existing } = await supabase
    .from("players")
    .select("id, name, role, cricapi_id")
    .eq("team_id", rr.id)
    .eq("name", NAME)
    .maybeSingle()

  if (existing) {
    console.log(`Already present: ${JSON.stringify(existing)} — nothing to do.`)
    return
  }

  // Mirror an existing RR AR's credit_cost so he fits the team's value scale.
  const { data: peerAr } = await supabase
    .from("players")
    .select("credit_cost")
    .eq("team_id", rr.id)
    .eq("role", ROLE)
    .order("credit_cost", { ascending: false })
    .limit(1)
    .maybeSingle()
  const creditCost = peerAr?.credit_cost ?? 7.5

  const row = {
    name: NAME,
    team_id: rr.id,
    role: ROLE,
    is_active: true,
    cricapi_id: SPORTMONKS_ID,
    credit_cost: creditCost,
  }

  if (DRY_RUN) {
    console.log("[dry-run] would insert:", JSON.stringify(row, null, 2))
    return
  }

  const { data: inserted, error: insErr } = await supabase
    .from("players")
    .insert(row)
    .select("id, name, team_id, role, is_active, cricapi_id, credit_cost")
    .single()
  if (insErr) throw insErr

  console.log("Inserted:", JSON.stringify(inserted, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

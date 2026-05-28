// Read-only: verify paginated .range() can fetch all 1390 rows.

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

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

async function main() {
  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "completed")
    .order("match_number")
  const ids = (matches ?? []).map((m: { id: string }) => m.id)

  // Paginated fetch
  const all: Array<{ player_id: string; id: string }> = []
  const batchSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("match_player_scores")
      .select("id, player_id")
      .in("match_id", ids)
      .order("id")
      .range(from, from + batchSize - 1)
    if (error) {
      console.error("error:", error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as Array<{ player_id: string; id: string }>))
    console.log(`  batch ${from}-${from + batchSize - 1}: ${data.length} rows (total so far: ${all.length})`)
    if (data.length < batchSize) break
    from += batchSize
  }
  console.log(`\nTotal rows fetched via pagination: ${all.length}`)

  const { data: jurel } = await supabase
    .from("players")
    .select("id, name")
    .ilike("name", "%Dhruv Jurel%")
    .maybeSingle()
  if (jurel) {
    const jurelRows = all.filter((r) => r.player_id === jurel.id).length
    console.log(`${jurel.name}: ${jurelRows} rows`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

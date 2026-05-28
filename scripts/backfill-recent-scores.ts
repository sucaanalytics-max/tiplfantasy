// Usage: npx tsx scripts/backfill-recent-scores.ts

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

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

const BATCH_SIZE = 50

async function backfillRecentScores() {
  console.log("Fetching distinct player IDs with completed match scores...")

  // Get all distinct player_ids who have scores in completed matches
  const { data: rows, error: fetchErr } = await supabase
    .from("match_player_scores")
    .select("player_id, matches!inner(status)")
    .eq("matches.status", "completed")

  if (fetchErr || !rows) {
    console.error("Failed to fetch player IDs:", fetchErr)
    process.exit(1)
  }

  const playerIds = [...new Set(rows.map((r: { player_id: string }) => r.player_id))]
  console.log(`Total players with completed-match scores: ${playerIds.length}`)

  let updatedCount = 0
  const batches = Math.ceil(playerIds.length / BATCH_SIZE)

  for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
    const batch = playerIds.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`Processing batch ${batchNum}/${batches} (${batch.length} players)...`)

    await Promise.all(
      batch.map(async (pid) => {
        const { data: last5, error: scoreErr } = await supabase
          .from("match_player_scores")
          .select("fantasy_points, matches!inner(match_number, status)")
          .eq("player_id", pid)
          .eq("matches.status", "completed")
          .order("matches(match_number)", { ascending: false })
          .limit(5)

        if (scoreErr || !last5 || last5.length === 0) {
          if (scoreErr) console.warn(`  Skipping ${pid}: ${scoreErr.message}`)
          return
        }

        // Reverse so array is chronological (oldest → newest) for the bar chart
        const chronological = [...last5].reverse().map(
          (r: { fantasy_points: number | string }) => Math.round(Number(r.fantasy_points))
        )

        const { error: updateErr } = await supabase
          .from("players")
          .update({ ipl_recent_scores: chronological })
          .eq("id", pid)

        if (updateErr) {
          console.warn(`  Failed to update ${pid}: ${updateErr.message}`)
        } else {
          updatedCount++
        }
      })
    )

    console.log(`  Batch ${batchNum} done. Running total updated: ${updatedCount}`)
  }

  console.log(`\nBackfill complete. Updated ${updatedCount}/${playerIds.length} players.`)
}

backfillRecentScores().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})

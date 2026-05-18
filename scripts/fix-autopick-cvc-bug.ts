// Usage: npx tsx scripts/fix-autopick-cvc-bug.ts
//
// Rescores the 4 matches affected by the auto-pick C/VC bug (Sidd K matches
// 54 & 62; DJ Large Cap matches 39 & 56). Mirrors recalculateUserMatchScores
// in src/actions/scoring.ts but runs outside Next.js so it can be invoked
// from a local shell with the service-role key.
//
// The `selections.is_auto_pick=false` flip has already been applied via SQL.
// This script only rebuilds user_match_scores + refreshes the leaderboard.

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const envPath = path.resolve(__dirname, "../.env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=")
  if (key && !key.startsWith("#")) {
    process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "")
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const AFFECTED_MATCH_IDS = [
  "1e1cce7e-afdc-4d88-a80a-4350d17aa1eb", // match 39
  "aeed688e-983f-4ecc-8026-2873270c04f0", // match 54
  "480605a5-aa8c-40e9-b06f-24e1a041f397", // match 56
  "7680d062-ee06-4051-bf02-4d7eb56d64b5", // match 62
]

type Selection = {
  id: string
  user_id: string
  captain_id: string | null
  vice_captain_id: string | null
  is_auto_pick: boolean
}

function calculateUserMatchScore(
  sel: Selection,
  playerIds: string[],
  playerScores: Map<string, number>
) {
  let total = 0
  let captainPoints = 0
  let vcPoints = 0

  const hasManualCvc = sel.captain_id != null || sel.vice_captain_id != null
  const applyCvc = !sel.is_auto_pick || hasManualCvc

  for (const pid of playerIds) {
    const base = playerScores.get(pid) ?? 0
    let multiplier = 1
    if (applyCvc) {
      if (pid === sel.captain_id) {
        multiplier = 2
        captainPoints = base
      } else if (pid === sel.vice_captain_id) {
        multiplier = 1.5
        vcPoints = base * 0.5
      }
    }
    total += base * multiplier
  }

  return {
    total: Math.round(total),
    captainPoints: Math.round(captainPoints),
    vcPoints: Math.round(vcPoints),
  }
}

async function rescore(matchId: string) {
  const { data: playerScores, error: psErr } = await supabase
    .from("match_player_scores")
    .select("player_id, fantasy_points")
    .eq("match_id", matchId)

  if (psErr || !playerScores || playerScores.length === 0) {
    console.warn(`  ${matchId}: no player scores (${psErr?.message ?? "empty"})`)
    return
  }

  const scoreMap = new Map(
    playerScores.map((s) => [s.player_id, Number(s.fantasy_points)])
  )

  const { data: selections, error: selErr } = await supabase
    .from("selections")
    .select("id, user_id, captain_id, vice_captain_id, is_auto_pick")
    .eq("match_id", matchId)

  if (selErr || !selections || selections.length === 0) {
    console.warn(`  ${matchId}: no selections (${selErr?.message ?? "empty"})`)
    return
  }

  const { data: selPlayers, error: spErr } = await supabase
    .from("selection_players")
    .select("selection_id, player_id")
    .in("selection_id", selections.map((s) => s.id))

  if (spErr || !selPlayers) {
    console.warn(`  ${matchId}: selection_players failed (${spErr?.message})`)
    return
  }

  const playersBySelection = new Map<string, string[]>()
  for (const sp of selPlayers) {
    const arr = playersBySelection.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    playersBySelection.set(sp.selection_id, arr)
  }

  const userScores = selections.map((sel) => {
    const result = calculateUserMatchScore(
      sel as Selection,
      playersBySelection.get(sel.id) ?? [],
      scoreMap
    )
    return { userId: sel.user_id, ...result, rank: 0 }
  })

  userScores.sort((a, b) => b.total - a.total)
  let currentRank = 1
  for (let i = 0; i < userScores.length; i++) {
    if (i > 0 && userScores[i].total < userScores[i - 1].total) currentRank = i + 1
    userScores[i].rank = currentRank
  }

  const rows = userScores.map((s) => ({
    user_id: s.userId,
    match_id: matchId,
    total_points: s.total,
    rank: s.rank,
    captain_points: s.captainPoints,
    vc_points: s.vcPoints,
  }))

  const { error: upsertErr } = await supabase
    .from("user_match_scores")
    .upsert(rows, { onConflict: "user_id,match_id" })

  if (upsertErr) {
    console.error(`  ${matchId}: upsert failed: ${upsertErr.message}`)
    return
  }

  console.log(`  ${matchId}: rescored ${rows.length} users`)
}

async function main() {
  console.log(`Rescoring ${AFFECTED_MATCH_IDS.length} matches...`)
  for (const id of AFFECTED_MATCH_IDS) {
    await rescore(id)
  }

  console.log("Refreshing leaderboard...")
  const { error } = await supabase.rpc("refresh_leaderboard")
  if (error) console.error("  refresh_leaderboard failed:", error.message)
  else console.log("  refresh_leaderboard ok")

  console.log("Done.")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})

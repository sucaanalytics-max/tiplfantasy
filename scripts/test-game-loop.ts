/**
 * TIPL Fantasy — End-to-End Game Loop Test
 *
 * Tests the full flow: users → selections → lock → auto-pick → scoring → leaderboard → WhatsApp
 *
 * Run with: npx tsx scripts/test-game-loop.ts
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Scoring rules seeded in DB
 *   - Teams and players seeded (RCB + SRH squads)
 *   - Match #1 exists (RCB vs SRH)
 */

import { createClient } from "@supabase/supabase-js"
import { calculatePlayerPoints, calculateUserMatchScore } from "../src/lib/scoring"
import type { ScoringRule } from "../src/lib/types"
import { formatMatchMessage } from "../src/lib/whatsapp"

// Load env
import { config } from "dotenv"
config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================
// Test data
// ============================================================

const TEST_USERS = [
  { email: "alice@test.tipl", name: "Alice Manager" },
  { email: "bob@test.tipl", name: "Bob Tactician" },
  { email: "carol@test.tipl", name: "Carol Strategy" },
  { email: "dave@test.tipl", name: "Dave Lurker" },      // no selection → auto-pick
  { email: "eve@test.tipl", name: "Eve Absentee" },       // no selection → auto-pick
]

// Fake scorecard: RCB vs SRH, Match #1
// We'll use real player names from the DB
const SCORECARD: Record<string, {
  runs: number; balls_faced: number; fours: number; sixes: number
  wickets: number; overs_bowled: number; runs_conceded: number; maidens: number
  catches: number; stumpings: number; run_outs: number
}> = {
  // RCB batting
  "Virat Kohli":        { runs: 73, balls_faced: 40, fours: 6, sixes: 4, wickets: 0, overs_bowled: 0, runs_conceded: 0, maidens: 0, catches: 1, stumpings: 0, run_outs: 0 },
  "Rajat Patidar":      { runs: 42, balls_faced: 30, fours: 4, sixes: 2, wickets: 0, overs_bowled: 0, runs_conceded: 0, maidens: 0, catches: 0, stumpings: 0, run_outs: 0 },
  "Liam Livingstone":   { runs: 28, balls_faced: 18, fours: 2, sixes: 2, wickets: 1, overs_bowled: 2, runs_conceded: 14, maidens: 0, catches: 0, stumpings: 0, run_outs: 0 },
  "Jitesh Sharma":      { runs: 15, balls_faced: 10, fours: 1, sixes: 1, wickets: 0, overs_bowled: 0, runs_conceded: 0, maidens: 0, catches: 2, stumpings: 1, run_outs: 0 },
  "Krunal Pandya":      { runs: 8,  balls_faced: 6,  fours: 1, sixes: 0, wickets: 0, overs_bowled: 4, runs_conceded: 28, maidens: 0, catches: 1, stumpings: 0, run_outs: 0 },
  "Bhuvneshwar Kumar":  { runs: 2,  balls_faced: 4,  fours: 0, sixes: 0, wickets: 2, overs_bowled: 4, runs_conceded: 22, maidens: 0, catches: 0, stumpings: 0, run_outs: 0 },
  "Josh Hazlewood":     { runs: 0,  balls_faced: 1,  fours: 0, sixes: 0, wickets: 3, overs_bowled: 4, runs_conceded: 18, maidens: 1, catches: 1, stumpings: 0, run_outs: 0 },
  "Yash Dayal":         { runs: 0,  balls_faced: 0,  fours: 0, sixes: 0, wickets: 1, overs_bowled: 4, runs_conceded: 32, maidens: 0, catches: 0, stumpings: 0, run_outs: 0 },

  // SRH batting
  "Travis Head":        { runs: 89, balls_faced: 48, fours: 8, sixes: 5, wickets: 0, overs_bowled: 0, runs_conceded: 0, maidens: 0, catches: 0, stumpings: 0, run_outs: 0 },
  "Heinrich Klaasen":   { runs: 0,  balls_faced: 5,  fours: 0, sixes: 0, wickets: 0, overs_bowled: 0, runs_conceded: 0, maidens: 0, catches: 1, stumpings: 2, run_outs: 0 },
  "Pat Cummins":        { runs: 12, balls_faced: 8,  fours: 1, sixes: 0, wickets: 3, overs_bowled: 4, runs_conceded: 24, maidens: 0, catches: 0, stumpings: 0, run_outs: 1 },
}

// ============================================================
// Helpers
// ============================================================

function log(section: string, msg: string) {
  console.log(`\n[${ section.toUpperCase() }] ${msg}`)
}

function logTable(label: string, rows: Record<string, unknown>[]) {
  console.log(`\n  ${label}:`)
  console.table(rows)
}

// ============================================================
// Main test
// ============================================================

async function main() {
  console.log("=".repeat(70))
  console.log("  TIPL FANTASY — END-TO-END GAME LOOP TEST")
  console.log("=".repeat(70))

  // ── Step 0: Load scoring rules ──────────────────────────────
  log("setup", "Loading scoring rules from DB...")
  const { data: rulesData, error: rulesErr } = await admin
    .from("scoring_rules")
    .select("*")
    .eq("is_active", true)

  if (rulesErr || !rulesData?.length) {
    console.error("No scoring rules found! Run the seed migration first.")
    console.error(rulesErr)
    process.exit(1)
  }

  const rules = rulesData as ScoringRule[]
  log("setup", `Loaded ${rules.length} scoring rules`)
  const ruleMap = new Map(rules.map((r) => [r.name, r.points]))
  console.log("  Rule points:", Object.fromEntries(ruleMap))

  // ── Step 1: Find Match #1 (RCB vs SRH) ─────────────────────
  log("match", "Finding Match #1...")
  const { data: match } = await admin
    .from("matches")
    .select("id, match_number, team_home_id, team_away_id, status, venue")
    .eq("match_number", 1)
    .single()

  if (!match) {
    console.error("Match #1 not found! Seed matches first.")
    process.exit(1)
  }
  log("match", `Found Match #1 (id=${match.id}), status=${match.status}`)

  // Ensure match is upcoming for test
  await admin.from("matches").update({ status: "upcoming" }).eq("id", match.id)
  log("match", "Reset match status to 'upcoming'")

  // ── Step 2: Load players by name ────────────────────────────
  log("players", "Loading players for both teams...")
  const { data: allPlayers } = await admin
    .from("players")
    .select("id, name, role, team_id")
    .in("team_id", [match.team_home_id, match.team_away_id])
    .eq("is_active", true)

  if (!allPlayers?.length) {
    console.error("No players found for match teams!")
    process.exit(1)
  }

  const playerByName = new Map(allPlayers.map((p) => [p.name, p]))
  const playerById = new Map(allPlayers.map((p) => [p.id, p]))
  log("players", `Loaded ${allPlayers.length} players`)

  // Verify all scorecard names exist
  for (const name of Object.keys(SCORECARD)) {
    if (!playerByName.has(name)) {
      console.error(`Player "${name}" not found in DB! Available: ${allPlayers.map(p => p.name).join(", ")}`)
      process.exit(1)
    }
  }

  // ── Step 3: Create test users ───────────────────────────────
  log("users", "Creating 5 test users...")
  const userIds: string[] = []

  for (const u of TEST_USERS) {
    // Check if user already exists
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("display_name", u.name)
      .single()

    if (existing) {
      userIds.push(existing.id)
      log("users", `  ${u.name} already exists (${existing.id})`)
      continue
    }

    // Create via auth admin API
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: "testpassword123!",
      email_confirm: true,
      user_metadata: { display_name: u.name },
    })

    if (authErr) {
      // If email already exists, find the user
      const { data: { users } } = await admin.auth.admin.listUsers()
      const found = users?.find((au) => au.email === u.email)
      if (found) {
        userIds.push(found.id)
        // Update profile name
        await admin.from("profiles").update({ display_name: u.name }).eq("id", found.id)
        log("users", `  ${u.name} found existing auth user (${found.id})`)
        continue
      }
      console.error(`Failed to create user ${u.email}:`, authErr)
      process.exit(1)
    }

    userIds.push(authUser.user.id)
    // Profile should be auto-created by trigger, update name
    await admin.from("profiles").update({ display_name: u.name }).eq("id", authUser.user.id)
    log("users", `  Created ${u.name} (${authUser.user.id})`)
  }

  const [aliceId, bobId, carolId, daveId, eveId] = userIds

  // ── Step 4: Clean up any existing test data for this match ──
  log("cleanup", "Cleaning up existing test data...")
  await admin.from("user_match_scores").delete().eq("match_id", match.id)
  await admin.from("match_player_scores").delete().eq("match_id", match.id)
  for (const uid of userIds) {
    const { data: sel } = await admin
      .from("selections")
      .select("id")
      .eq("user_id", uid)
      .eq("match_id", match.id)
    for (const s of sel ?? []) {
      await admin.from("selection_players").delete().eq("selection_id", s.id)
    }
    await admin.from("selections").delete().eq("user_id", uid).eq("match_id", match.id)
  }
  log("cleanup", "Done")

  // ── Step 5: Create selections for Alice, Bob, Carol ─────────
  log("selections", "Creating selections for 3 users (leaving Dave + Eve without)...")

  // Pick 11 players from the scorecard names
  const scorecardNames = Object.keys(SCORECARD)
  const scorecardPlayerIds = scorecardNames.map((n) => playerByName.get(n)!.id)

  // Alice: Captain = Kohli, VC = Head
  const kohliId = playerByName.get("Virat Kohli")!.id
  const headId = playerByName.get("Travis Head")!.id
  const cumminsId = playerByName.get("Pat Cummins")!.id
  const hazlewoodId = playerByName.get("Josh Hazlewood")!.id
  const klaasenId = playerByName.get("Heinrich Klaasen")!.id

  async function createSelection(
    userId: string,
    playerIds: string[],
    captainId: string | null,
    vcId: string | null,
    label: string
  ) {
    const { data: sel } = await admin
      .from("selections")
      .insert({
        user_id: userId,
        match_id: match.id,
        captain_id: captainId,
        vice_captain_id: vcId,
        is_auto_pick: false,
        locked_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    await admin.from("selection_players").insert(
      playerIds.map((pid) => ({ selection_id: sel!.id, player_id: pid }))
    )
    log("selections", `  ${label}: C=${captainId ? playerById.get(captainId)?.name : "none"}, VC=${vcId ? playerById.get(vcId)?.name : "none"}`)
  }

  await createSelection(aliceId, scorecardPlayerIds, kohliId, headId, "Alice")
  await createSelection(bobId, scorecardPlayerIds, headId, cumminsId, "Bob")
  await createSelection(carolId, scorecardPlayerIds, hazlewoodId, klaasenId, "Carol")

  log("selections", "Dave and Eve have NO selection (will be auto-picked)")

  // ── Step 6: Lock the match ──────────────────────────────────
  log("lock", "Locking match (status → live)...")
  await admin.from("matches").update({ status: "live", updated_at: new Date().toISOString() }).eq("id", match.id)
  log("lock", "Match is now LIVE")

  // ── Step 7: Simulate auto-pick for Dave and Eve ─────────────
  log("auto-pick", "Simulating auto-pick for Dave and Eve...")

  // Auto-pick: copy most-selected players (all 3 users picked the same 11)
  for (const uid of [daveId, eveId]) {
    const userName = uid === daveId ? "Dave" : "Eve"
    const { data: sel } = await admin
      .from("selections")
      .insert({
        user_id: uid,
        match_id: match.id,
        captain_id: null,        // auto-pick = no captain
        vice_captain_id: null,   // auto-pick = no VC
        is_auto_pick: true,
        locked_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    await admin.from("selection_players").insert(
      scorecardPlayerIds.map((pid) => ({ selection_id: sel!.id, player_id: pid }))
    )
    log("auto-pick", `  ${userName}: auto-picked 11 players (no C/VC multiplier)`)
  }

  // ── Step 8: Calculate player fantasy points ─────────────────
  log("scoring", "Calculating fantasy points per player...")

  const playerPointsMap = new Map<string, number>()
  const playerBreakdowns: Array<{ player: string; pts: number; breakdown: string }> = []

  for (const [name, stats] of Object.entries(SCORECARD)) {
    const { total, breakdown } = calculatePlayerPoints(stats, rules)
    const playerId = playerByName.get(name)!.id
    playerPointsMap.set(playerId, total)
    playerBreakdowns.push({
      player: name,
      pts: total,
      breakdown: Object.entries(breakdown).map(([k, v]) => `${k}=${v}`).join(", "),
    })
  }

  logTable("Player Fantasy Points", playerBreakdowns)

  // Insert into match_player_scores
  const scoreRows = Object.entries(SCORECARD).map(([name, stats]) => {
    const { total, breakdown } = calculatePlayerPoints(stats, rules)
    const playerId = playerByName.get(name)!.id
    return {
      match_id: match.id,
      player_id: playerId,
      ...stats,
      fantasy_points: total,
      breakdown,
    }
  })

  const { error: insertErr } = await admin.from("match_player_scores").insert(scoreRows)
  if (insertErr) {
    console.error("Failed to insert player scores:", insertErr)
    process.exit(1)
  }
  log("scoring", `Saved ${scoreRows.length} player scores to DB`)

  // ── Step 9: Calculate user match scores ─────────────────────
  log("user-scores", "Calculating user match scores with C/VC multipliers...")

  // Load selections from DB
  const { data: selections } = await admin
    .from("selections")
    .select("id, user_id, captain_id, vice_captain_id, is_auto_pick")
    .eq("match_id", match.id)

  const { data: selPlayers } = await admin
    .from("selection_players")
    .select("selection_id, player_id")
    .in("selection_id", (selections ?? []).map((s) => s.id))

  const playersBySelection = new Map<string, string[]>()
  for (const sp of selPlayers ?? []) {
    const arr = playersBySelection.get(sp.selection_id) ?? []
    arr.push(sp.player_id)
    playersBySelection.set(sp.selection_id, arr)
  }

  const userResults: Array<{
    name: string; total: number; captainPts: number; vcPts: number
    isAutoPick: boolean; rank: number
  }> = []

  for (const sel of selections ?? []) {
    const result = calculateUserMatchScore(
      {
        userId: sel.user_id,
        selectionId: sel.id,
        captainId: sel.captain_id,
        viceCaptainId: sel.vice_captain_id,
        isAutoPick: sel.is_auto_pick,
        playerIds: playersBySelection.get(sel.id) ?? [],
      },
      playerPointsMap
    )

    const userName = TEST_USERS.find((u) => userIds[TEST_USERS.indexOf(u)] === sel.user_id)?.name ?? "Unknown"
    userResults.push({
      name: userName,
      total: result.total,
      captainPts: result.captainPoints,
      vcPts: result.vcPoints,
      isAutoPick: sel.is_auto_pick,
      rank: 0,
    })
  }

  // Rank
  userResults.sort((a, b) => b.total - a.total)
  let currentRank = 1
  for (let i = 0; i < userResults.length; i++) {
    if (i > 0 && userResults[i].total < userResults[i - 1].total) currentRank = i + 1
    userResults[i].rank = currentRank
  }

  logTable("User Match Scores", userResults.map((r) => ({
    Rank: r.rank,
    Name: r.name,
    Total: r.total,
    "Captain Bonus": r.captainPts,
    "VC Bonus": r.vcPts,
    "Auto-Pick": r.isAutoPick ? "YES (no multiplier)" : "no",
  })))

  // Save to DB
  await admin.from("user_match_scores").delete().eq("match_id", match.id)
  const userScoreRows = userResults.map((r) => ({
    user_id: userIds[TEST_USERS.findIndex((u) => u.name === r.name)],
    match_id: match.id,
    total_points: r.total,
    rank: r.rank,
    captain_points: r.captainPts,
    vc_points: r.vcPts,
    breakdown: null,
  }))
  await admin.from("user_match_scores").insert(userScoreRows)
  log("user-scores", "Saved user match scores to DB")

  // Update match to completed
  await admin.from("matches").update({ status: "completed" }).eq("id", match.id)

  // ── Step 10: Refresh leaderboard ────────────────────────────
  log("leaderboard", "Refreshing season_leaderboard materialized view...")
  const { error: rpcErr } = await admin.rpc("refresh_leaderboard")
  if (rpcErr) {
    console.error("Failed to refresh leaderboard:", rpcErr)
    // Non-fatal, continue
  }

  const { data: leaderboard } = await admin
    .from("season_leaderboard")
    .select("*")
    .order("season_rank", { ascending: true })

  if (leaderboard?.length) {
    logTable("Season Leaderboard", leaderboard.map((e: Record<string, unknown>) => ({
      Rank: e.season_rank,
      Name: e.display_name,
      Points: e.total_points,
      "Matches Played": e.matches_played,
      "Avg Points": e.avg_points,
    })))
  }

  // ── Step 11: Generate WhatsApp message ──────────────────────
  log("whatsapp", "Generating WhatsApp message...")

  const { data: teams } = await admin
    .from("teams")
    .select("id, short_name")
    .in("id", [match.team_home_id, match.team_away_id])

  const teamMap = new Map(teams?.map((t) => [t.id, t.short_name]) ?? [])
  const matchTitle = `${teamMap.get(match.team_home_id)} vs ${teamMap.get(match.team_away_id)}`

  const whatsappMsg = formatMatchMessage(
    matchTitle,
    1,
    userResults.map((r) => ({
      displayName: r.name,
      totalPoints: r.total,
      rank: r.rank,
    })),
    (leaderboard ?? []).slice(0, 5).map((e: Record<string, unknown>) => ({
      displayName: e.display_name as string,
      totalPoints: e.total_points as number,
    }))
  )

  console.log("\n" + "─".repeat(50))
  console.log("WhatsApp Message Preview:")
  console.log("─".repeat(50))
  console.log(whatsappMsg)
  console.log("─".repeat(50))

  // ── Step 12: Print expected values for verification ─────────
  console.log("\n" + "=".repeat(70))
  console.log("  EXPECTED VALUES FOR MANUAL VERIFICATION")
  console.log("=".repeat(70))

  // Calculate expected points manually
  const r = (name: string) => ruleMap.get(name) ?? 0

  console.log(`
Scoring Rules Used:
  run=${r("run")}, four_bonus=${r("four_bonus")}, six_bonus=${r("six_bonus")}
  thirty=${r("thirty")}, half_century=${r("half_century")}, century=${r("century")}
  duck=${r("duck")}
  sr_above_170=${r("sr_above_170")}, sr_150_170=${r("sr_150_170")}
  sr_below_50=${r("sr_below_50")}, sr_50_60=${r("sr_50_60")}
  wicket=${r("wicket")}, maiden=${r("maiden")}
  three_wicket_haul=${r("three_wicket_haul")}, four_wicket_haul=${r("four_wicket_haul")}, five_wicket_haul=${r("five_wicket_haul")}
  econ_below_5=${r("econ_below_5")}, econ_5_6=${r("econ_5_6")}
  econ_10_12=${r("econ_10_12")}, econ_above_12=${r("econ_above_12")}
  catch=${r("catch")}, stumping=${r("stumping")}, run_out=${r("run_out")}
  three_catch_bonus=${r("three_catch_bonus")}

Player Point Calculations (verify these):

  Kohli: 73 runs off 40 balls (SR 182.5)
    = 73×${r("run")} + 6×${r("four_bonus")} + 4×${r("six_bonus")} + ${r("half_century")}(50) + ${r("sr_above_170")}(SR>170) + 1×${r("catch")}

  Head: 89 runs off 48 balls (SR 185.4)
    = 89×${r("run")} + 8×${r("four_bonus")} + 5×${r("six_bonus")} + ${r("half_century")}(50) + ${r("sr_above_170")}(SR>170)

  Klaasen: 0 off 5 (DUCK, SR 0, but <10 balls = no SR penalty)
    = ${r("duck")}(duck) + 1×${r("catch")} + 2×${r("stumping")}

  Cummins: 12 off 8, 3/24 in 4 overs (econ 6.0), 1 run-out
    = 12×${r("run")} + 1×${r("four_bonus")} + 3×${r("wicket")} + ${r("three_wicket_haul")}(3wh) + ${r("econ_5_6")}(econ≤6) + 1×${r("run_out")}

  Hazlewood: 0 off 1 (duck), 3/18 in 4 overs (econ 4.5), 1 maiden, 1 catch
    = ${r("duck")}(duck) + 3×${r("wicket")} + ${r("three_wicket_haul")}(3wh) + 1×${r("maiden")} + ${r("econ_below_5")}(econ<5) + 1×${r("catch")}

User Score Calculations:
  Alice: C=Kohli(2×), VC=Head(1.5×) — sum of base + extra from multipliers
  Bob:   C=Head(2×), VC=Cummins(1.5×)
  Carol: C=Hazlewood(2×), VC=Klaasen(1.5×)
  Dave:  auto-pick (1× all, no C/VC)
  Eve:   auto-pick (1× all, no C/VC)

  Note: Dave and Eve get the SAME total (both auto-pick, same 11 players, no multipliers)
`)

  console.log("\n✅ Game loop test complete! Check the tables above to verify point calculations.")
  console.log("   The match is now 'completed' and leaderboard is updated.\n")
}

main().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})

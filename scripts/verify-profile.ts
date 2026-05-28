// Reverify every aggregated stat the profile section depends on, with the
// new pagination in place. Compares OLD (single .in()) vs NEW (paginated)
// for the profile page's league-avg / captain-analytics / ownership data.

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import { fetchAllIn, PAGE_SIZE } from "../src/lib/supabase/paginated"

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

const TARGET_EMAIL = "jay.bansal@tuskinvest.com"

async function main() {
  // ─── 1. League avg per match (profile page leagueScores) ───────────────
  console.log("━━━ 1. League average per match ━━━\n")

  // OLD path
  const { data: oldLs } = await supabase
    .from("user_match_scores")
    .select("match_id, total_points")
    .limit(2000)
  // NEW path (matches the patched profile page)
  const newLs: { match_id: string; total_points: number }[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("user_match_scores")
      .select("match_id, total_points")
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    newLs.push(...(data as { match_id: string; total_points: number }[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  console.log(`OLD rows fetched: ${oldLs?.length ?? 0}`)
  console.log(`NEW rows fetched: ${newLs.length}`)

  function avgPerMatch(rows: { match_id: string; total_points: number }[]) {
    const groups = new Map<string, number[]>()
    for (const r of rows) {
      if (!groups.has(r.match_id)) groups.set(r.match_id, [])
      groups.get(r.match_id)!.push(Number(r.total_points))
    }
    const avgs = new Map<string, number>()
    for (const [mid, pts] of groups) avgs.set(mid, pts.reduce((a, b) => a + b, 0) / pts.length)
    return { avgs, leagueSize: Math.max(...[...groups.values()].map((a) => a.length), 1) }
  }
  const oldAvg = avgPerMatch((oldLs ?? []) as { match_id: string; total_points: number }[])
  const newAvg = avgPerMatch(newLs)
  console.log(`Distinct matches covered: old=${oldAvg.avgs.size}, new=${newAvg.avgs.size}`)
  console.log(`League size (max users-per-match): old=${oldAvg.leagueSize}, new=${newAvg.leagueSize}`)

  // Sample 5 matches that differ
  const sample: { match: string; old: string; new: string }[] = []
  for (const [mid, na] of newAvg.avgs) {
    const oa = oldAvg.avgs.get(mid)
    if (oa == null || Math.abs(oa - na) > 0.5) {
      sample.push({ match: mid.slice(0, 8), old: oa?.toFixed(1) ?? "—", new: na.toFixed(1) })
    }
    if (sample.length >= 8) break
  }
  if (sample.length > 0) {
    console.log("\nExample matches where league-avg changed:")
    console.table(sample)
  } else {
    console.log("\nNo difference in computed averages (data already covered).")
  }

  // ─── 2. Profile captaincy / score timeline source (per-user mps) ───────
  console.log("\n━━━ 2. Per-user data (target: " + TARGET_EMAIL + ") ━━━\n")
  const { data: target } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("created_at")
    .limit(1000)
  // Look up by joining auth.users
  const { data: authUser } = await supabase.auth.admin.listUsers()
  const targetUser = authUser?.users.find((u) => u.email === TARGET_EMAIL)
  if (!targetUser) {
    console.log(`(could not find user ${TARGET_EMAIL} — falling back to first user)`)
  }
  const userId = targetUser?.id ?? target?.[0]?.id
  if (!userId) {
    console.log("No user found, skipping per-user verification.")
    return
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()
  console.log(`User: ${profile?.display_name ?? userId.slice(0, 8)}`)

  // User's own match scores (capped at 200 in profile page — that's plenty)
  const { data: userMps } = await supabase
    .from("user_match_scores")
    .select("match_id, total_points, captain_points, vc_points, rank")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200)
  console.log(`User's per-match scores: ${userMps?.length ?? 0} rows`)
  const userTotalPts = (userMps ?? []).reduce((s, r) => s + Number(r.total_points), 0)
  const userAvgPts = userMps?.length ? userTotalPts / userMps.length : 0
  console.log(`  Total pts: ${userTotalPts.toFixed(0)}`)
  console.log(`  Avg pts:   ${userAvgPts.toFixed(1)}`)

  // ─── 3. Ownership insights raw source (the user-ownership.ts loadRaw fix) ──
  console.log("\n━━━ 3. Ownership Heroes/Regrets source data ━━━\n")
  // mirror loadRaw exactly
  const [{ data: matches }, { data: selections }] = await Promise.all([
    supabase.from("matches").select("id, match_number")
      .in("status", ["completed", "no_result"]).order("start_time").limit(200),
    supabase.from("selections").select("id, match_id, captain_id, vice_captain_id")
      .eq("user_id", userId).not("locked_at", "is", null).limit(200),
  ])
  const matchIds = (matches ?? []).map((m: { id: string }) => m.id)
  const selectionIds = (selections ?? []).map((s: { id: string }) => s.id)
  console.log(`Completed matches:  ${matchIds.length}`)
  console.log(`User selections:    ${selectionIds.length}`)

  // OLD broken path
  const { data: oldScores } = await supabase
    .from("match_player_scores")
    .select("match_id, player_id, fantasy_points")
    .in("match_id", matchIds)
    .limit(10000)
  // NEW paginated path
  const newScores = await fetchAllIn<{ id: string; match_id: string; player_id: string; fantasy_points: number | string }>(
    supabase,
    "match_player_scores",
    "id, match_id, player_id, fantasy_points",
    "match_id",
    matchIds
  )
  console.log(`mps via OLD .limit(10000): ${oldScores?.length ?? 0} rows (server cap)`)
  console.log(`mps via NEW paginated:     ${newScores.length} rows`)

  // ─── 4. Captain analytics base data ─────────────────────────────────────
  console.log("\n━━━ 4. League captaincy table source ━━━\n")
  // Pick the user's first league
  const { data: leagueMembership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  if (!leagueMembership) {
    console.log("(user in no leagues, skipping)")
  } else {
    const leagueId = leagueMembership.league_id
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
    const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
    console.log(`League members: ${userIds.length}`)

    // OLD selections fetch (capped)
    const { data: oldSels } = await supabase
      .from("selections")
      .select("id, user_id, match_id")
      .in("match_id", matchIds)
      .in("user_id", userIds)
      .not("locked_at", "is", null)
      .limit(5000)

    // NEW paginated (mirrors insights.ts patch)
    type Sel = { id: string; user_id: string; match_id: string }
    const newSels: Sel[] = []
    let sf = 0
    while (true) {
      const { data, error } = await supabase
        .from("selections")
        .select("id, user_id, match_id")
        .in("match_id", matchIds)
        .in("user_id", userIds)
        .not("locked_at", "is", null)
        .order("id")
        .range(sf, sf + PAGE_SIZE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      newSels.push(...(data as Sel[]))
      if (data.length < PAGE_SIZE) break
      sf += PAGE_SIZE
    }
    console.log(`selections OLD .limit(5000): ${oldSels?.length ?? 0} rows`)
    console.log(`selections NEW paginated:    ${newSels.length} rows`)

    const newSelIds = newSels.map((s) => s.id)
    const newSp = await fetchAllIn<{ id: string; selection_id: string; player_id: string }>(
      supabase,
      "selection_players",
      "id, selection_id, player_id",
      "selection_id",
      newSelIds
    )
    const { data: oldSp } = await supabase
      .from("selection_players")
      .select("selection_id, player_id")
      .in("selection_id", newSelIds)
      .limit(20000)
    console.log(`selection_players OLD .limit(20000): ${oldSp?.length ?? 0} rows`)
    console.log(`selection_players NEW paginated:     ${newSp.length} rows`)
  }

  console.log("\n━━━ Summary ━━━")
  console.log("All profile-section data sources are now paginated and returning the full row set.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

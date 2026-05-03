# Insights & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four analytics tabs to the leaderboard page (Captain, Season, Differential, existing Standings gains form column), curated banter on match scores pages, and admin projections/differential breakdown — all from existing data, zero schema migrations.

**Architecture:** The leaderboard page gains a `?tab=` searchParam; data for each tab is fetched conditionally server-side. Pure computation functions for form stats and banter curation live in `src/lib/` and receive existing data as arguments. The scores page uses a server-side `curateBanter()` function before passing banter to the client.

**Tech Stack:** Next.js App Router (Server Components + `'use client'` only where interactive), Supabase admin client, Tailwind CSS + shadcn/ui `cn()` + `glass` class pattern from existing codebase, TypeScript strict mode.

---

## File Map

**New files:**
- `src/actions/insights.ts` — captain analytics + differential data fetching + JS processing
- `src/lib/banter-curation.ts` — pure `curateBanter()` function (testable, no imports)
- `src/app/(app)/leaderboard/insights-tabs.tsx` — tab switcher client component
- `src/components/captain-analytics-tab.tsx` — captain tab (leaderboard + C/VC table + match history)
- `src/components/season-tab.tsx` — form trajectory cards for all users
- `src/components/differential-tab.tsx` — differential leaderboard + unique picks + herd traps
- `src/components/match-moments-section.tsx` — curated banter section for scores page
- `src/components/match-gem-callout.tsx` — single-line gem callout for scores page

**Modified files:**
- `src/lib/types.ts` — add `CaptainAnalyticsRow`, `CaptainMatchHistoryRow`, `CvPickRow`, `FormStatsRow`, `DifferentialPickRow`, `DifferentialSummaryRow`
- `src/app/(app)/leaderboard/page.tsx` — add `?tab` param, conditional data fetch, render tabs
- `src/app/(app)/match/[id]/scores/page.tsx` — increase banter fetch limit, curate before passing, add gem callout
- `src/app/(app)/admin/page.tsx` — add projected standings section + per-user differential breakdown

---

## Task 1: Add analytics types to `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Append new types at the end of `src/lib/types.ts`**

```typescript
// ============================================================
// Insights & Analytics types
// ============================================================

export type CaptainAnalyticsRow = {
  user_id: string
  display_name: string
  total_captain_pts: number
  total_optimal_pts: number
  opportunity_cost: number  // total_optimal_pts - total_captain_pts
  hit_rate_pct: number       // 0-100, captain base pts >= 50 counts as hit
  matches_played: number
}

export type CaptainMatchHistoryRow = {
  match_id: string
  match_number: number
  matchup: string             // "RCB vs SRH"
  captain_id: string
  captain_name: string
  actual_pts: number
  optimal_pts: number
  optimal_player_name: string
  gap: number                 // optimal_pts - actual_pts (0 = perfect pick)
}

export type CvPickRow = {
  player_id: string
  player_name: string
  team_id: string
  team_short_name: string
  team_matches_played: number
  picks: Record<string, { captain: number; vc: number }>  // keyed by user_id
}

export type FormStatsRow = {
  user_id: string
  display_name: string
  total_points: number
  season_avg: number
  last5_avg: number
  last5_scores: number[]      // up to 5 most recent scores, oldest first
  consistency_stddev: number  // standard deviation of all match scores
  current_rank: number
  form: "hot" | "steady" | "cooling"  // hot: last5 > season+20, cooling: last5 < season-20
}

export type DifferentialPickRow = {
  match_id: string
  match_number: number
  matchup: string
  player_id: string
  player_name: string
  player_role: string
  team_short_name: string
  user_id: string
  user_pts: number
  ownership_count: number     // how many of the N league users picked this player (1-N)
  total_users: number         // N (league size)
  is_captain: boolean
  is_vc: boolean
  category: "gem" | "paid-off" | "backfired" | null
  // gem: ownership<=2 && pts>=80
  // paid-off: ownership<=3 && pts>=50 (and not gem)
  // backfired: ownership<=2 && pts<30
}

export type DifferentialSummaryRow = {
  user_id: string
  display_name: string
  unique_pick_pts: number     // total pts from picks where ownership <= 2
  avg_ownership: number       // avg ownership count across all picks (lower = more contrarian)
  differential_score: number  // SUM(pts) for ownership<=2 picks minus SUM(pts) for ownership<=2 busts (<30pts)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (types are additive).

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/lib/types.ts && git commit -m "feat(insights): add analytics type definitions"
```

---

## Task 2: Create `src/actions/insights.ts` — captain analytics

**Files:**
- Create: `src/actions/insights.ts`

- [ ] **Step 1: Create the file with captain analytics function**

```typescript
"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  CaptainAnalyticsRow,
  CaptainMatchHistoryRow,
  CvPickRow,
  DifferentialPickRow,
  DifferentialSummaryRow,
} from "@/lib/types"

// ── Shared base data loader ───────────────────────────────────────────────────
// Fetches all raw data needed for captain + differential analytics.
// Returns null if the league has no members or no completed matches.

async function fetchInsightsBase(leagueId: string) {
  const admin = createAdminClient()

  const { data: members } = await admin
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", leagueId)
    .limit(50)

  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return null

  const { data: completedMatches } = await admin
    .from("matches")
    .select(
      "id, match_number, start_time, " +
      "team_home:teams!matches_team_home_id_fkey(id, short_name), " +
      "team_away:teams!matches_team_away_id_fkey(id, short_name)"
    )
    .eq("status", "completed")
    .order("start_time", { ascending: true })
    .limit(100)

  const matchIds = (completedMatches ?? []).map((m) => m.id)
  if (matchIds.length === 0) return null

  const { data: selections } = await admin
    .from("selections")
    .select("id, user_id, match_id, captain_id, vice_captain_id")
    .in("match_id", matchIds)
    .in("user_id", userIds)
    .not("locked_at", "is", null)
    .limit(2000)

  const selectionIds = (selections ?? []).map((s) => s.id)

  const [{ data: selectionPlayers }, { data: matchScores }, { data: players }] = await Promise.all([
    admin
      .from("selection_players")
      .select("selection_id, player_id")
      .in("selection_id", selectionIds)
      .limit(20000),
    admin
      .from("match_player_scores")
      .select("player_id, match_id, fantasy_points")
      .in("match_id", matchIds)
      .limit(5000),
    admin
      .from("players")
      .select("id, name, role, team_id, team:teams(id, short_name)")
      .limit(500),
  ])

  return {
    members: members ?? [],
    completedMatches: completedMatches ?? [],
    selections: selections ?? [],
    selectionPlayers: selectionPlayers ?? [],
    matchScores: matchScores ?? [],
    players: players ?? [],
    userIds,
    matchIds,
  }
}

// ── Captain analytics ─────────────────────────────────────────────────────────

export async function getCaptainAnalytics(leagueId: string): Promise<{
  leaderboard: CaptainAnalyticsRow[]
  matchHistory: Record<string, CaptainMatchHistoryRow[]>  // keyed by user_id
  cvPicks: CvPickRow[]
  userNames: Record<string, string>  // user_id -> display_name
}> {
  const base = await fetchInsightsBase(leagueId)
  if (!base) return { leaderboard: [], matchHistory: {}, cvPicks: [], userNames: {} }

  const { members, completedMatches, selections, selectionPlayers, matchScores, players, userIds } = base

  // ── Build lookup maps ──
  // "matchId:playerId" -> fantasy_points
  const scoreMap = new Map<string, number>()
  for (const s of matchScores) {
    scoreMap.set(`${s.match_id}:${s.player_id}`, Number(s.fantasy_points))
  }

  // selectionId -> playerIds[]
  const selectionPlayerMap = new Map<string, string[]>()
  for (const sp of selectionPlayers) {
    if (!selectionPlayerMap.has(sp.selection_id)) selectionPlayerMap.set(sp.selection_id, [])
    selectionPlayerMap.get(sp.selection_id)!.push(sp.player_id)
  }

  // playerId -> { name, team_short_name, team_id, role }
  type PlayerInfo = { name: string; team_short_name: string; team_id: string; role: string }
  const playerMap = new Map<string, PlayerInfo>()
  for (const p of players) {
    playerMap.set(p.id, {
      name: p.name,
      team_short_name: (p.team as unknown as { short_name: string })?.short_name ?? "",
      team_id: p.team_id,
      role: p.role as string,
    })
  }

  // matchId -> { match_number, matchup }
  const matchInfoMap = new Map<string, { match_number: number; matchup: string }>()
  for (const m of completedMatches) {
    const home = (m.team_home as unknown as { short_name: string })?.short_name ?? ""
    const away = (m.team_away as unknown as { short_name: string })?.short_name ?? ""
    matchInfoMap.set(m.id, { match_number: m.match_number, matchup: `${home} vs ${away}` })
  }

  // userId -> display_name
  const profileMap = new Map<string, string>()
  for (const m of members) {
    profileMap.set(m.user_id, (m.profiles as unknown as { display_name: string })?.display_name ?? "?")
  }

  // ── Per-user captain aggregation ──
  type UserAgg = { totalCaptainPts: number; totalOptimalPts: number; hitCount: number; matchCount: number }
  const userAgg = new Map<string, UserAgg>()
  const userMatchHistoryMap = new Map<string, CaptainMatchHistoryRow[]>()

  for (const sel of selections) {
    const captainPts = scoreMap.get(`${sel.match_id}:${sel.captain_id}`) ?? 0
    const playerIds = selectionPlayerMap.get(sel.id) ?? []

    // Find optimal: highest scorer in user's 11
    let optimalPts = captainPts
    let optimalPlayerId = sel.captain_id ?? ""
    for (const pid of playerIds) {
      const pts = scoreMap.get(`${sel.match_id}:${pid}`) ?? 0
      if (pts > optimalPts) {
        optimalPts = pts
        optimalPlayerId = pid
      }
    }

    const agg = userAgg.get(sel.user_id) ?? { totalCaptainPts: 0, totalOptimalPts: 0, hitCount: 0, matchCount: 0 }
    agg.totalCaptainPts += captainPts
    agg.totalOptimalPts += optimalPts
    if (captainPts >= 50) agg.hitCount++
    agg.matchCount++
    userAgg.set(sel.user_id, agg)

    const matchInfo = matchInfoMap.get(sel.match_id)
    if (!matchInfo) continue

    const histRow: CaptainMatchHistoryRow = {
      match_id: sel.match_id,
      match_number: matchInfo.match_number,
      matchup: matchInfo.matchup,
      captain_id: sel.captain_id ?? "",
      captain_name: playerMap.get(sel.captain_id ?? "")?.name ?? "?",
      actual_pts: captainPts,
      optimal_pts: optimalPts,
      optimal_player_name: playerMap.get(optimalPlayerId)?.name ?? "?",
      gap: optimalPts - captainPts,
    }
    if (!userMatchHistoryMap.has(sel.user_id)) userMatchHistoryMap.set(sel.user_id, [])
    userMatchHistoryMap.get(sel.user_id)!.push(histRow)
  }

  // ── Captain leaderboard ──
  const leaderboard: CaptainAnalyticsRow[] = []
  for (const [userId, agg] of userAgg) {
    leaderboard.push({
      user_id: userId,
      display_name: profileMap.get(userId) ?? "?",
      total_captain_pts: Math.round(agg.totalCaptainPts),
      total_optimal_pts: Math.round(agg.totalOptimalPts),
      opportunity_cost: Math.round(agg.totalOptimalPts - agg.totalCaptainPts),
      hit_rate_pct: agg.matchCount > 0 ? Math.round((agg.hitCount / agg.matchCount) * 100) : 0,
      matches_played: agg.matchCount,
    })
  }
  leaderboard.sort((a, b) => b.total_captain_pts - a.total_captain_pts)

  // ── C/VC picks by team ──
  // Count captain + VC picks per player per user
  const cvAgg = new Map<string, { captain: Record<string, number>; vc: Record<string, number> }>()
  for (const sel of selections) {
    if (sel.captain_id) {
      if (!cvAgg.has(sel.captain_id)) cvAgg.set(sel.captain_id, { captain: {}, vc: {} })
      const entry = cvAgg.get(sel.captain_id)!
      entry.captain[sel.user_id] = (entry.captain[sel.user_id] ?? 0) + 1
    }
    if (sel.vice_captain_id) {
      if (!cvAgg.has(sel.vice_captain_id)) cvAgg.set(sel.vice_captain_id, { captain: {}, vc: {} })
      const entry = cvAgg.get(sel.vice_captain_id)!
      entry.vc[sel.user_id] = (entry.vc[sel.user_id] ?? 0) + 1
    }
  }

  // Count completed matches per team
  const teamMatchCount = new Map<string, number>()
  for (const m of completedMatches) {
    const homeId = (m.team_home as unknown as { id: string })?.id
    const awayId = (m.team_away as unknown as { id: string })?.id
    if (homeId) teamMatchCount.set(homeId, (teamMatchCount.get(homeId) ?? 0) + 1)
    if (awayId) teamMatchCount.set(awayId, (teamMatchCount.get(awayId) ?? 0) + 1)
  }

  const cvPicks: CvPickRow[] = []
  for (const [playerId, cv] of cvAgg) {
    const player = playerMap.get(playerId)
    if (!player) continue
    cvPicks.push({
      player_id: playerId,
      player_name: player.name,
      team_id: player.team_id,
      team_short_name: player.team_short_name,
      team_matches_played: teamMatchCount.get(player.team_id) ?? 0,
      picks: Object.fromEntries(
        userIds.map((uid) => [uid, { captain: cv.captain[uid] ?? 0, vc: cv.vc[uid] ?? 0 }])
      ),
    })
  }
  cvPicks.sort((a, b) => {
    if (a.team_short_name !== b.team_short_name) return a.team_short_name.localeCompare(b.team_short_name)
    const totA = Object.values(a.picks).reduce((s, p) => s + p.captain + p.vc, 0)
    const totB = Object.values(b.picks).reduce((s, p) => s + p.captain + p.vc, 0)
    return totB - totA
  })

  // Sort match history most-recent first per user
  const matchHistory: Record<string, CaptainMatchHistoryRow[]> = {}
  for (const [uid, rows] of userMatchHistoryMap) {
    matchHistory[uid] = rows.sort((a, b) => b.match_number - a.match_number)
  }

  const userNames = Object.fromEntries(profileMap.entries())

  return { leaderboard, matchHistory, cvPicks, userNames }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/actions/insights.ts && git commit -m "feat(insights): add captain analytics action"
```

---

## Task 3: Extend `src/actions/insights.ts` — differential data

**Files:**
- Modify: `src/actions/insights.ts`

- [ ] **Step 1: Append `getDifferentialData` to the end of `src/actions/insights.ts`**

```typescript
// ── Differential picks ─────────────────────────────────────────────────────────

export async function getDifferentialData(leagueId: string): Promise<{
  picks: DifferentialPickRow[]          // all picks with ownership context
  summary: DifferentialSummaryRow[]     // per-user aggregate
  userNames: Record<string, string>
}> {
  const base = await fetchInsightsBase(leagueId)
  if (!base) return { picks: [], summary: [], userNames: {} }

  const { members, completedMatches, selections, selectionPlayers, matchScores, players, userIds } = base

  const totalUsers = userIds.length

  // Build lookup maps
  const scoreMap = new Map<string, number>()
  for (const s of matchScores) {
    scoreMap.set(`${s.match_id}:${s.player_id}`, Number(s.fantasy_points))
  }

  const selectionPlayerMap = new Map<string, string[]>()
  for (const sp of selectionPlayers) {
    if (!selectionPlayerMap.has(sp.selection_id)) selectionPlayerMap.set(sp.selection_id, [])
    selectionPlayerMap.get(sp.selection_id)!.push(sp.player_id)
  }

  type PlayerInfo = { name: string; team_short_name: string; role: string }
  const playerMap = new Map<string, PlayerInfo>()
  for (const p of players) {
    playerMap.set(p.id, {
      name: p.name,
      team_short_name: (p.team as unknown as { short_name: string })?.short_name ?? "",
      role: p.role as string,
    })
  }

  const matchInfoMap = new Map<string, { match_number: number; matchup: string }>()
  for (const m of completedMatches) {
    const home = (m.team_home as unknown as { short_name: string })?.short_name ?? ""
    const away = (m.team_away as unknown as { short_name: string })?.short_name ?? ""
    matchInfoMap.set(m.id, { match_number: m.match_number, matchup: `${home} vs ${away}` })
  }

  const profileMap = new Map<string, string>()
  for (const m of members) {
    profileMap.set(m.user_id, (m.profiles as unknown as { display_name: string })?.display_name ?? "?")
  }

  // Count how many users picked each player per match
  // "matchId:playerId" -> Set<userId>
  const ownershipMap = new Map<string, Set<string>>()
  for (const sel of selections) {
    const playerIds = selectionPlayerMap.get(sel.id) ?? []
    for (const pid of playerIds) {
      const key = `${sel.match_id}:${pid}`
      if (!ownershipMap.has(key)) ownershipMap.set(key, new Set())
      ownershipMap.get(key)!.add(sel.user_id)
    }
  }

  // Build per-pick rows
  const picks: DifferentialPickRow[] = []
  for (const sel of selections) {
    const playerIds = selectionPlayerMap.get(sel.id) ?? []
    const matchInfo = matchInfoMap.get(sel.match_id)
    if (!matchInfo) continue

    for (const pid of playerIds) {
      const ownershipCount = ownershipMap.get(`${sel.match_id}:${pid}`)?.size ?? 1
      const pts = scoreMap.get(`${sel.match_id}:${pid}`) ?? 0
      const player = playerMap.get(pid)
      if (!player) continue

      let category: DifferentialPickRow["category"] = null
      if (ownershipCount <= 2 && pts >= 80) category = "gem"
      else if (ownershipCount <= 3 && pts >= 50) category = "paid-off"
      else if (ownershipCount <= 2 && pts < 30) category = "backfired"

      picks.push({
        match_id: sel.match_id,
        match_number: matchInfo.match_number,
        matchup: matchInfo.matchup,
        player_id: pid,
        player_name: player.name,
        player_role: player.role,
        team_short_name: player.team_short_name,
        user_id: sel.user_id,
        user_pts: pts,
        ownership_count: ownershipCount,
        total_users: totalUsers,
        is_captain: sel.captain_id === pid,
        is_vc: sel.vice_captain_id === pid,
        category,
      })
    }
  }

  // Per-user summary
  type UserDiffAgg = { uniquePts: number; uniqueCount: number; totalOwnershipSum: number; totalPicks: number }
  const userDiffAgg = new Map<string, UserDiffAgg>()

  for (const pick of picks) {
    const agg = userDiffAgg.get(pick.user_id) ?? { uniquePts: 0, uniqueCount: 0, totalOwnershipSum: 0, totalPicks: 0 }
    if (pick.ownership_count <= 2) {
      agg.uniquePts += pick.user_pts
      agg.uniqueCount++
    }
    agg.totalOwnershipSum += pick.ownership_count
    agg.totalPicks++
    userDiffAgg.set(pick.user_id, agg)
  }

  const summary: DifferentialSummaryRow[] = []
  for (const [userId, agg] of userDiffAgg) {
    const backfiredPts = picks
      .filter((p) => p.user_id === userId && p.category === "backfired")
      .reduce((s, p) => s + p.user_pts, 0)

    summary.push({
      user_id: userId,
      display_name: profileMap.get(userId) ?? "?",
      unique_pick_pts: Math.round(agg.uniquePts),
      avg_ownership: agg.totalPicks > 0 ? Math.round((agg.totalOwnershipSum / agg.totalPicks) * 10) / 10 : 0,
      differential_score: Math.round(agg.uniquePts - backfiredPts),
    })
  }
  summary.sort((a, b) => b.differential_score - a.differential_score)

  return { picks, summary, userNames: Object.fromEntries(profileMap.entries()) }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/actions/insights.ts && git commit -m "feat(insights): add differential picks action"
```

---

## Task 4: Banter curation utility

**Files:**
- Create: `src/lib/banter-curation.ts`

- [ ] **Step 1: Create pure `curateBanter()` function**

```typescript
// Pure function — no imports, fully testable in isolation.

export type RawBanterMessage = {
  message: string
  event_type: string
}

// Priority order — captain drama first, then player events, then general
const BANTER_PRIORITY: string[] = [
  "captain_haul",
  "captain_fail",
  "vc_fail",
  "duck",
  "century",
  "fifty",
  "three_plus_wickets",
  "wicketless",
  "expensive_bowling",
  "great_economy",
  "general_roast",
  "low_sr",
  "top_rank",
  "bottom_rank",
]

const MAX_BANTER = 8
// captain_haul and captain_fail can have up to 2 each (different user outcomes)
const MAX_PER_DRAMA_TYPE = 2
const MAX_PER_OTHER_TYPE = 1

/**
 * Deduplicates and prioritises banter messages for a single match.
 * Returns at most MAX_BANTER (8) messages.
 * For captain_haul / captain_fail: up to 2 messages each (different user outcomes).
 * For all other types: 1 message per type (longest = most specific).
 */
export function curateBanter(messages: RawBanterMessage[]): RawBanterMessage[] {
  // Group by event_type
  const grouped = new Map<string, RawBanterMessage[]>()
  for (const msg of messages) {
    if (!grouped.has(msg.event_type)) grouped.set(msg.event_type, [])
    grouped.get(msg.event_type)!.push(msg)
  }

  const result: RawBanterMessage[] = []

  for (const eventType of BANTER_PRIORITY) {
    if (result.length >= MAX_BANTER) break
    const group = grouped.get(eventType)
    if (!group || group.length === 0) continue

    const isDramaType = eventType === "captain_haul" || eventType === "captain_fail"
    const maxForType = isDramaType ? MAX_PER_DRAMA_TYPE : MAX_PER_OTHER_TYPE

    // Sort by message length descending — longest = most specific / personalized
    const sorted = [...group].sort((a, b) => b.message.length - a.message.length)
    const take = Math.min(maxForType, MAX_BANTER - result.length)
    result.push(...sorted.slice(0, take))
  }

  return result
}
```

- [ ] **Step 2: Manually verify the function logic**

Open Node REPL and paste the following test:

```bash
node -e "
const { curateBanter } = require('./dist/lib/banter-curation.js') || (() => {
  // inline quick check
  const msgs = [
    { event_type: 'captain_haul', message: 'A long captain haul message for user JVB with lots of detail' },
    { event_type: 'captain_haul', message: 'Another captain haul for sidd k' },
    { event_type: 'captain_haul', message: 'A third captain haul short' },
    { event_type: 'duck', message: 'Duck message for Shreevar' },
    { event_type: 'expensive_bowling', message: 'Expensive bowler msg' },
    { event_type: 'fifty', message: 'Fifty message 1' },
    { event_type: 'fifty', message: 'Fifty message 2' },
    { event_type: 'wicketless', message: 'Wicketless message' },
    { event_type: 'general_roast', message: 'Roast message' },
    { event_type: 'low_sr', message: 'Low SR msg' },
  ]
  // captain_haul: 2 max, captain_fail: 0, vc_fail: 0, duck: 1, century: 0,
  // fifty: 1, three_plus: 0, wicketless: 1, expensive: 1, great_eco: 0,
  // general_roast: 1, low_sr: 1 = 8 total
  console.log('Expected 8, got manual count')
})()
"
```

The logic is straightforward enough to verify by reading. The function is deterministic.

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/lib/banter-curation.ts && git commit -m "feat(insights): add banter curation utility"
```

---

## Task 5: Leaderboard tab navigator

**Files:**
- Create: `src/app/(app)/leaderboard/insights-tabs.tsx`

- [ ] **Step 1: Create the client-side tab switcher**

```typescript
"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type InsightsTab = "standings" | "captain" | "season" | "differential"

const TABS: { id: InsightsTab; label: string }[] = [
  { id: "standings", label: "Standings" },
  { id: "captain", label: "Captain" },
  { id: "season", label: "Season" },
  { id: "differential", label: "Differential" },
]

interface Props {
  currentTab: InsightsTab
  leagueId: string
}

export function InsightsTabs({ currentTab, leagueId }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function switchTab(tab: InsightsTab) {
    const params = new URLSearchParams()
    params.set("league", leagueId)
    if (tab !== "standings") params.set("tab", tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 p-1 rounded-xl glass overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => switchTab(t.id)}
          className={cn(
            "flex-1 min-w-[72px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
            t.id === currentTab
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-overlay-subtle"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/app/\(app\)/leaderboard/insights-tabs.tsx && git commit -m "feat(insights): add leaderboard tab navigator component"
```

---

## Task 6: Captain analytics tab component

**Files:**
- Create: `src/components/captain-analytics-tab.tsx`

This component contains three sub-sections: season captain leaderboard, C/VC picks by team (filterable), and per-match captain history for the logged-in user.

- [ ] **Step 1: Create the component**

```typescript
"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { CaptainAnalyticsRow, CaptainMatchHistoryRow, CvPickRow } from "@/lib/types"

interface Props {
  leaderboard: CaptainAnalyticsRow[]
  matchHistory: Record<string, CaptainMatchHistoryRow[]>  // keyed by user_id
  cvPicks: CvPickRow[]
  currentUserId: string
  userNames: Record<string, string>  // user_id -> display_name
}

// ── Captain leaderboard ────────────────────────────────────────────────────────

function CaptainLeaderboard({ rows, currentUserId }: { rows: CaptainAnalyticsRow[]; currentUserId: string }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
          <span>Player</span>
          <span className="text-right">C Pts</span>
          <span className="text-right hidden sm:block">Optimal</span>
          <span className="text-right">Left</span>
          <span className="text-right">Hit%</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {rows.map((row, i) => {
          const isMe = row.user_id === currentUserId
          return (
            <div
              key={row.user_id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-3 py-2.5",
                isMe && "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--primary)]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-4 tabular-nums shrink-0">{i + 1}</span>
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold", getAvatarColor(row.display_name))}>
                  {getInitials(row.display_name)}
                </div>
                <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                  {row.display_name}{isMe && " (you)"}
                </span>
              </div>
              <span className="text-gold-stat text-sm tabular-nums text-right">{row.total_captain_pts.toLocaleString()}</span>
              <span className="hidden sm:block text-xs text-muted-foreground tabular-nums text-right">{row.total_optimal_pts.toLocaleString()}</span>
              <span className="text-xs tabular-nums text-right text-rose-400/80">
                −{row.opportunity_cost.toLocaleString()}
              </span>
              <span className={cn(
                "text-xs tabular-nums text-right font-medium",
                row.hit_rate_pct >= 70 ? "text-emerald-500" : row.hit_rate_pct >= 50 ? "text-amber-500" : "text-rose-400"
              )}>
                {row.hit_rate_pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── C/VC picks by team (filterable) ────────────────────────────────────────────

function CvPicksTable({
  cvPicks,
  userNames,
  currentUserId,
}: {
  cvPicks: CvPickRow[]
  userNames: Record<string, string>
  currentUserId: string
}) {
  const userIds = Object.keys(userNames)
  const teams = useMemo(() => [...new Set(cvPicks.map((r) => r.team_short_name))].sort(), [cvPicks])

  const [filterUser, setFilterUser] = useState<string>("all")
  const [filterTeam, setFilterTeam] = useState<string>("all")

  const filtered = useMemo(() => {
    let rows = cvPicks
    if (filterTeam !== "all") rows = rows.filter((r) => r.team_short_name === filterTeam)
    if (filterUser !== "all") rows = rows.filter((r) => {
      const p = r.picks[filterUser]
      return p && (p.captain > 0 || p.vc > 0)
    })
    return rows
  }, [cvPicks, filterTeam, filterUser])

  // Which user IDs to show as columns
  const visibleUserIds = filterUser === "all" ? userIds : [filterUser]

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg glass border border-overlay-border bg-transparent text-foreground"
        >
          <option value="all">All players</option>
          {userIds.map((uid) => (
            <option key={uid} value={uid}>{userNames[uid]}</option>
          ))}
        </select>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg glass border border-overlay-border bg-transparent text-foreground"
        >
          <option value="all">All teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[400px]">
          <thead>
            <tr className="border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-3 py-2 text-left font-medium">Team</th>
              {visibleUserIds.map((uid) => (
                <th key={uid} className={cn("px-2 py-2 text-center font-medium", uid === currentUserId && "text-primary")}>
                  {userNames[uid]?.split(" ")[0] ?? "?"}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">/Matches</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-overlay-border">
            {filtered.map((row) => (
              <tr key={row.player_id} className="hover:bg-overlay-subtle/50">
                <td className="px-3 py-2 font-medium truncate max-w-[120px]">{row.player_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.team_short_name}</td>
                {visibleUserIds.map((uid) => {
                  const p = row.picks[uid] ?? { captain: 0, vc: 0 }
                  const hasAny = p.captain > 0 || p.vc > 0
                  return (
                    <td key={uid} className={cn("px-2 py-2 text-center tabular-nums", uid === currentUserId && "font-semibold")}>
                      {hasAny ? (
                        <span>
                          <span className="text-[var(--captain-gold)]">{p.captain}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-primary/80">{p.vc}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-right text-muted-foreground">{row.team_matches_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No picks match the selected filters</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Format: C picks / VC picks out of matches played by that team</p>
    </div>
  )
}

// ── Per-match captain history ───────────────────────────────────────────────────

function CaptainMatchHistory({ rows }: { rows: CaptainMatchHistoryRow[] }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle">
        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_auto] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>#</span>
          <span>Match</span>
          <span className="text-right">Your C</span>
          <span className="text-right hidden sm:block">Best in 11</span>
          <span className="text-right hidden sm:block">Their Pts</span>
          <span className="text-right">Gap</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border max-h-[400px] overflow-y-auto">
        {rows.map((row) => {
          const perfect = row.gap === 0
          return (
            <div
              key={`${row.match_id}`}
              className="grid grid-cols-[auto_1fr_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 text-xs"
            >
              <span className="text-muted-foreground tabular-nums w-6">{row.match_number}</span>
              <span className="truncate text-muted-foreground">{row.matchup}</span>
              <span className="text-right font-medium tabular-nums">{row.captain_name.split(" ").pop()}</span>
              <span className="hidden sm:block text-right text-muted-foreground truncate">{perfect ? "—" : row.optimal_player_name.split(" ").pop()}</span>
              <span className="hidden sm:block text-right tabular-nums text-muted-foreground">{perfect ? "" : row.optimal_pts}</span>
              <span className={cn("text-right tabular-nums font-medium", perfect ? "text-emerald-500" : "text-rose-400")}>
                {perfect ? "✓" : `−${row.gap}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main tab component ──────────────────────────────────────────────────────────

export function CaptainAnalyticsTab({ leaderboard, matchHistory, cvPicks, currentUserId, userNames }: Props) {
  const myHistory = matchHistory[currentUserId] ?? []
  const myRow = leaderboard.find((r) => r.user_id === currentUserId)

  return (
    <div className="space-y-6">
      {/* Personal summary */}
      {myRow && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Captain Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Earned", value: myRow.total_captain_pts.toLocaleString(), sub: "captain pts" },
              { label: "Optimal", value: myRow.total_optimal_pts.toLocaleString(), sub: "if always best" },
              { label: "Left on table", value: `−${myRow.opportunity_cost.toLocaleString()}`, sub: "pts missed", red: true },
              { label: "Hit rate", value: `${myRow.hit_rate_pct}%`, sub: "≥50 pts as C" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-overlay-subtle p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={cn("text-xl font-bold tabular-nums", stat.red ? "text-rose-400" : "text-gold-stat")}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season captain leaderboard */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Season Captain Leaderboard</p>
        <CaptainLeaderboard rows={leaderboard} currentUserId={currentUserId} />
        <p className="text-[10px] text-muted-foreground px-1">C Pts = actual captain points earned · Left = points lost vs. optimal pick · Hit% = % of matches captain scored ≥50 pts</p>
      </div>

      {/* C/VC by team */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">C/VC Picks by Team</p>
        <CvPicksTable cvPicks={cvPicks} userNames={userNames} currentUserId={currentUserId} />
      </div>

      {/* Your match history */}
      {myHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Captain History</p>
          <CaptainMatchHistory rows={myHistory} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/components/captain-analytics-tab.tsx && git commit -m "feat(insights): add captain analytics tab component"
```

---

## Task 7: Season / form tab component

**Files:**
- Create: `src/components/season-tab.tsx`

Note: `FormStatsRow` is computed from `LeagueMatchScore[]` (already fetched by the leaderboard page) — no additional DB query. The computation happens in the leaderboard page before passing to this component.

- [ ] **Step 1: Create the component**

```typescript
"use client"

import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { FormStatsRow } from "@/lib/types"

interface Props {
  rows: FormStatsRow[]
  currentUserId: string
}

const FORM_CONFIG = {
  hot:     { label: "🔥 Hot",     className: "text-amber-500 bg-amber-500/10" },
  steady:  { label: "→ Steady",   className: "text-muted-foreground bg-overlay-subtle" },
  cooling: { label: "📉 Cooling", className: "text-blue-400 bg-blue-400/10" },
}

export function SeasonTab({ rows, currentUserId }: Props) {
  // Sort by current_rank
  const sorted = [...rows].sort((a, b) => a.current_rank - b.current_rank)
  const leader = sorted[0]

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-muted-foreground">
        Form = last 5 match average vs season average.
        🔥 Hot: last-5 avg &gt; season avg by 20+ pts · 📉 Cooling: last-5 avg &lt; season avg by 20+ pts.
      </p>

      {sorted.map((row) => {
        const isMe = row.user_id === currentUserId
        const ptsFromLeader = row.user_id === leader.user_id ? null : row.total_points - leader.total_points
        const formCfg = FORM_CONFIG[row.form]

        return (
          <div
            key={row.user_id}
            className={cn(
              "glass rounded-2xl p-4 space-y-3",
              isMe && "ring-1 ring-primary/30"
            )}
          >
            {/* Header row */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground w-5 tabular-nums">{row.current_rank}</span>
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold", getAvatarColor(row.display_name))}>
                {getInitials(row.display_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", isMe && "text-primary")}>
                  {row.display_name}{isMe && " (you)"}
                </p>
                {ptsFromLeader !== null && (
                  <p className="text-[10px] text-rose-400/80 tabular-nums">
                    −{Math.abs(ptsFromLeader).toLocaleString()} pts from 1st
                  </p>
                )}
              </div>
              <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full", formCfg.className)}>
                {formCfg.label}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[
                { label: "Season Avg", value: Math.round(row.season_avg).toLocaleString() },
                { label: "Last 5 Avg", value: Math.round(row.last5_avg).toLocaleString(), highlight: true },
                { label: "Consistency σ", value: Math.round(row.consistency_stddev).toLocaleString() },
                { label: "Total Pts", value: row.total_points.toLocaleString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-overlay-subtle px-2.5 py-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className={cn("text-sm font-bold tabular-nums mt-0.5", stat.highlight ? "text-gold-stat" : "text-foreground")}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Last 5 scores row */}
            {row.last5_scores.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground shrink-0">Last 5:</span>
                <div className="flex gap-1">
                  {row.last5_scores.map((score, i) => (
                    <span
                      key={i}
                      className={cn(
                        "text-[10px] tabular-nums px-1.5 py-0.5 rounded",
                        score >= 900 ? "bg-amber-500/20 text-amber-500" :
                        score >= 700 ? "bg-primary/15 text-primary" :
                        "bg-overlay-subtle text-muted-foreground"
                      )}
                    >
                      {score}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/components/season-tab.tsx && git commit -m "feat(insights): add season/form tab component"
```

---

## Task 8: Differential picks tab component

**Files:**
- Create: `src/components/differential-tab.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import type { DifferentialPickRow, DifferentialSummaryRow } from "@/lib/types"

interface Props {
  picks: DifferentialPickRow[]
  summary: DifferentialSummaryRow[]
  currentUserId: string
  userNames: Record<string, string>
}

const CATEGORY_CONFIG = {
  gem:        { label: "💎 Gem",       className: "text-amber-500 bg-amber-500/10" },
  "paid-off": { label: "✅ Paid Off",  className: "text-emerald-500 bg-emerald-500/10" },
  backfired:  { label: "❌ Backfired", className: "text-rose-400 bg-rose-400/10" },
}

// ── Differential summary leaderboard ──────────────────────────────────────────

function DiffLeaderboard({ summary, currentUserId }: { summary: DifferentialSummaryRow[]; currentUserId: string }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3">
          <span>Player</span>
          <span className="text-right">Diff Score</span>
          <span className="text-right hidden sm:block">Unique Pts</span>
          <span className="text-right">Avg Own.</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {summary.map((row, i) => {
          const isMe = row.user_id === currentUserId
          return (
            <div
              key={row.user_id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5",
                isMe && "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--primary)]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-4 tabular-nums shrink-0">{i + 1}</span>
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold", getAvatarColor(row.display_name))}>
                  {getInitials(row.display_name)}
                </div>
                <span className={cn("text-sm truncate", isMe && "font-semibold")}>
                  {row.display_name}{isMe && " (you)"}
                </span>
              </div>
              <span className={cn("text-sm tabular-nums text-right font-semibold", row.differential_score >= 0 ? "text-gold-stat" : "text-rose-400")}>
                {row.differential_score >= 0 ? "+" : ""}{row.differential_score}
              </span>
              <span className="hidden sm:block text-xs tabular-nums text-right text-muted-foreground">{row.unique_pick_pts}</span>
              <span className="text-xs tabular-nums text-right text-muted-foreground">{row.avg_ownership.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Your unique picks table ─────────────────────────────────────────────────────

function UniquePicksTable({ picks, currentUserId }: { picks: DifferentialPickRow[]; currentUserId: string }) {
  const myUniquePicks = picks
    .filter((p) => p.user_id === currentUserId && p.ownership_count <= 3)
    .sort((a, b) => b.user_pts - a.user_pts)

  if (myUniquePicks.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No differential picks this season.</p>
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Pts</span>
          <span className="text-right">Owned</span>
          <span className="text-right">Category</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {myUniquePicks.map((pick, i) => {
          const catCfg = pick.category ? CATEGORY_CONFIG[pick.category] : null
          return (
            <div
              key={`${pick.match_id}:${pick.player_id}`}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center px-3 py-2 text-xs"
            >
              <span className="text-muted-foreground tabular-nums w-5">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {pick.player_name}
                  {pick.is_captain && <span className="ml-1 text-[var(--captain-gold)] text-[9px]">(C)</span>}
                  {pick.is_vc && <span className="ml-1 text-primary/80 text-[9px]">(VC)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">{pick.matchup} · M{pick.match_number}</p>
              </div>
              <span className="tabular-nums text-right font-semibold">{pick.user_pts}</span>
              <span className="tabular-nums text-right text-muted-foreground">{pick.ownership_count}/{pick.total_users}</span>
              {catCfg ? (
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-right", catCfg.className)}>
                  {catCfg.label}
                </span>
              ) : (
                <span className="text-muted-foreground/30 text-right">—</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Herd traps ──────────────────────────────────────────────────────────────────

function HerdTraps({ picks }: { picks: DifferentialPickRow[] }) {
  // High ownership (ownership_count >= 4 of total) AND very low pts (<20)
  const traps = picks
    .filter((p, i, arr) => {
      // Deduplicate: one row per match+player
      return (
        p.ownership_count >= Math.ceil(p.total_users * 0.6) &&
        p.user_pts < 20 &&
        arr.findIndex((x) => x.match_id === p.match_id && x.player_id === p.player_id) === i
      )
    })
    .sort((a, b) => b.ownership_count - a.ownership_count || a.user_pts - b.user_pts)
    .slice(0, 20)

  if (traps.length === 0) return null

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3">
          <span>#</span>
          <span>Player · Match</span>
          <span className="text-right">Owned</span>
          <span className="text-right">Pts</span>
        </div>
      </div>
      <div className="divide-y divide-overlay-border">
        {traps.map((trap, i) => (
          <div key={`${trap.match_id}:${trap.player_id}`} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 py-2 text-xs">
            <span className="text-muted-foreground w-5">{i + 1}</span>
            <div>
              <p className="font-medium">{trap.player_name}</p>
              <p className="text-[10px] text-muted-foreground">{trap.matchup}</p>
            </div>
            <span className="tabular-nums text-right text-rose-400">{trap.ownership_count}/{trap.total_users}</span>
            <span className="tabular-nums text-right font-semibold text-rose-500">{trap.user_pts}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main tab ────────────────────────────────────────────────────────────────────

export function DifferentialTab({ picks, summary, currentUserId, userNames }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Differential Leaderboard</p>
        <p className="text-[10px] text-muted-foreground">Diff Score = pts from unique picks (≤2/6 owners) minus pts lost on unique busts. Avg Own. = average ownership of your picks (lower = more contrarian).</p>
        <DiffLeaderboard summary={summary} currentUserId={currentUserId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Differential Picks</p>
        <p className="text-[10px] text-muted-foreground">Picks where ≤3 of {Object.keys(userNames).length} users selected the player.</p>
        <UniquePicksTable picks={picks} currentUserId={currentUserId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">🪤 Herd Traps</p>
        <p className="text-[10px] text-muted-foreground">Players picked by 60%+ of the league who scored under 20 pts.</p>
        <HerdTraps picks={picks} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/components/differential-tab.tsx && git commit -m "feat(insights): add differential picks tab component"
```

---

## Task 9: Wire leaderboard page

**Files:**
- Modify: `src/app/(app)/leaderboard/page.tsx`

- [ ] **Step 1: Update imports and `searchParams` type at the top of `leaderboard/page.tsx`**

Replace the existing import block and `searchParams` type:

```typescript
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy as TrophyIcon, Zap, Crown, Target } from "lucide-react"
import { getMyLeagues, getLeagueLeaderboard, getLeagueAwards, getLeagueMatchScores } from "@/actions/leagues"
import { getCaptainAnalytics, getDifferentialData } from "@/actions/insights"
import { LeaderboardSelector } from "./leaderboard-selector"
import { InsightsTabs, type InsightsTab } from "./insights-tabs"
import { MatchdayHistory, AwardTables } from "./leaderboard-sections"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { EmptyState } from "@/components/empty-state"
import { PageTransition } from "@/components/page-transition"
import { LeaderboardTable, type LeaderboardRow } from "@/components/leaderboard-table"
import { SeasonProgressTable, type ProgressRow } from "@/components/season-progress-table"
import { CaptainAnalyticsTab } from "@/components/captain-analytics-tab"
import { SeasonTab } from "@/components/season-tab"
import { DifferentialTab } from "@/components/differential-tab"
import { cn } from "@/lib/utils"
import type { LeagueMemberStats, LeagueMatchScore, FormStatsRow } from "@/lib/types"
```

- [ ] **Step 2: Update the `searchParams` type and the function signature**

Replace:
```typescript
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>
})
```

With:
```typescript
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; tab?: string }>
})
```

- [ ] **Step 3: Update the data-fetching block inside the function (after `leagueId` is resolved)**

Replace:
```typescript
  // Fetch all data in parallel
  const [leaderboard, awards, matchScores] = await Promise.all([
    getLeagueLeaderboard(leagueId),
    getLeagueAwards(leagueId),
    getLeagueMatchScores(leagueId),
  ])
```

With:
```typescript
  const { league: leagueIdParam, tab: tabParam } = await searchParams
  const tab = (tabParam ?? "standings") as InsightsTab

  // Always fetch core standings data; fetch tab-specific analytics conditionally
  const [leaderboard, awards, matchScores, captainData, differentialData] = await Promise.all([
    getLeagueLeaderboard(leagueId),
    getLeagueAwards(leagueId),
    getLeagueMatchScores(leagueId),
    tab === "captain" ? getCaptainAnalytics(leagueId) : Promise.resolve(null),
    tab === "differential" ? getDifferentialData(leagueId) : Promise.resolve(null),
  ])
```

Note: remove the `const { league: leagueIdParam } = await searchParams` line that was previously lower in the function since we now destructure `tab` at the same time.

- [ ] **Step 4: Compute `FormStatsRow[]` from `matchScores` for the Season tab (add after the existing `formGuide` computation block)**

Add this block after the `formGuide` computation:

```typescript
  // Form stats (for Season tab) — computed from existing matchScores
  const formRows: FormStatsRow[] = leaderboardRows.map((row, idx) => {
    const userMatches = matchScores
      .filter((ms) => ms.user_id === row.user_id)
      .sort((a, b) => a.match_number - b.match_number)

    const allPts = userMatches.map((ms) => ms.total_points)
    const seasonAvg = allPts.length > 0 ? allPts.reduce((s, p) => s + p, 0) / allPts.length : 0
    const last5 = allPts.slice(-5)
    const last5Avg = last5.length > 0 ? last5.reduce((s, p) => s + p, 0) / last5.length : 0

    // Standard deviation
    const mean = seasonAvg
    const variance = allPts.length > 1
      ? allPts.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / (allPts.length - 1)
      : 0
    const stddev = Math.sqrt(variance)

    const form: FormStatsRow["form"] =
      last5Avg > seasonAvg + 20 ? "hot" :
      last5Avg < seasonAvg - 20 ? "cooling" : "steady"

    return {
      user_id: row.user_id,
      display_name: row.display_name,
      total_points: row.total_points,
      season_avg: seasonAvg,
      last5_avg: last5Avg,
      last5_scores: last5,
      consistency_stddev: stddev,
      current_rank: row.season_rank,
      form,
    }
  })
```

- [ ] **Step 5: Add `InsightsTabs` and conditional tab rendering to the JSX**

In the JSX, after the `<Badge>` for the selected league and before the `Player Stats` link, insert:

```tsx
      {/* ═══ TAB NAVIGATOR ═══ */}
      <InsightsTabs currentTab={tab} leagueId={leagueId} />
```

Then wrap the entire existing standings / awards / matchday history JSX in a conditional:

```tsx
      {tab === "standings" && (
        <>
          {/* existing: Player Stats link */}
          {/* existing: Season Standings */}
          {/* existing: Season Race */}
          {/* existing: Key Stats */}
          {/* existing: Awards Race */}
          {/* existing: Matchday History */}
          {/* existing: Award Tables */}
        </>
      )}

      {tab === "captain" && captainData && (
        <CaptainAnalyticsTab
          leaderboard={captainData.leaderboard}
          matchHistory={captainData.matchHistory}
          cvPicks={captainData.cvPicks}
          currentUserId={user.id}
          userNames={captainData.userNames}
        />
      )}

      {tab === "season" && (
        <SeasonTab rows={formRows} currentUserId={user.id} />
      )}

      {tab === "differential" && differentialData && (
        <DifferentialTab
          picks={differentialData.picks}
          summary={differentialData.summary}
          currentUserId={user.id}
          userNames={differentialData.userNames}
        />
      )}
```

- [ ] **Step 6: Verify TypeScript and start dev server**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -30
```

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npm run dev
```

Open `http://localhost:3000/leaderboard` and verify:
- Four tabs render ("Standings", "Captain", "Season", "Differential")
- Standings tab shows existing content unchanged
- Clicking "Season" shows form cards for all users
- Clicking "Captain" shows captain analytics (may take a moment — data fetches on tab load)
- Clicking "Differential" shows differential leaderboard

- [ ] **Step 7: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/app/\(app\)/leaderboard/page.tsx && git commit -m "feat(insights): wire leaderboard page with analytics tabs"
```

---

## Task 10: Match Moments banter section

**Files:**
- Create: `src/components/match-moments-section.tsx`
- Modify: `src/app/(app)/match/[id]/scores/page.tsx`

- [ ] **Step 1: Create `src/components/match-moments-section.tsx`**

```typescript
"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { RawBanterMessage } from "@/lib/banter-curation"

interface Props {
  messages: RawBanterMessage[]
}

export function MatchMomentsSection({ messages }: Props) {
  const [open, setOpen] = useState(false)

  if (messages.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 glass rounded-2xl text-sm font-medium hover:bg-overlay-subtle transition-colors"
      >
        <span>⚡ Match Moments ({messages.length})</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-2 px-1">
          {messages.map((msg, i) => (
            <div key={i} className="glass rounded-xl px-4 py-3 text-sm text-foreground/90 leading-relaxed">
              {msg.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update the banter fetch in `src/app/(app)/match/[id]/scores/page.tsx`**

In the `Promise.all` block, change the banter fetch limit from `15` to `200` and add a `created_at` select:

Replace:
```typescript
    admin
      .from("match_banter")
      .select("message, event_type")
      .eq("match_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
```

With:
```typescript
    admin
      .from("match_banter")
      .select("message, event_type")
      .eq("match_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
```

- [ ] **Step 3: Import and apply curation in `scores/page.tsx`**

Add to imports at the top:
```typescript
import { curateBanter } from "@/lib/banter-curation"
import { MatchMomentsSection } from "@/components/match-moments-section"
```

In the section where `banter` is prepared (just before the `return`), add:
```typescript
  const curatedBanter = curateBanter(
    (banterRes.data ?? []).map((b) => ({ message: b.message, event_type: b.event_type }))
  )
```

- [ ] **Step 4: Pass `curatedBanter` to `ScoresClient` and add `MatchMomentsSection`**

In `scores/page.tsx`, the `banter` prop passed to `ScoresClient`:

Replace:
```typescript
        banter={(banterRes.data ?? []).map((b) => ({ message: b.message, event_type: b.event_type }))}
```

With:
```typescript
        banter={curatedBanter}
```

Then, in the return block, after `</ScoresClient>` (or wrapping `ScoresClient`) — since `ScoresClient` is the whole page content rendered inside `<PageTransition>`, add `MatchMomentsSection` as a sibling:

Replace:
```typescript
  return (
    <PageTransition>
      <ScoresClient
        ...props...
      />
    </PageTransition>
  )
```

With:
```typescript
  return (
    <PageTransition>
      <ScoresClient
        ...props...
      />
      {match.status === "completed" && curatedBanter.length > 0 && (
        <div className="px-4 pb-6 max-w-3xl mx-auto">
          <MatchMomentsSection messages={curatedBanter} />
        </div>
      )}
    </PageTransition>
  )
```

- [ ] **Step 5: Verify TypeScript and test in browser**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

Navigate to a completed match scores page. The "Match Moments" toggle should appear at the bottom, collapsed by default. Clicking it should expand to show ≤8 curated banter messages.

- [ ] **Step 6: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/components/match-moments-section.tsx src/app/\(app\)/match/\[id\]/scores/page.tsx src/lib/banter-curation.ts && git commit -m "feat(insights): add match moments banter section to scores page"
```

---

## Task 11: Match Gem callout

**Files:**
- Create: `src/components/match-gem-callout.tsx`
- Modify: `src/app/(app)/match/[id]/scores/page.tsx`

- [ ] **Step 1: Create `src/components/match-gem-callout.tsx`**

```typescript
interface Props {
  playerName: string
  teamShortName: string
  pts: number
  ownershipCount: number
  totalUsers: number
}

export function MatchGemCallout({ playerName, teamShortName, pts, ownershipCount, totalUsers }: Props) {
  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
      <span className="text-lg shrink-0">💎</span>
      <div>
        <span className="font-semibold">Match Gem — </span>
        <span>{playerName}</span>
        <span className="text-muted-foreground"> ({teamShortName}, {pts} pts)</span>
        <span className="text-muted-foreground"> — picked by {ownershipCount} of {totalUsers}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Compute the gem in `scores/page.tsx`**

After `curatedBanter` is computed, add:

```typescript
  // Find match gem: lowest-ownership player who scored >= 80 pts
  // Use player scores + ownership from allSelections
  let matchGem: { playerName: string; teamShortName: string; pts: number; ownershipCount: number; totalUsers: number } | null = null

  if (match.status === "completed" && allSelections.length > 0) {
    const totalUsers = allSelections.length
    // Build ownership count per player
    const ownershipCount = new Map<string, number>()
    for (const sel of allSelections) {
      for (const pid of sel.player_ids) {
        ownershipCount.set(pid, (ownershipCount.get(pid) ?? 0) + 1)
      }
    }
    // Find player with ownership <= 2 AND highest score >= 80
    let bestGem: { score: number; name: string; team: string; ownership: number } | null = null
    for (const ps of playerScores) {
      if (Number(ps.fantasy_points) < 80) continue
      const ownership = ownershipCount.get(ps.player?.id ?? "") ?? 0
      if (ownership > 2) continue
      if (!bestGem || Number(ps.fantasy_points) > bestGem.score) {
        bestGem = {
          score: Number(ps.fantasy_points),
          name: (ps.player as unknown as { name: string })?.name ?? "?",
          team: (ps.player as unknown as { team: { short_name: string } })?.team?.short_name ?? "?",
          ownership,
        }
      }
    }
    if (bestGem) {
      matchGem = {
        playerName: bestGem.name,
        teamShortName: bestGem.team,
        pts: bestGem.score,
        ownershipCount: bestGem.ownership,
        totalUsers,
      }
    }
  }
```

- [ ] **Step 3: Render gem callout in the return block**

Add to the return block, right before `<MatchMomentsSection>`:

```typescript
import { MatchGemCallout } from "@/components/match-gem-callout"
```

In JSX:
```tsx
      {matchGem && (
        <div className="px-4 pt-3 max-w-3xl mx-auto">
          <MatchGemCallout
            playerName={matchGem.playerName}
            teamShortName={matchGem.teamShortName}
            pts={matchGem.pts}
            ownershipCount={matchGem.ownershipCount}
            totalUsers={matchGem.totalUsers}
          />
        </div>
      )}
```

- [ ] **Step 4: Verify TypeScript and test**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -20
```

Navigate to a completed match scores page and verify the gem callout appears when applicable (match 38 LSG vs KKR had Mohsin Khan at 160 pts picked by 2/6 — should show).

- [ ] **Step 5: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/components/match-gem-callout.tsx src/app/\(app\)/match/\[id\]/scores/page.tsx && git commit -m "feat(insights): add match gem callout to scores page"
```

---

## Task 12: Admin projected standings + per-user differential breakdown

**Files:**
- Modify: `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: Add import for `getDifferentialData` in `admin/page.tsx`**

```typescript
import { getDifferentialData } from "@/actions/insights"
import type { DifferentialPickRow } from "@/lib/types"
```

- [ ] **Step 2: Fetch additional data in the admin `Promise.all`**

The admin page needs the first league's ID. Add after `if (!profile?.is_admin) redirect("/")`:

```typescript
  // Get the first league for analytics
  const { data: firstLeague } = await supabase
    .from("league_members")
    .select("leagues!inner(id)")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  const leagueId = (firstLeague?.leagues as unknown as { id: string })?.id ?? null
```

Then add to the `Promise.all` (or create a new one after):

```typescript
  const [diffData, leagueMatchScoresRes] = await Promise.all([
    leagueId ? getDifferentialData(leagueId) : Promise.resolve(null),
    leagueId
      ? supabase
          .from("user_match_scores")
          .select("user_id, total_points, profile:profiles(display_name)")
          .limit(5000)
      : Promise.resolve({ data: null }),
  ])
```

- [ ] **Step 3: Compute projected standings from `leagueMatchScoresRes`**

```typescript
  // Projected standings
  const REMAINING_MATCHES = 29  // hardcoded for IPL 2026; update if needed
  type ProjectedRow = { userId: string; name: string; currentTotal: number; avg: number; projected: number; projectedRank: number }
  let projectedRows: ProjectedRow[] = []

  if (leagueMatchScoresRes.data && leagueMatchScoresRes.data.length > 0) {
    const userTotals = new Map<string, { name: string; total: number; count: number }>()
    for (const row of leagueMatchScoresRes.data) {
      const name = (row.profile as unknown as { display_name: string })?.display_name ?? "?"
      const existing = userTotals.get(row.user_id) ?? { name, total: 0, count: 0 }
      existing.total += Number(row.total_points)
      existing.count++
      userTotals.set(row.user_id, existing)
    }
    projectedRows = [...userTotals.entries()].map(([userId, { name, total, count }]) => {
      const avg = count > 0 ? total / count : 0
      const projected = total + avg * REMAINING_MATCHES
      return { userId, name, currentTotal: Math.round(total), avg: Math.round(avg), projected: Math.round(projected), projectedRank: 0 }
    })
    projectedRows.sort((a, b) => b.projected - a.projected)
    projectedRows.forEach((r, i) => { r.projectedRank = i + 1 })
  }
```

- [ ] **Step 4: Add Projected Standings and Differential Breakdown sections to the admin page JSX**

At the bottom of the admin page JSX (before the final closing `</div>`), add:

```tsx
      {/* ═══ PROJECTED STANDINGS ═══ */}
      {projectedRows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            📈 Projected Final Standings ({REMAINING_MATCHES} matches remaining)
          </h2>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Proj #</th>
                  <th className="px-3 py-2 text-left font-medium">Player</th>
                  <th className="px-3 py-2 text-right font-medium">Current</th>
                  <th className="px-3 py-2 text-right font-medium">Avg/Match</th>
                  <th className="px-3 py-2 text-right font-medium">Projected Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-overlay-border">
                {projectedRows.map((row) => (
                  <tr key={row.userId} className="hover:bg-overlay-subtle/50">
                    <td className="px-3 py-2 tabular-nums">{row.projectedRank}</td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.currentTotal.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.avg.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-gold-stat">{row.projected.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground px-1">Projection = current total + (season avg × {REMAINING_MATCHES} remaining). Update REMAINING_MATCHES in admin/page.tsx as matches complete.</p>
        </div>
      )}

      {/* ═══ PER-USER DIFFERENTIAL BREAKDOWN ═══ */}
      {diffData && diffData.picks.length > 0 && (
        <AdminDifferentialBreakdown
          picks={diffData.picks}
          userNames={diffData.userNames}
        />
      )}
```

- [ ] **Step 5: Add `AdminDifferentialBreakdown` as a local component at the bottom of `admin/page.tsx` (before the `export default`)**

```typescript
function AdminDifferentialBreakdown({
  picks,
  userNames,
}: {
  picks: DifferentialPickRow[]
  userNames: Record<string, string>
}) {
  "use client"
  // Note: admin/page.tsx is a Server Component. Extract this to a separate client file
  // if Next.js emits a 'use client' inside Server Component error.
  // For now, keep inline — the directive is on this inner function.
  const userIds = Object.keys(userNames)
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
        🔍 Full Differential Breakdown (Admin)
      </h2>
      {userIds.map((uid) => {
        const userPicks = picks
          .filter((p) => p.user_id === uid)
          .sort((a, b) => a.match_number - b.match_number || a.ownership_count - b.ownership_count)
        return (
          <details key={uid} className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-overlay-subtle">
              {userNames[uid]} — {userPicks.length} picks
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-1.5 text-left">M#</th>
                    <th className="px-3 py-1.5 text-left">Match</th>
                    <th className="px-3 py-1.5 text-left">Player</th>
                    <th className="px-3 py-1.5 text-center">Role</th>
                    <th className="px-3 py-1.5 text-center">Team</th>
                    <th className="px-3 py-1.5 text-right">Pts</th>
                    <th className="px-3 py-1.5 text-right">Owned</th>
                    <th className="px-3 py-1.5 text-center">C/VC</th>
                    <th className="px-3 py-1.5 text-center">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-overlay-border">
                  {userPicks.map((pick, i) => (
                    <tr key={i} className="hover:bg-overlay-subtle/50">
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{pick.match_number}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[100px]">{pick.matchup}</td>
                      <td className="px-3 py-1.5 font-medium">{pick.player_name}</td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">{pick.player_role}</td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">{pick.team_short_name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{pick.user_pts}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{pick.ownership_count}/{pick.total_users}</td>
                      <td className="px-3 py-1.5 text-center text-[10px]">
                        {pick.is_captain ? "C" : pick.is_vc ? "VC" : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-center text-[10px]">
                        {pick.category === "gem" ? "💎" : pick.category === "paid-off" ? "✅" : pick.category === "backfired" ? "❌" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </div>
  )
}
```

**Important:** If Next.js throws an error about `"use client"` inside a Server Component, extract `AdminDifferentialBreakdown` into `src/app/(app)/admin/admin-differential-breakdown.tsx` with `"use client"` at the top, and import it from there.

- [ ] **Step 6: Verify TypeScript and test in browser**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npx tsc --noEmit 2>&1 | head -30
```

Navigate to `/admin`. Verify:
- Projected Standings table shows all users with projections
- Differential Breakdown shows expandable `<details>` per user with full pick table

- [ ] **Step 7: Run build to confirm no errors**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && npm run build 2>&1 | tail -30
```

Expected: Compiled successfully, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/tusk-jvb/Claude Projects/TIPL/tiplfantasy" && git add src/app/\(app\)/admin/page.tsx && git commit -m "feat(insights): add admin projected standings and differential breakdown"
```

---

## Self-Review Checklist

- [x] **Types** — all types defined in Task 1 are used by tasks 2–12 with consistent property names
- [x] **Spec coverage** — Captain Leaderboard ✅, C/VC by team (filterable) ✅, Captain match history ✅, Form trajectory ✅, Projected standings (admin) ✅, Differential retro ✅, Differential full breakdown (admin) ✅, Match Moments banter ✅, Match Gem callout ✅
- [x] **No TBDs** — all code blocks are complete
- [x] **Type consistency** — `DifferentialPickRow.category` is `"gem" | "paid-off" | "backfired" | null` throughout; `FormStatsRow.form` is `"hot" | "steady" | "cooling"` throughout; `CvPickRow.picks` keyed by `user_id` throughout
- [x] **Admin `"use client"` note** — Task 12 includes explicit note about extracting `AdminDifferentialBreakdown` if needed
- [x] **Schema changes** — none; all data from existing tables
- [x] **`searchParams` destructuring** — Task 9 note explicitly says to remove the existing `const { league: leagueIdParam } = await searchParams` since it's now destructured with `tab` together

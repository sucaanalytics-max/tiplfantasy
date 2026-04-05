/**
 * SportMonks Cricket API v2.0 wrapper
 * Replaces CricAPI — all functions return the same normalized shapes
 * used by the scoring engine and cron jobs.
 */

// ─── Types (kept compatible with old CricAPI shapes) ───────────────────

export type CricAPIScorecard = {
  batting: Array<{
    batsman: { name: string }
    r: number
    b: number
    "4s": number
    "6s": number
    dismissal?: string
    isOut?: boolean
  }>
  bowling: Array<{
    bowler: { name: string }
    o: number
    m: number
    r: number
    w: number
  }>
  fielding?: Array<{
    fielder: { name: string }
    catches?: number
    stumpings?: number
    runouts?: number
  }>
}

export type BallEvent = {
  ball: number
  runs: number
  four: boolean
  six: boolean
  wicket: boolean
  scoreboard: string
}

export type CricAPIMatchPointsResult = {
  innings: CricAPIScorecard[]
  totals: Array<{ id: string; name: string }>
  balls?: BallEvent[]
  totalOversPlayed?: number
}

export type CricScoreItem = {
  id: string
  ms: "fixture" | "live" | "result" | string
  t1s: string
  t2s: string
  series: string
  note: string | null
}

export type SeasonFixture = {
  id: number
  round: string
  status: string
  live: boolean
  starting_at: string
  localteam_id: number
  visitorteam_id: number
}

export type FixtureInfo = {
  id: number
  status: string
  live: boolean
  toss_won_team_id: number | null
  elected: string | null
  winner_team_id: number | null
  man_of_match_id: number | null
  note: string | null
  starting_at: string
  localteam_id: number
  visitorteam_id: number
}

// ─── SportMonks raw response types ─────────────────────────────────────

type SMBatting = {
  player_id: number
  team_id: number
  scoreboard: string
  score: number
  ball: number
  four_x: number
  six_x: number
  rate: number
  active: boolean
  wicket_id: number | null
  catch_stump_player_id: number | null
  runout_by_id: number | null
  dismissal: string | null
  bowler_id: number | null
}

type SMBowling = {
  player_id: number
  team_id: number
  scoreboard: string
  overs: number
  medians: number
  runs: number
  wickets: number
  rate: number
  wide: number
  noball: number
  active: boolean
}

type SMRun = {
  team_id: number
  inning: number
  score: number
  wickets: number
  overs: number
}

type SMLineupPlayer = {
  id: number
  fullname: string
  position?: { name: string }
  lineup?: { team_id: number; captain: boolean; wicketkeeper: boolean; substitution?: boolean }
}

type SMTeam = {
  id: number
  name: string
  code: string
  image_path: string
}

type SMFixture = {
  id: number
  league_id: number
  season_id: number
  round: string
  localteam_id: number
  visitorteam_id: number
  starting_at: string
  live: boolean
  status: string
  note: string | null
  toss_won_team_id: number | null
  elected: string | null
  winner_team_id: number | null
  man_of_match_id?: number | null
  batting?: SMBatting[]
  bowling?: SMBowling[]
  lineup?: SMLineupPlayer[]
  runs?: SMRun[]
  balls?: Array<{ ball: number; scoreboard: string; score?: { runs: number; four: boolean; six: boolean; is_wicket: boolean } }>
  total_overs_played?: number
  localteam?: SMTeam
  visitorteam?: SMTeam
}

// ─── Constants ──────────────────────────────────────────────────────────

const BASE_URL = "https://cricket.sportmonks.com/api/v2.0"
const IPL_LEAGUE_ID = 1
const IPL_SEASON_ID = 1795

function apiToken() {
  const token = process.env.SPORTMONKS_TOKEN
  if (!token) throw new Error("SPORTMONKS_TOKEN not set")
  return token
}

function fetchWithTimeout(
  url: string,
  options?: RequestInit & { next?: { revalidate: number } },
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set("api_token", apiToken())
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  return url.toString()
}

// ─── SportMonks team ID → DB team short_name mapping ────────────────────

export const SPORTMONKS_TEAM_MAP: Record<number, string> = {
  2: "CSK",    // Chennai Super Kings
  3: "DC",     // Delhi Capitals
  4: "PBKS",   // Punjab Kings
  5: "KKR",    // Kolkata Knight Riders
  6: "MI",     // Mumbai Indians
  7: "RR",     // Rajasthan Royals
  8: "RCB",    // Royal Challengers Bengaluru
  9: "SRH",    // Sunrisers Hyderabad
  1976: "GT",  // Gujarat Titans
  1979: "LSG", // Lucknow Super Giants
}

// ─── Normalization helpers ──────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function fuzzyMatchName(
  apiName: string,
  dbNames: Map<string, string>
): string | null {
  const normalized = normalizeName(apiName)

  // 1. Exact match
  if (dbNames.has(normalized)) return dbNames.get(normalized)!

  // 2. Substring match (either direction)
  for (const [dbNorm, dbId] of dbNames) {
    if (dbNorm.includes(normalized) || normalized.includes(dbNorm)) {
      return dbId
    }
  }

  // 3. Reversed name match (e.g., "vijaykumar vyshak" ↔ "vyshak vijaykumar")
  const apiParts = normalized.split(" ")
  if (apiParts.length >= 2) {
    const reversed = [...apiParts].reverse().join(" ")
    if (dbNames.has(reversed)) return dbNames.get(reversed)!
    for (const [dbNorm, dbId] of dbNames) {
      if (dbNorm.includes(reversed) || reversed.includes(dbNorm)) {
        return dbId
      }
    }
  }

  // 4. All name parts match (any order) — handles "A B C" vs "C B A"
  if (apiParts.length >= 2) {
    const apiSet = new Set(apiParts)
    for (const [dbNorm, dbId] of dbNames) {
      const dbParts = dbNorm.split(" ")
      if (dbParts.length >= 2 && dbParts.every((p) => apiSet.has(p))) {
        return dbId
      }
    }
  }

  // 5. Last-name match (min 4 chars to avoid false positives)
  const apiLast = apiParts[apiParts.length - 1] ?? ""
  for (const [dbNorm, dbId] of dbNames) {
    const dbLast = dbNorm.split(" ").pop() ?? ""
    if (apiLast === dbLast && apiLast.length > 3) {
      return dbId
    }
  }

  return null
}

// ─── Core API functions ─────────────────────────────────────────────────

/**
 * Fetch fixture stats (batting, bowling, lineup) for a single match.
 * Replaces CricAPI's fetchMatchPoints().
 * Returns the same CricAPIMatchPointsResult shape for compatibility.
 */
export async function fetchMatchPoints(fixtureId: string): Promise<CricAPIMatchPointsResult | null> {
  try {
    const res = await fetchWithTimeout(
      buildUrl(`/fixtures/${fixtureId}`, { include: "batting,bowling,lineup,balls" })
    )
    if (!res.ok) { console.error(`[SportMonks] /fixtures/${fixtureId} ${res.status}`); return null }
    const json = await res.json()
    const fixture: SMFixture = json.data
    if (!fixture) return null

    const batting = fixture.batting ?? []
    const bowling = fixture.bowling ?? []
    const lineup = fixture.lineup ?? []

    // Build player name lookup from lineup
    const playerNameMap = new Map<number, string>()
    for (const p of lineup) {
      playerNameMap.set(p.id, p.fullname)
    }

    // Group by scoreboard (S1, S2) to build innings
    const scoreboards = new Set<string>()
    for (const b of batting) scoreboards.add(b.scoreboard)
    for (const b of bowling) scoreboards.add(b.scoreboard)

    // Derive fielding from batting dismissals
    const fieldingCounts = new Map<number, { catches: number; stumpings: number; runouts: number }>()
    function addFielding(playerId: number, type: "catches" | "stumpings" | "runouts") {
      if (!fieldingCounts.has(playerId)) {
        fieldingCounts.set(playerId, { catches: 0, stumpings: 0, runouts: 0 })
      }
      fieldingCounts.get(playerId)![type]++
    }

    for (const b of batting) {
      if (b.runout_by_id) {
        addFielding(b.runout_by_id, "runouts")
      } else if (b.catch_stump_player_id) {
        // If the catcher is also the wicketkeeper in lineup, count as stumping
        const isWk = lineup.some(
          (p) => p.id === b.catch_stump_player_id && p.lineup?.wicketkeeper
        )
        addFielding(b.catch_stump_player_id, isWk ? "stumpings" : "catches")
      }
    }

    // Build dismissal strings from batting data
    function buildDismissalString(b: SMBatting): string | undefined {
      if (b.wicket_id == null) return "not out"
      const bowler = b.bowler_id ? playerNameMap.get(b.bowler_id) : null
      const fielder = b.catch_stump_player_id ? playerNameMap.get(b.catch_stump_player_id) : null
      const runoutFielder = b.runout_by_id ? playerNameMap.get(b.runout_by_id) : null
      const d = b.dismissal?.toLowerCase()

      // Use last name only for compact display
      const lastName = (name: string | null) => name?.split(" ").pop() ?? name

      if (d === "caught") {
        const parts = []
        if (fielder) parts.push(`c ${lastName(fielder)}`)
        if (bowler) parts.push(`b ${lastName(bowler)}`)
        return parts.join(" ") || "caught"
      }
      if (d === "bowled") return bowler ? `b ${lastName(bowler)}` : "bowled"
      if (d === "lbw") return bowler ? `lbw b ${lastName(bowler)}` : "lbw"
      if (d === "stumped") {
        const parts = []
        if (fielder) parts.push(`st ${lastName(fielder)}`)
        if (bowler) parts.push(`b ${lastName(bowler)}`)
        return parts.join(" ") || "stumped"
      }
      if (d === "run out") return runoutFielder ? `run out (${lastName(runoutFielder)})` : "run out"
      if (d === "hit wicket") return bowler ? `hit wicket b ${lastName(bowler)}` : "hit wicket"
      if (d === "retired hurt" || d === "retired out") return d
      return d ?? "out"
    }

    const innings: CricAPIScorecard[] = [...scoreboards].sort().map((sb) => {
      const inningBatting = batting.filter((b) => b.scoreboard === sb)
      const inningBowling = bowling.filter((b) => b.scoreboard === sb)

      // Bowlers are from the opposing team — get their team_id
      const bowlingTeamId = inningBowling[0]?.team_id

      return {
        batting: inningBatting.map((b) => ({
          batsman: { name: playerNameMap.get(b.player_id) ?? String(b.player_id) },
          r: b.score,
          b: b.ball,
          "4s": b.four_x,
          "6s": b.six_x,
          isOut: b.wicket_id != null,
          dismissal: buildDismissalString(b),
        })),
        bowling: inningBowling.map((b) => ({
          bowler: { name: playerNameMap.get(b.player_id) ?? String(b.player_id) },
          o: b.overs,
          m: b.medians,
          r: b.runs,
          w: b.wickets,
        })),
        fielding: [...fieldingCounts.entries()]
          .filter(([pid]) => {
            // Only include fielders from the bowling side of this innings
            if (!bowlingTeamId) return true
            const p = lineup.find((l) => l.id === pid)
            return p?.lineup?.team_id === bowlingTeamId
          })
          .map(([pid, counts]) => ({
            fielder: { name: playerNameMap.get(pid) ?? String(pid) },
            catches: counts.catches,
            stumpings: counts.stumpings,
            runouts: counts.runouts,
          })),
      }
    })

    // Build totals from playing XI only (exclude impact sub options)
    const playingLineup = lineup.filter((p) => !p.lineup?.substitution)
    const totals = playingLineup.map((p) => ({
      id: String(p.id),
      name: p.fullname,
    }))

    // Parse ball-by-ball events (last 18 balls for ticker)
    const rawBalls = fixture.balls ?? []
    const balls: BallEvent[] = rawBalls
      .sort((a, b) => {
        if (a.scoreboard !== b.scoreboard) return a.scoreboard < b.scoreboard ? -1 : 1
        return a.ball - b.ball
      })
      .map((b) => ({
        ball: b.ball,
        runs: b.score?.runs ?? 0,
        four: b.score?.four ?? false,
        six: b.score?.six ?? false,
        wicket: b.score?.is_wicket ?? false,
        scoreboard: b.scoreboard,
      }))

    return { innings, totals, balls: balls.slice(-18), totalOversPlayed: fixture.total_overs_played ?? undefined }
  } catch (err) {
    console.error(`[SportMonks] /fixtures/${fixtureId} failed:`, err)
    return null
  }
}

/**
 * Fetch live scores for all active matches.
 * Replaces CricAPI's fetchCricScores().
 * Returns CricScoreItem[] shape for compatibility with LiveScoreWidget.
 */
export async function fetchCricScores(): Promise<CricScoreItem[] | null> {
  try {
    const res = await fetchWithTimeout(
      buildUrl("/livescores", { include: "runs,localteam,visitorteam" }),
      { next: { revalidate: 60 } }
    )
    if (!res.ok) { console.error(`[SportMonks] /livescores ${res.status}`); return null }
    const json = await res.json()
    const fixtures: SMFixture[] = json.data ?? []

    // Filter to IPL only
    const ipl = fixtures.filter((f) => f.league_id === IPL_LEAGUE_ID)

    return ipl.map((f) => {
      const runs = f.runs ?? []
      const team1Runs = runs.find((r) => r.team_id === f.localteam_id)
      const team2Runs = runs.find((r) => r.team_id === f.visitorteam_id)
      const t1Code = f.localteam?.code ?? "T1"
      const t2Code = f.visitorteam?.code ?? "T2"

      const formatScore = (code: string, r?: SMRun) =>
        r ? `${code} ${r.score}/${r.wickets} (${r.overs})` : ""

      // Map status to CricAPI-compatible ms values
      let ms: string
      if (f.status === "NS" || f.status === "Not Started") ms = "fixture"
      else if (f.status === "Finished" || f.status === "Aban." || f.status === "Cancl.") ms = "result"
      else ms = "live"

      return {
        id: String(f.id),
        ms,
        t1s: formatScore(t1Code, team1Runs),
        t2s: formatScore(t2Code, team2Runs),
        series: String(IPL_LEAGUE_ID),
        note: f.note ?? null,
      }
    })
  } catch (err) {
    console.error("[SportMonks] /livescores failed:", err)
    return null
  }
}

/**
 * Fetch all IPL 2026 season fixtures.
 * Replaces CricAPI's fetchSeriesInfo() + searchSeries().
 */
export async function fetchSeriesInfo(): Promise<SeasonFixture[] | null> {
  try {
    const res = await fetchWithTimeout(
      buildUrl(`/seasons/${IPL_SEASON_ID}`, { include: "fixtures" })
    )
    if (!res.ok) { console.error(`[SportMonks] /seasons/${IPL_SEASON_ID} ${res.status}`); return null }
    const json = await res.json()
    const fixtures: SMFixture[] = json.data?.fixtures ?? []

    return fixtures.map((f) => ({
      id: f.id,
      round: f.round,
      status: f.status,
      live: f.live,
      starting_at: f.starting_at,
      localteam_id: f.localteam_id,
      visitorteam_id: f.visitorteam_id,
    }))
  } catch (err) {
    console.error("[SportMonks] /seasons failed:", err)
    return null
  }
}

/**
 * Fetch lineup (playing XI) for a specific fixture.
 * Replaces CricAPI's fetchSquad().
 */
export async function fetchSquad(fixtureId: string): Promise<Array<{ name: string; id: string; img?: string }> | null> {
  try {
    const res = await fetchWithTimeout(
      buildUrl(`/fixtures/${fixtureId}`, { include: "lineup" })
    )
    if (!res.ok) { console.error(`[SportMonks] /fixtures/${fixtureId}/lineup ${res.status}`); return null }
    const json = await res.json()
    const lineup: SMLineupPlayer[] = json.data?.lineup ?? []
    const playingXI = lineup.filter((p) => !p.lineup?.substitution)

    return playingXI.map((p) => ({
      name: p.fullname,
      id: String(p.id),
      img: undefined,
    }))
  } catch (err) {
    console.error(`[SportMonks] /fixtures/${fixtureId}/lineup failed:`, err)
    return null
  }
}

/**
 * Fetch basic fixture info (status, toss, winner).
 * Replaces CricAPI's fetchMatchInfo().
 */
export async function fetchMatchInfo(fixtureId: string): Promise<FixtureInfo | null> {
  try {
    const res = await fetchWithTimeout(
      buildUrl(`/fixtures/${fixtureId}`)
    )
    if (!res.ok) { console.error(`[SportMonks] /fixtures/${fixtureId} ${res.status}`); return null }
    const json = await res.json()
    const f: SMFixture = json.data
    if (!f) return null

    return {
      id: f.id,
      status: f.status,
      live: f.live,
      toss_won_team_id: f.toss_won_team_id,
      elected: f.elected,
      winner_team_id: f.winner_team_id,
      man_of_match_id: f.man_of_match_id ?? null,
      note: f.note,
      starting_at: f.starting_at,
      localteam_id: f.localteam_id,
      visitorteam_id: f.visitorteam_id,
    }
  } catch (err) {
    console.error(`[SportMonks] /fixtures/${fixtureId} failed:`, err)
    return null
  }
}

/**
 * Fetch full scorecard for admin manual scoring.
 * Replaces CricAPI's fetchScorecard().
 * Returns CricAPIScorecard[] shape.
 */
export async function fetchScorecard(fixtureId: string): Promise<CricAPIScorecard[] | null> {
  const result = await fetchMatchPoints(fixtureId)
  return result?.innings ?? null
}

/**
 * Search players — SportMonks has no player search endpoint.
 * Returns null; use lineup-based backfill instead.
 */
export async function searchPlayers(): Promise<null> {
  console.warn("[SportMonks] searchPlayers not available — use lineup-based backfill")
  return null
}

/**
 * Diagnostic: returns raw fixture response for admin verification.
 * Replaces CricAPI's testMatchPointsEndpoint().
 */
export async function testMatchPointsEndpoint(fixtureId: string): Promise<unknown> {
  const res = await fetchWithTimeout(
    buildUrl(`/fixtures/${fixtureId}`, { include: "batting,bowling,lineup,runs" })
  )
  if (!res.ok) return { error: res.status, statusText: res.statusText }
  return await res.json()
}

// ─── Parsing (same output shape as CricAPI version) ─────────────────────

export type ParsedStats = Map<
  string,
  {
    runs: number
    balls_faced: number
    fours: number
    sixes: number
    wickets: number
    overs_bowled: number
    runs_conceded: number
    maidens: number
    catches: number
    stumpings: number
    run_outs: number
    isOut?: boolean
    dismissal?: string
  }
>

export function parseScorecardToStats(innings: CricAPIScorecard[]): ParsedStats {
  const stats: ParsedStats = new Map()

  function getOrInit(name: string) {
    const key = normalizeName(name)
    if (!stats.has(key)) {
      stats.set(key, {
        runs: 0,
        balls_faced: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        overs_bowled: 0,
        runs_conceded: 0,
        maidens: 0,
        catches: 0,
        stumpings: 0,
        run_outs: 0,
      })
    }
    return stats.get(key)!
  }

  for (const inning of innings) {
    for (const b of inning.batting ?? []) {
      const s = getOrInit(b.batsman.name)
      s.runs += b.r
      s.balls_faced += b.b
      s.fours += b["4s"]
      s.sixes += b["6s"]
      if (b.isOut !== undefined) s.isOut = b.isOut
      if (b.dismissal) s.dismissal = b.dismissal
    }

    for (const b of inning.bowling ?? []) {
      const s = getOrInit(b.bowler.name)
      s.wickets += b.w
      s.overs_bowled += b.o
      s.runs_conceded += b.r
      s.maidens += b.m
    }

    for (const f of inning.fielding ?? []) {
      const s = getOrInit(f.fielder.name)
      s.catches += f.catches ?? 0
      s.stumpings += f.stumpings ?? 0
      s.run_outs += f.runouts ?? 0
    }
  }

  return stats
}

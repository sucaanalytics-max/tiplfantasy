export type CricAPIMatch = {
  id: string
  name: string
  matchType: string
  status: string
  venue: string
  date: string
  dateTimeGMT: string
  teams: string[]
  series_id: string
  fantasyEnabled: boolean
  score?: Array<{ r: number; w: number; o: number; inning: string }>
}

export type CricAPIMatchInfo = {
  id: string
  name: string
  matchType: string
  status: string
  venue: string
  date: string
  dateTimeGMT: string
  teams: string[]
  score?: Array<{ r: number; w: number; o: number; inning: string }>
  tossWinner?: string
  tossChoice?: string
  matchWinner?: string
}

export type CricAPISeries = {
  id: string
  name: string
  startDate: string
  endDate: string
  odi: number
  t20: number
  test: number
  squads: number
  matches: number
}

export type CricAPISeriesMatch = {
  id: string
  name: string
  matchType: string
  status: string
  venue: string
  date: string
  dateTimeGMT: string
  teams: string[]
  fantasyEnabled: boolean
}

export type CricAPIPlayerSearchResult = {
  id: string
  name: string
  country: string
}

export type CricAPIMatchPointsResult = {
  /** Innings normalized into CricAPIScorecard shape — feed directly to parseScorecardToStats */
  innings: CricAPIScorecard[]
  /** Player totals from CricAPI — use `id` for cricapi_id-based DB lookup; ignore `points` (use our own engine) */
  totals: Array<{ id: string; name: string }>
}

export type CricAPIScorecard = {
  batting: Array<{
    batsman: { name: string }
    r: number
    b: number
    "4s": number
    "6s": number
    dismissal?: string
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

const BASE_URL = "https://api.cricapi.com/v1"

function apiKey() {
  const key = process.env.CRICDATA_KEY
  if (!key) throw new Error("CRICDATA_KEY not set")
  return key
}

/** Fetch with abort timeout to prevent hanging cron jobs */
function fetchWithTimeout(
  url: string,
  options?: RequestInit & { next?: { revalidate: number } },
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

/** Search for a series by name (e.g. "IPL") */
export async function searchSeries(query: string): Promise<CricAPISeries[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/series?apikey=${apiKey()}&offset=0&search=${encodeURIComponent(query)}`
    )
    if (!res.ok) { console.error(`[CricAPI] /series ${res.status}`); return null }
    const json = await res.json()
    return json.data ?? null
  } catch (err) {
    console.error("[CricAPI] /series failed:", err)
    return null
  }
}

/** Get all matches for a series */
export async function fetchSeriesMatches(seriesId: string): Promise<CricAPISeriesMatch[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/series_info?apikey=${apiKey()}&id=${seriesId}`
    )
    if (!res.ok) { console.error(`[CricAPI] /series_info ${res.status}`); return null }
    const json = await res.json()
    return json.data?.matchList ?? null
  } catch (err) {
    console.error(`[CricAPI] /series_info failed for ${seriesId}:`, err)
    return null
  }
}

/** Get detailed info for a single match */
export async function fetchMatchInfo(matchId: string): Promise<CricAPIMatchInfo | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/match_info?apikey=${apiKey()}&id=${matchId}`
    )
    if (!res.ok) { console.error(`[CricAPI] /match_info ${res.status}`); return null }
    const json = await res.json()
    return json.data ?? null
  } catch (err) {
    console.error(`[CricAPI] /match_info failed for ${matchId}:`, err)
    return null
  }
}

/** Get current live/recent matches */
export async function fetchCurrentMatches(): Promise<CricAPIMatch[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/currentMatches?apikey=${apiKey()}&offset=0`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) { console.error(`[CricAPI] /currentMatches ${res.status}`); return null }
    const json = await res.json()
    return json.data ?? null
  } catch (err) {
    console.error("[CricAPI] /currentMatches failed:", err)
    return null
  }
}

/** Get all matches (paginated) */
export async function fetchMatches(offset = 0): Promise<CricAPIMatch[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/matches?apikey=${apiKey()}&offset=${offset}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) { console.error(`[CricAPI] /matches ${res.status}`); return null }
    const json = await res.json()
    return json.data ?? null
  } catch (err) {
    console.error("[CricAPI] /matches failed:", err)
    return null
  }
}

export async function fetchScorecard(matchId: string): Promise<CricAPIScorecard[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/match_scorecard?apikey=${apiKey()}&id=${matchId}`
    )
    if (!res.ok) { console.error(`[CricAPI] /match_scorecard ${res.status}`); return null }
    const json = await res.json()
    return json.data?.scorecard ?? null
  } catch (err) {
    console.error(`[CricAPI] /match_scorecard failed for ${matchId}:`, err)
    return null
  }
}

export async function fetchSquad(matchId: string): Promise<Array<{ name: string; id: string; img?: string }> | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/match_squad?apikey=${apiKey()}&id=${matchId}`
    )
    if (!res.ok) { console.error(`[CricAPI] /match_squad ${res.status}`); return null }
    const json = await res.json()
    const players: Array<{ name: string; id: string; img?: string }> = []
    for (const team of json.data ?? []) {
      for (const p of team.players ?? []) {
        players.push({ name: p.name, id: p.id, img: p.img ?? undefined })
      }
    }
    return players
  } catch (err) {
    console.error(`[CricAPI] /match_squad failed for ${matchId}:`, err)
    return null
  }
}

type ParsedStats = Map<
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
  }
>

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

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

/** Search players by name — used for backfilling cricapi_id on the players table */
export async function searchPlayers(name: string): Promise<CricAPIPlayerSearchResult[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/players?apikey=${apiKey()}&search=${encodeURIComponent(name)}&offset=0`
    )
    if (!res.ok) { console.error(`[CricAPI] /players ${res.status}`); return null }
    const json = await res.json()
    return (json.data ?? []).map((p: { id: string; name: string; country: string }) => ({
      id: p.id,
      name: p.name,
      country: p.country ?? "",
    }))
  } catch (err) {
    console.error(`[CricAPI] /players failed for "${name}":`, err)
    return null
  }
}

/**
 * Fetch match_points (Fantasy Points API).
 * Returns innings stats normalized to CricAPIScorecard shape + totals for ID-based player lookup.
 * Ignore totals[].points — we apply our own scoring engine.
 */
export async function fetchMatchPoints(matchId: string): Promise<CricAPIMatchPointsResult | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/match_points?apikey=${apiKey()}&id=${matchId}`
    )
    if (!res.ok) { console.error(`[CricAPI] /match_points ${res.status} for ${matchId}`); return null }
    const json = await res.json()
    const data = json.data
    if (!data) return null

    // Normalize match_points innings → CricAPIScorecard[]
    const innings: CricAPIScorecard[] = (data.innings ?? []).map(
      (inn: {
        batting?: Array<{ name: string; r: number; b: number; "4s": number; "6s": number }>
        bowling?: Array<{ name: string; o: number; m: number; r: number; w: number }>
        catching?: Array<{ name: string; catches?: number; stumpings?: number; runouts?: number }>
      }) => ({
        batting: (inn.batting ?? []).map((b) => ({
          batsman: { name: b.name },
          r: b.r ?? 0,
          b: b.b ?? 0,
          "4s": b["4s"] ?? 0,
          "6s": b["6s"] ?? 0,
        })),
        bowling: (inn.bowling ?? []).map((b) => ({
          bowler: { name: b.name },
          o: b.o ?? 0,
          m: b.m ?? 0,
          r: b.r ?? 0,
          w: b.w ?? 0,
        })),
        fielding: (inn.catching ?? []).map((f) => ({
          fielder: { name: f.name },
          catches: f.catches ?? 0,
          stumpings: f.stumpings ?? 0,
          runouts: f.runouts ?? 0,
        })),
      })
    )

    const totals: Array<{ id: string; name: string }> = (data.totals ?? []).map(
      (t: { id: string; name: string }) => ({ id: t.id, name: t.name })
    )

    return { innings, totals }
  } catch (err) {
    console.error(`[CricAPI] /match_points failed for ${matchId}:`, err)
    return null
  }
}

/** Fetch full series info including all matches with cricapi IDs — for schedule import */
export async function fetchSeriesInfo(seriesId: string): Promise<CricAPISeriesMatch[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/series_info?apikey=${apiKey()}&id=${seriesId}`
    )
    if (!res.ok) { console.error(`[CricAPI] /series_info ${res.status}`); return null }
    const json = await res.json()
    return json.data?.matchList ?? null
  } catch (err) {
    console.error(`[CricAPI] /series_info failed for ${seriesId}:`, err)
    return null
  }
}

/** Live score item from /cricScore endpoint */
export type CricScoreItem = {
  id: string
  ms: "fixture" | "live" | "result" | string
  t1s: string
  t2s: string
  series: string
}

/** Fetch all active match scores in one call (60s cache) */
export async function fetchCricScores(): Promise<CricScoreItem[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/cricScore?apikey=${apiKey()}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) { console.error(`[CricAPI] /cricScore ${res.status}`); return null }
    const json = await res.json()
    return json.data ?? null
  } catch (err) {
    console.error("[CricAPI] /cricScore failed:", err)
    return null
  }
}

/** Diagnostic: returns raw /match_points response for admin verification */
export async function testMatchPointsEndpoint(matchId: string): Promise<unknown> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/match_points?apikey=${apiKey()}&id=${matchId}`
  )
  if (!res.ok) return { error: res.status, statusText: res.statusText }
  return await res.json()
}

export function fuzzyMatchName(
  apiName: string,
  dbNames: Map<string, string>
): string | null {
  const normalized = normalizeName(apiName)

  // Exact match
  if (dbNames.has(normalized)) return dbNames.get(normalized)!

  // Partial match — check includes both directions
  for (const [dbNorm, dbId] of dbNames) {
    if (dbNorm.includes(normalized) || normalized.includes(dbNorm)) {
      return dbId
    }
  }

  // Last name match
  const apiLast = normalized.split(" ").pop() ?? ""
  for (const [dbNorm, dbId] of dbNames) {
    const dbLast = dbNorm.split(" ").pop() ?? ""
    if (apiLast === dbLast && apiLast.length > 3) {
      return dbId
    }
  }

  return null
}

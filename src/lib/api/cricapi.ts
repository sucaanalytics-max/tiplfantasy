export type CricAPIMatch = {
  id: string
  name: string
  status: string
  dateTimeGMT: string
  teams: string[]
  score?: Array<{ r: number; w: number; o: number; inning: string }>
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

export async function fetchMatches(): Promise<CricAPIMatch[] | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/currentMatches?apikey=${apiKey()}&offset=0`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export async function fetchScorecard(matchId: string): Promise<CricAPIScorecard[] | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/match_scorecard?apikey=${apiKey()}&id=${matchId}`
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.scorecard ?? null
  } catch {
    return null
  }
}

export async function fetchSquad(matchId: string): Promise<Array<{ name: string; id: string }> | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/match_squad?apikey=${apiKey()}&id=${matchId}`
    )
    if (!res.ok) return null
    const json = await res.json()
    const players: Array<{ name: string; id: string }> = []
    for (const team of json.data ?? []) {
      for (const p of team.players ?? []) {
        players.push({ name: p.name, id: p.id })
      }
    }
    return players
  } catch {
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

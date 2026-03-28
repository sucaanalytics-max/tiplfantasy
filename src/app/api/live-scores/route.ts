import { fetchCricScores } from "@/lib/api/sportmonks"
import { NextResponse } from "next/server"

export type LiveScoreEntry = {
  cricapiMatchId: string
  ms: "fixture" | "live" | "result" | string
  score1: string
  score2: string
}

export async function GET() {
  const scores = await fetchCricScores()
  if (!scores) {
    return NextResponse.json([], { status: 200 })
  }

  // SportMonks fetchCricScores() already filters to IPL
  const entries = scores.map((s) => ({
    cricapiMatchId: s.id,
    ms: s.ms,
    score1: s.t1s ?? "",
    score2: s.t2s ?? "",
  } satisfies LiveScoreEntry))

  return NextResponse.json(entries, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  })
}

import { fetchCricScores } from "@/lib/api/cricapi"
import { NextResponse } from "next/server"

const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"

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

  const ipl = scores
    .filter((s) => s.series === IPL_SERIES_ID)
    .map((s) => ({
      cricapiMatchId: s.id,
      ms: s.ms,
      score1: s.t1s ?? "",
      score2: s.t2s ?? "",
    } satisfies LiveScoreEntry))

  return NextResponse.json(ipl, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  })
}

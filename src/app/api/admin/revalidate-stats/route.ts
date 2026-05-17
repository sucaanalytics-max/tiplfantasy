import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  revalidateTag("user-data", "minutes")
  revalidateTag("league-data", "minutes")
  revalidateTag("player-stats", "hours")
  revalidateTag("leaderboard", "minutes")

  return NextResponse.json({
    revalidated: ["user-data", "league-data", "player-stats", "leaderboard"],
    at: new Date().toISOString(),
  })
}

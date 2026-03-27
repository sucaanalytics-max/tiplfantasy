import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runAutoPickForMatch } from "@/lib/auto-pick"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1. Lock matches whose start_time has passed
  await admin.rpc("auto_lock_matches")

  // 2. Find matches that went live in the last 3 minutes (cron window + buffer)
  const windowStart = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  const { data: recentlyLocked } = await admin
    .from("matches")
    .select("id")
    .eq("status", "live")
    .gte("updated_at", windowStart)

  // 3. Auto-pick for opted-in users who have no selection for each match
  const results: Array<{ matchId: string; processed: number; succeeded: number }> = []
  for (const match of recentlyLocked ?? []) {
    const result = await runAutoPickForMatch(match.id)
    results.push({ matchId: match.id, ...result })
  }

  return Response.json({ locked: recentlyLocked?.length ?? 0, results })
}

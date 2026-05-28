import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type Role = "WK" | "BAT" | "AR" | "BOWL"
type XIPlayer = { id: string; role: Role; team_id: string }

const ROLE_LIMITS: Record<Role, { min: number; max: number }> = {
  WK: { min: 1, max: 4 },
  BAT: { min: 3, max: 5 },
  AR: { min: 1, max: 3 },
  BOWL: { min: 3, max: 5 },
}
const MAX_PER_TEAM = 7

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildValidTeam(candidates: XIPlayer[]): string[] | null {
  const selected: XIPlayer[] = []
  const used = new Set<string>()
  const teamCount = new Map<string, number>()
  const roleCount: Record<Role, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }

  for (const role of ["WK", "BAT", "AR", "BOWL"] as const) {
    for (const p of candidates) {
      if (used.has(p.id) || p.role !== role) continue
      if ((teamCount.get(p.team_id) ?? 0) >= MAX_PER_TEAM) continue
      selected.push(p)
      used.add(p.id)
      roleCount[role]++
      teamCount.set(p.team_id, (teamCount.get(p.team_id) ?? 0) + 1)
      if (roleCount[role] >= ROLE_LIMITS[role].min) break
    }
    if (roleCount[role] < ROLE_LIMITS[role].min) return null
  }

  for (const p of candidates) {
    if (selected.length >= 11) break
    if (used.has(p.id)) continue
    if (roleCount[p.role] >= ROLE_LIMITS[p.role].max) continue
    if ((teamCount.get(p.team_id) ?? 0) >= MAX_PER_TEAM) continue
    selected.push(p)
    used.add(p.id)
    roleCount[p.role]++
    teamCount.set(p.team_id, (teamCount.get(p.team_id) ?? 0) + 1)
  }

  if (selected.length !== 11) return null
  return selected.map((p) => p.id)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json().catch(() => ({}))
    let matchIds: string[] = []

    if (body.match_id) {
      matchIds = [body.match_id]
    } else {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: lockedMatches } = await supabase
        .from("matches")
        .select("id")
        .eq("status", "live")
        .gte("updated_at", tenMinAgo)
      matchIds = (lockedMatches ?? []).map((m: { id: string }) => m.id)
    }

    if (matchIds.length === 0) {
      return new Response(JSON.stringify({ message: "No matches to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let totalAutoPicks = 0
    const perMatch: Array<{ match_id: string; created: number; skipped: number }> = []

    for (const matchId of matchIds) {
      const { data: match } = await supabase
        .from("matches")
        .select("team_home_id, team_away_id")
        .eq("id", matchId)
        .single()
      if (!match) continue

      const { data: xi } = await supabase
        .from("playing_xi")
        .select("player_id")
        .eq("match_id", matchId)
      const xiIds = (xi ?? []).map((r: { player_id: string }) => r.player_id)

      let playersQuery = supabase
        .from("players")
        .select("id, role, team_id")
        .in("team_id", [match.team_home_id, match.team_away_id])
        .eq("is_active", true)
      if (xiIds.length > 0) {
        playersQuery = playersQuery.in("id", xiIds)
      }
      const { data: poolRaw } = await playersQuery
      const pool = (poolRaw ?? []) as XIPlayer[]

      if (pool.length < 11) {
        perMatch.push({ match_id: matchId, created: 0, skipped: 0 })
        continue
      }

      const { data: allUsers } = await supabase.from("profiles").select("id")
      const { data: existingSelections } = await supabase
        .from("selections")
        .select("user_id")
        .eq("match_id", matchId)
      const submitted = new Set(
        (existingSelections ?? []).map((s: { user_id: string }) => s.user_id)
      )
      const missingUsers = (allUsers ?? []).filter(
        (u: { id: string }) => !submitted.has(u.id)
      )

      let created = 0
      let skipped = 0
      for (const user of missingUsers) {
        const teamIds = buildValidTeam(shuffle(pool))
        if (!teamIds) {
          skipped++
          continue
        }

        const { data: sel } = await supabase
          .from("selections")
          .insert({
            user_id: user.id,
            match_id: matchId,
            captain_id: null,
            vice_captain_id: null,
            is_auto_pick: true,
            locked_at: new Date().toISOString(),
          })
          .select("id")
          .single()

        if (!sel) {
          skipped++
          continue
        }

        await supabase.from("selection_players").insert(
          teamIds.map((pid) => ({ selection_id: sel.id, player_id: pid }))
        )
        created++
        totalAutoPicks++
      }

      perMatch.push({ match_id: matchId, created, skipped })
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches_processed: matchIds.length,
        auto_picks_created: totalAutoPicks,
        per_match: perMatch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

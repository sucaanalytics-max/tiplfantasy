import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Parse request body for match_id, or find all recently locked matches
    const body = await req.json().catch(() => ({}))
    let matchIds: string[] = []

    if (body.match_id) {
      matchIds = [body.match_id]
    } else {
      // Find matches locked in the last 10 minutes
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

    for (const matchId of matchIds) {
      // Get all users (profiles)
      const { data: allUsers } = await supabase.from("profiles").select("id")
      if (!allUsers) continue

      // Get users who already have a selection
      const { data: existingSelections } = await supabase
        .from("selections")
        .select("user_id")
        .eq("match_id", matchId)

      const usersWithSelection = new Set(
        (existingSelections ?? []).map((s: { user_id: string }) => s.user_id)
      )

      // Users missing a selection
      const missingUsers = allUsers.filter(
        (u: { id: string }) => !usersWithSelection.has(u.id)
      )

      if (missingUsers.length === 0) continue

      // Get match teams
      const { data: match } = await supabase
        .from("matches")
        .select("team_home_id, team_away_id, match_number")
        .eq("id", matchId)
        .single()

      if (!match) continue

      // Get previous match (by match_number)
      const { data: prevMatch } = await supabase
        .from("matches")
        .select("id")
        .lt("match_number", match.match_number)
        .order("match_number", { ascending: false })
        .limit(1)
        .single()

      // Build fallback: most-selected players for this match
      let fallbackPlayerIds: string[] = []
      if (existingSelections && existingSelections.length > 0) {
        const selIds = (existingSelections as { user_id: string }[]).map(
          (s) => s.user_id
        )
        // Get all selections for counting
        const { data: allSels } = await supabase
          .from("selections")
          .select("id")
          .eq("match_id", matchId)

        if (allSels && allSels.length > 0) {
          const { data: selPlayers } = await supabase
            .from("selection_players")
            .select("player_id")
            .in(
              "selection_id",
              allSels.map((s: { id: string }) => s.id)
            )

          // Count occurrences
          const counts = new Map<string, number>()
          for (const sp of selPlayers ?? []) {
            counts.set(sp.player_id, (counts.get(sp.player_id) ?? 0) + 1)
          }

          // Sort by count descending, take top 11
          fallbackPlayerIds = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 11)
            .map(([id]) => id)
        }
      }

      // If still no fallback, pick 11 random active players from match teams
      if (fallbackPlayerIds.length < 11) {
        const { data: teamPlayers } = await supabase
          .from("players")
          .select("id")
          .in("team_id", [match.team_home_id, match.team_away_id])
          .eq("is_active", true)
          .limit(11)

        fallbackPlayerIds = (teamPlayers ?? []).map((p: { id: string }) => p.id)
      }

      for (const user of missingUsers) {
        let playerIds: string[] = []

        // Try to copy previous selection
        if (prevMatch) {
          const { data: prevSel } = await supabase
            .from("selections")
            .select("id")
            .eq("user_id", user.id)
            .eq("match_id", prevMatch.id)
            .single()

          if (prevSel) {
            const { data: prevPlayers } = await supabase
              .from("selection_players")
              .select("player_id")
              .eq("selection_id", prevSel.id)

            if (prevPlayers && prevPlayers.length === 11) {
              playerIds = prevPlayers.map((p: { player_id: string }) => p.player_id)
            }
          }
        }

        // Fallback to most-selected
        if (playerIds.length < 11) {
          playerIds = fallbackPlayerIds
        }

        if (playerIds.length === 0) continue

        // Insert auto-pick selection (no captain/VC)
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

        if (sel) {
          await supabase.from("selection_players").insert(
            playerIds.map((pid: string) => ({
              selection_id: sel.id,
              player_id: pid,
            }))
          )
          totalAutoPicks++
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches_processed: matchIds.length,
        auto_picks_created: totalAutoPicks,
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

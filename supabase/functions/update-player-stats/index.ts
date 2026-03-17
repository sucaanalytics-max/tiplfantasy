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

    const body = await req.json().catch(() => ({}))
    const matchId = body.match_id
    if (!matchId) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch match details (venue, teams, start_time)
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("*, team_home:teams!matches_team_home_id_fkey(short_name), team_away:teams!matches_team_away_id_fkey(short_name)")
      .eq("id", matchId)
      .single()

    if (matchErr || !match) {
      return new Response(JSON.stringify({ error: "Match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const season = new Date(match.start_time).getFullYear()
    const venue = match.venue

    // Fetch all player scores for this match
    const { data: scores } = await supabase
      .from("match_player_scores")
      .select("*, player:players(team_id)")
      .eq("match_id", matchId)

    if (!scores || scores.length === 0) {
      return new Response(JSON.stringify({ error: "No scores found for match" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const homeTeamId = match.team_home_id
    const awayTeamId = match.team_away_id
    const homeShort = match.team_home.short_name
    const awayShort = match.team_away.short_name

    let seasonUpserts = 0
    let venueUpserts = 0
    let vsTeamUpserts = 0

    for (const score of scores) {
      const pid = score.player_id
      const playerTeamId = score.player?.team_id
      const opponentTeam = playerTeamId === homeTeamId ? awayShort : homeShort

      // Convert overs bowled (e.g. 3.4 means 3 overs 4 balls = 22 balls total)
      // Store as decimal overs for consistency with existing data
      const oversNum = Number(score.overs_bowled) || 0

      // --- Season stats upsert ---
      const { data: existingSeason } = await supabase
        .from("player_season_stats")
        .select("*")
        .eq("player_id", pid)
        .eq("season", season)
        .single()

      if (existingSeason) {
        await supabase
          .from("player_season_stats")
          .update({
            matches: existingSeason.matches + 1,
            innings: existingSeason.innings + (score.balls_faced > 0 ? 1 : 0),
            runs: existingSeason.runs + score.runs,
            balls_faced: existingSeason.balls_faced + score.balls_faced,
            fours: existingSeason.fours + score.fours,
            sixes: existingSeason.sixes + score.sixes,
            highest_score: Math.max(existingSeason.highest_score, score.runs),
            fifties: existingSeason.fifties + (score.runs >= 50 && score.runs < 100 ? 1 : 0),
            hundreds: existingSeason.hundreds + (score.runs >= 100 ? 1 : 0),
            wickets: existingSeason.wickets + score.wickets,
            overs_bowled: Number(existingSeason.overs_bowled) + oversNum,
            runs_conceded: existingSeason.runs_conceded + score.runs_conceded,
            maidens: existingSeason.maidens + score.maidens,
            catches: existingSeason.catches + score.catches,
            stumpings: existingSeason.stumpings + score.stumpings,
            run_outs: existingSeason.run_outs + score.run_outs,
          })
          .eq("id", existingSeason.id)
      } else {
        await supabase.from("player_season_stats").insert({
          player_id: pid,
          season,
          matches: 1,
          innings: score.balls_faced > 0 ? 1 : 0,
          runs: score.runs,
          balls_faced: score.balls_faced,
          fours: score.fours,
          sixes: score.sixes,
          highest_score: score.runs,
          fifties: score.runs >= 50 && score.runs < 100 ? 1 : 0,
          hundreds: score.runs >= 100 ? 1 : 0,
          not_outs: 0,
          wickets: score.wickets,
          overs_bowled: oversNum,
          runs_conceded: score.runs_conceded,
          maidens: score.maidens,
          catches: score.catches,
          stumpings: score.stumpings,
          run_outs: score.run_outs,
        })
      }
      seasonUpserts++

      // --- Venue stats upsert ---
      const { data: existingVenue } = await supabase
        .from("player_venue_stats")
        .select("*")
        .eq("player_id", pid)
        .eq("venue", venue)
        .single()

      if (existingVenue) {
        await supabase
          .from("player_venue_stats")
          .update({
            matches: existingVenue.matches + 1,
            runs: existingVenue.runs + score.runs,
            balls_faced: existingVenue.balls_faced + score.balls_faced,
            wickets: existingVenue.wickets + score.wickets,
            overs_bowled: Number(existingVenue.overs_bowled) + oversNum,
            runs_conceded: existingVenue.runs_conceded + score.runs_conceded,
          })
          .eq("id", existingVenue.id)
      } else {
        await supabase.from("player_venue_stats").insert({
          player_id: pid,
          venue,
          matches: 1,
          runs: score.runs,
          balls_faced: score.balls_faced,
          wickets: score.wickets,
          overs_bowled: oversNum,
          runs_conceded: score.runs_conceded,
        })
      }
      venueUpserts++

      // --- Vs-team stats upsert ---
      const { data: existingVsTeam } = await supabase
        .from("player_vs_team_stats")
        .select("*")
        .eq("player_id", pid)
        .eq("opponent_team", opponentTeam)
        .single()

      if (existingVsTeam) {
        await supabase
          .from("player_vs_team_stats")
          .update({
            matches: existingVsTeam.matches + 1,
            runs: existingVsTeam.runs + score.runs,
            balls_faced: existingVsTeam.balls_faced + score.balls_faced,
            wickets: existingVsTeam.wickets + score.wickets,
            overs_bowled: Number(existingVsTeam.overs_bowled) + oversNum,
            runs_conceded: existingVsTeam.runs_conceded + score.runs_conceded,
          })
          .eq("id", existingVsTeam.id)
      } else {
        await supabase.from("player_vs_team_stats").insert({
          player_id: pid,
          opponent_team: opponentTeam,
          matches: 1,
          runs: score.runs,
          balls_faced: score.balls_faced,
          wickets: score.wickets,
          overs_bowled: oversNum,
          runs_conceded: score.runs_conceded,
        })
      }
      vsTeamUpserts++
    }

    // --- Update form indicators ---
    const playerIds = scores.map((s: { player_id: string }) => s.player_id)
    for (const pid of playerIds) {
      const { data: recentScores } = await supabase
        .from("match_player_scores")
        .select("fantasy_points")
        .eq("player_id", pid)
        .order("created_at", { ascending: false })
        .limit(5)

      if (recentScores && recentScores.length >= 3) {
        const avg = recentScores.reduce((a: number, s: { fantasy_points: number }) => a + s.fantasy_points, 0) / recentScores.length
        const consecutive25 = recentScores.slice(0, 3).every((s: { fantasy_points: number }) => s.fantasy_points > 25)
        let indicator = "neutral"
        if (avg > 40 || consecutive25) indicator = "hot"
        else if (avg < 15) indicator = "cold"

        await supabase
          .from("players")
          .update({ form_indicator: indicator })
          .eq("id", pid)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        players: scores.length,
        season_upserts: seasonUpserts,
        venue_upserts: venueUpserts,
        vs_team_upserts: vsTeamUpserts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

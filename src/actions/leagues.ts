"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { LeagueWithMemberCount, LeagueLeaderboardEntry, LeagueMemberStats } from "@/lib/types"
import crypto from "crypto"

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("base64url").slice(0, 6).toUpperCase()
}

export async function createLeague(name: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { error: "League name must be 2-40 characters" }
  }

  // Generate unique invite code with retry
  const admin = createAdminClient()
  let inviteCode = generateInviteCode()
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin
      .from("leagues")
      .select("id")
      .eq("invite_code", inviteCode)
      .single()
    if (!existing) break
    inviteCode = generateInviteCode()
  }

  const { data: league, error } = await admin
    .from("leagues")
    .insert({ name: trimmed, invite_code: inviteCode, creator_id: user.id })
    .select()
    .single()

  if (error) return { error: "Failed to create league" }

  // Auto-join creator
  await admin
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id })

  return { data: league }
}

export async function joinLeague(inviteCode: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const code = inviteCode.trim().toUpperCase()
  if (code.length !== 6) return { error: "Invalid invite code" }

  // Use admin client to look up league by code (bypasses RLS)
  const admin = createAdminClient()
  const { data: league } = await admin
    .from("leagues")
    .select("id, name")
    .eq("invite_code", code)
    .single()

  if (!league) return { error: "League not found" }

  // Check if already a member
  const { data: existing } = await admin
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .single()

  if (existing) return { error: "You're already in this league" }

  const { error } = await admin
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id })

  if (error) return { error: "Failed to join league" }
  return { data: league }
}

export async function leaveLeague(leagueId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Check if user is creator
  const admin = createAdminClient()
  const { data: league } = await admin
    .from("leagues")
    .select("creator_id")
    .eq("id", leagueId)
    .single()

  if (league?.creator_id === user.id) {
    return { error: "Creator cannot leave. Delete the league instead." }
  }

  await admin
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id)

  return { success: true }
}

export async function deleteLeague(leagueId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: league } = await admin
    .from("leagues")
    .select("creator_id")
    .eq("id", leagueId)
    .single()

  if (!league) return { error: "League not found" }
  if (league.creator_id !== user.id) return { error: "Only the creator can delete" }

  await admin.from("leagues").delete().eq("id", leagueId)
  return { success: true }
}

export async function getMyLeagues(): Promise<LeagueWithMemberCount[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id)
    .limit(50)

  if (!memberships || memberships.length === 0) return []

  const leagueIds = memberships.map((m) => m.league_id)

  const { data: leagues } = await admin
    .from("leagues")
    .select("*")
    .in("id", leagueIds)
    .order("created_at", { ascending: false })
    .limit(50)

  if (!leagues) return []

  // Get member counts
  const result: LeagueWithMemberCount[] = []
  for (const league of leagues) {
    const { count } = await admin
      .from("league_members")
      .select("*", { count: "exact", head: true })
      .eq("league_id", league.id)
    result.push({ ...league, member_count: count ?? 0 })
  }

  return result
}

export async function getLeagueWithMembers(leagueId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Verify user is member
  const { data: membership } = await admin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single()

  if (!membership) return null

  const { data: league } = await admin
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single()

  if (!league) return null

  const { data: members } = await admin
    .from("league_members")
    .select("user_id, joined_at, profile:profiles(display_name, avatar_url)")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true })
    .limit(200)

  return { league, members: members ?? [], isCreator: league.creator_id === user.id }
}

export async function getLeagueLeaderboard(
  leagueId: string
): Promise<LeagueLeaderboardEntry[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_league_leaderboard", {
    p_league_id: leagueId,
  })
  if (error) return []
  return (data ?? []) as LeagueLeaderboardEntry[]
}

export async function getLeagueAwards(leagueId: string): Promise<LeagueMemberStats[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_league_awards", {
    p_league_id: leagueId,
  })
  if (error) return []
  return (data ?? []) as LeagueMemberStats[]
}

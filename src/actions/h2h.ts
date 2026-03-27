"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
  if (!profile?.is_admin) throw new Error("Not admin")
  return user.id
}

// ─── User Actions ───────────────────────────────────────────

export async function getTokenBalance(): Promise<number> {
  const userId = await requireAuth()
  const admin = createAdminClient()
  const { data } = await admin
    .from("user_tokens")
    .select("balance")
    .eq("user_id", userId)
    .single()
  return data?.balance ?? 0
}

export async function createChallenge(
  matchId: string,
  wager: number,
  opponentId?: string
): Promise<{ success?: boolean; error?: string }> {
  const userId = await requireAuth()
  const admin = createAdminClient()

  if (wager <= 0) return { error: "Wager must be positive" }

  // Can't challenge yourself
  if (opponentId === userId) return { error: "Cannot challenge yourself" }

  // Check match is upcoming
  const { data: match } = await admin
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single()
  if (!match) return { error: "Match not found" }
  if (match.status !== "upcoming") return { error: "Match is not upcoming" }

  // Check balance
  const { data: tokens } = await admin
    .from("user_tokens")
    .select("balance")
    .eq("user_id", userId)
    .single()
  const balance = tokens?.balance ?? 0
  if (balance < wager) return { error: `Insufficient tokens (have ${balance}, need ${wager})` }

  // Deduct wager
  await admin
    .from("user_tokens")
    .update({ balance: balance - wager, updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  // Create challenge
  const { data: challenge, error: challengeError } = await admin
    .from("h2h_challenges")
    .insert({
      match_id: matchId,
      challenger_id: userId,
      opponent_id: opponentId ?? null,
      wager,
      status: "open",
    })
    .select("id")
    .single()

  if (challengeError) {
    // Refund on failure
    await admin
      .from("user_tokens")
      .update({ balance, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
    return { error: challengeError.message }
  }

  // Log transaction
  await admin.from("token_transactions").insert({
    user_id: userId,
    amount: -wager,
    type: "h2h_wager",
    reference_id: challenge.id,
    note: `Wager on H2H challenge`,
  })

  return { success: true }
}

export async function acceptChallenge(
  challengeId: string
): Promise<{ success?: boolean; error?: string }> {
  const userId = await requireAuth()
  const admin = createAdminClient()

  const { data: challenge } = await admin
    .from("h2h_challenges")
    .select("*")
    .eq("id", challengeId)
    .single()

  if (!challenge) return { error: "Challenge not found" }
  if (challenge.status !== "open") return { error: "Challenge is not open" }
  if (challenge.challenger_id === userId) return { error: "Cannot accept your own challenge" }
  if (challenge.opponent_id && challenge.opponent_id !== userId) {
    return { error: "This challenge is for a specific opponent" }
  }

  // Check match is still upcoming
  const { data: match } = await admin
    .from("matches")
    .select("status")
    .eq("id", challenge.match_id)
    .single()
  if (match?.status !== "upcoming") return { error: "Match is no longer upcoming" }

  // Check balance
  const { data: tokens } = await admin
    .from("user_tokens")
    .select("balance")
    .eq("user_id", userId)
    .single()
  const balance = tokens?.balance ?? 0
  if (balance < challenge.wager) {
    return { error: `Insufficient tokens (have ${balance}, need ${challenge.wager})` }
  }

  // Deduct wager
  await admin
    .from("user_tokens")
    .update({ balance: balance - challenge.wager, updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  // Update challenge
  const { error: updateError } = await admin
    .from("h2h_challenges")
    .update({ opponent_id: userId, status: "accepted" })
    .eq("id", challengeId)

  if (updateError) {
    // Refund on failure
    await admin
      .from("user_tokens")
      .update({ balance, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
    return { error: updateError.message }
  }

  // Log transaction
  await admin.from("token_transactions").insert({
    user_id: userId,
    amount: -challenge.wager,
    type: "h2h_wager",
    reference_id: challengeId,
    note: `Accepted H2H challenge`,
  })

  return { success: true }
}

export async function cancelChallenge(
  challengeId: string
): Promise<{ success?: boolean; error?: string }> {
  const userId = await requireAuth()
  const admin = createAdminClient()

  const { data: challenge } = await admin
    .from("h2h_challenges")
    .select("*")
    .eq("id", challengeId)
    .single()

  if (!challenge) return { error: "Challenge not found" }
  if (challenge.challenger_id !== userId) return { error: "Not your challenge" }
  if (challenge.status !== "open") return { error: "Can only cancel open challenges" }

  // Refund wager
  const { data: tokens } = await admin
    .from("user_tokens")
    .select("balance")
    .eq("user_id", userId)
    .single()
  const balance = tokens?.balance ?? 0

  await admin
    .from("user_tokens")
    .update({ balance: balance + challenge.wager, updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  await admin
    .from("h2h_challenges")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", challengeId)

  await admin.from("token_transactions").insert({
    user_id: userId,
    amount: challenge.wager,
    type: "h2h_refund",
    reference_id: challengeId,
    note: "Cancelled H2H challenge",
  })

  return { success: true }
}

export async function getOpenChallenges(matchId?: string) {
  const admin = createAdminClient()
  let query = admin
    .from("h2h_challenges")
    .select("*, challenger:profiles!h2h_challenges_challenger_id_fkey(display_name), opponent:profiles!h2h_challenges_opponent_id_fkey(display_name), match:matches(match_number, team_home_id, team_away_id, start_time)")
    .eq("status", "open")
    .order("created_at", { ascending: false })

  if (matchId) query = query.eq("match_id", matchId)
  const { data } = await query.limit(500)
  return data ?? []
}

export async function getMyChallenges() {
  const userId = await requireAuth()
  const admin = createAdminClient()
  const { data } = await admin
    .from("h2h_challenges")
    .select("*, challenger:profiles!h2h_challenges_challenger_id_fkey(display_name), opponent:profiles!h2h_challenges_opponent_id_fkey(display_name), match:matches(match_number, team_home_id, team_away_id, start_time, status)")
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(500)
  return data ?? []
}

// ─── Resolution (called after match scoring) ─────────────────

export async function resolveMatchChallenges(matchId: string) {
  const admin = createAdminClient()

  // Get all accepted challenges for this match
  const { data: challenges } = await admin
    .from("h2h_challenges")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "accepted")

  if (!challenges || challenges.length === 0) return

  // Get user match scores for this match
  const userIds = new Set<string>()
  for (const c of challenges) {
    userIds.add(c.challenger_id)
    if (c.opponent_id) userIds.add(c.opponent_id)
  }

  const { data: scores } = await admin
    .from("user_match_scores")
    .select("user_id, total_points")
    .eq("match_id", matchId)
    .in("user_id", [...userIds])

  const scoreMap = new Map((scores ?? []).map((s) => [s.user_id, s.total_points]))

  for (const challenge of challenges) {
    const challengerScore = scoreMap.get(challenge.challenger_id) ?? 0
    const opponentScore = scoreMap.get(challenge.opponent_id!) ?? 0
    const pot = challenge.wager * 2

    let winnerId: string | null = null

    if (challengerScore > opponentScore) {
      winnerId = challenge.challenger_id
    } else if (opponentScore > challengerScore) {
      winnerId = challenge.opponent_id
    }

    if (winnerId) {
      // Winner takes the pot
      const { data: winnerTokens } = await admin
        .from("user_tokens")
        .select("balance")
        .eq("user_id", winnerId)
        .single()
      await admin
        .from("user_tokens")
        .update({
          balance: (winnerTokens?.balance ?? 0) + pot,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", winnerId)

      await admin.from("token_transactions").insert({
        user_id: winnerId,
        amount: pot,
        type: "h2h_win",
        reference_id: challenge.id,
        note: `Won H2H challenge (${challengerScore} vs ${opponentScore})`,
      })
    } else {
      // Draw — refund both
      for (const uid of [challenge.challenger_id, challenge.opponent_id!]) {
        const { data: t } = await admin
          .from("user_tokens")
          .select("balance")
          .eq("user_id", uid)
          .single()
        await admin
          .from("user_tokens")
          .update({
            balance: (t?.balance ?? 0) + challenge.wager,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", uid)

        await admin.from("token_transactions").insert({
          user_id: uid,
          amount: challenge.wager,
          type: "h2h_refund",
          reference_id: challenge.id,
          note: `Draw in H2H challenge (${challengerScore} each)`,
        })
      }
    }

    // Mark challenge resolved
    await admin
      .from("h2h_challenges")
      .update({
        status: "completed",
        winner_id: winnerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", challenge.id)
  }

  // Expire unaccepted open challenges for this match
  const { data: openChallenges } = await admin
    .from("h2h_challenges")
    .select("id, challenger_id, wager")
    .eq("match_id", matchId)
    .eq("status", "open")

  for (const oc of openChallenges ?? []) {
    // Refund challenger
    const { data: t } = await admin
      .from("user_tokens")
      .select("balance")
      .eq("user_id", oc.challenger_id)
      .single()
    await admin
      .from("user_tokens")
      .update({
        balance: (t?.balance ?? 0) + oc.wager,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", oc.challenger_id)

    await admin.from("token_transactions").insert({
      user_id: oc.challenger_id,
      amount: oc.wager,
      type: "h2h_refund",
      reference_id: oc.id,
      note: "Expired H2H challenge (match started)",
    })

    await admin
      .from("h2h_challenges")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", oc.id)
  }
}

// ─── Admin Actions ──────────────────────────────────────────

export async function grantTokens(
  userId: string,
  amount: number
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  // Upsert balance
  const { data: existing } = await admin
    .from("user_tokens")
    .select("balance")
    .eq("user_id", userId)
    .single()

  if (existing) {
    await admin
      .from("user_tokens")
      .update({ balance: existing.balance + amount, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
  } else {
    await admin.from("user_tokens").insert({ user_id: userId, balance: amount })
  }

  await admin.from("token_transactions").insert({
    user_id: userId,
    amount,
    type: "admin_grant",
    note: `Admin granted ${amount} tokens`,
  })

  return { success: true }
}

export async function bulkGrantTokens(
  amount: number
): Promise<{ success?: boolean; error?: string; count?: number }> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .limit(200)

  if (!profiles) return { error: "Failed to load users" }

  for (const p of profiles) {
    const { data: existing } = await admin
      .from("user_tokens")
      .select("balance")
      .eq("user_id", p.id)
      .single()

    if (existing) {
      await admin
        .from("user_tokens")
        .update({ balance: existing.balance + amount, updated_at: new Date().toISOString() })
        .eq("user_id", p.id)
    } else {
      await admin.from("user_tokens").insert({ user_id: p.id, balance: amount })
    }

    await admin.from("token_transactions").insert({
      user_id: p.id,
      amount,
      type: "admin_grant",
      note: `Bulk grant: ${amount} tokens`,
    })
  }

  return { success: true, count: profiles.length }
}

export async function getAllBalances() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from("user_tokens")
    .select("user_id, balance, profile:profiles(display_name)")
    .order("balance", { ascending: false })
    .limit(200)
  return data ?? []
}

import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!
const VAPID_SUBJECT = "mailto:admin@tiplfantasy.vercel.app"

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send a push notification to all subscribed users.
 * Non-critical — errors are silently ignored.
 */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  return 0 // Push notifications disabled
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0

  const admin = createAdminClient()
  const { data: subs } = await admin.from("push_subscriptions").select("*")
  if (!subs || subs.length === 0) return 0

  let sent = 0
  const staleIds: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      // 410 Gone or 404 = subscription expired, clean up
      if (statusCode === 410 || statusCode === 404) {
        staleIds.push(sub.id)
      }
    }
  }

  // Clean up expired subscriptions
  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds)
  }

  return sent
}

/**
 * Send push to specific user IDs only.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  return 0 // Push notifications disabled
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds)

  if (!subs || subs.length === 0) return 0

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      sent++
    } catch {
      // silently ignore
    }
  }
  return sent
}

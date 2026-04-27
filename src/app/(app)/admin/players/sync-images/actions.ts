"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSportmonksPlayer } from "@/lib/api/sportmonks"

const BUCKET = "player-photos"
const SLEEP_BETWEEN_CALLS_MS = 350 // ~170 req/min — under Sportmonks free tier

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()
  if (!profile?.is_admin) throw new Error("Not an admin")
  return user.id
}

export type DryRunRow = {
  player_id: string
  name: string
  cricapi_id: string | null
  has_existing_image: boolean
  sportmonks_image: string | null
  status: "ok" | "no-cricapi-id" | "fetch-failed" | "no-image"
}

export type DryRunResult = {
  totalPlayers: number
  withCricapiId: number
  withExistingImage: number
  sampleRows: DryRunRow[]
  sampleSize: number
  ok: number
  noImage: number
  fetchFailed: number
}

/**
 * Sample-mode dry run: fetches Sportmonks player metadata for the first N
 * players that have a cricapi_id, reports image_path coverage. No writes.
 */
export async function runSportmonksDryRun(sampleSize = 20): Promise<DryRunResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: players } = await admin
    .from("players")
    .select("id, name, cricapi_id, image_url")
    .order("name", { ascending: true })

  const list = players ?? []
  const totalPlayers = list.length
  const withCricapiId = list.filter((p) => p.cricapi_id).length
  const withExistingImage = list.filter((p) => p.image_url).length

  // Sample first N that need an image AND have a cricapi_id
  const candidates = list.filter((p) => p.cricapi_id && !p.image_url).slice(0, sampleSize)

  const rows: DryRunRow[] = []
  for (const p of candidates) {
    if (!p.cricapi_id) {
      rows.push({
        player_id: p.id,
        name: p.name,
        cricapi_id: null,
        has_existing_image: false,
        sportmonks_image: null,
        status: "no-cricapi-id",
      })
      continue
    }
    const sm = await fetchSportmonksPlayer(p.cricapi_id)
    if (!sm) {
      rows.push({
        player_id: p.id,
        name: p.name,
        cricapi_id: p.cricapi_id,
        has_existing_image: false,
        sportmonks_image: null,
        status: "fetch-failed",
      })
    } else if (!sm.image_path) {
      rows.push({
        player_id: p.id,
        name: p.name,
        cricapi_id: p.cricapi_id,
        has_existing_image: false,
        sportmonks_image: null,
        status: "no-image",
      })
    } else {
      rows.push({
        player_id: p.id,
        name: p.name,
        cricapi_id: p.cricapi_id,
        has_existing_image: false,
        sportmonks_image: sm.image_path,
        status: "ok",
      })
    }
    await sleep(SLEEP_BETWEEN_CALLS_MS)
  }

  return {
    totalPlayers,
    withCricapiId,
    withExistingImage,
    sampleRows: rows,
    sampleSize: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    noImage: rows.filter((r) => r.status === "no-image").length,
    fetchFailed: rows.filter((r) => r.status === "fetch-failed").length,
  }
}

export type LiveSyncResult = {
  attempted: number
  uploaded: number
  failed: number
  skipped: number
  errors: { player_id: string; name: string; reason: string }[]
}

/**
 * Live sync: for every player with a cricapi_id and no image_url, fetch
 * Sportmonks image_path → download → upload to Supabase Storage → write
 * players.image_url. Skips players that already have an image. Idempotent.
 */
export async function runLiveSportmonksSync(limit = 100): Promise<LiveSyncResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: players } = await admin
    .from("players")
    .select("id, name, cricapi_id, image_url")
    .order("name", { ascending: true })

  const candidates = (players ?? [])
    .filter((p) => p.cricapi_id && !p.image_url)
    .slice(0, limit)

  const result: LiveSyncResult = {
    attempted: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  for (const p of candidates) {
    result.attempted++
    if (!p.cricapi_id) {
      result.skipped++
      continue
    }
    try {
      const sm = await fetchSportmonksPlayer(p.cricapi_id)
      if (!sm?.image_path) {
        result.skipped++
        await sleep(SLEEP_BETWEEN_CALLS_MS)
        continue
      }

      // Download
      const imgRes = await fetch(sm.image_path)
      if (!imgRes.ok) throw new Error(`download ${imgRes.status}`)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      const contentType = imgRes.headers.get("content-type") ?? "image/png"
      const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png"
      const path = `${p.id}.${ext}`

      // Upload to Supabase Storage (upsert)
      const { error: uploadErr } = await admin.storage
        .from(BUCKET)
        .upload(path, buf, { contentType, upsert: true })
      if (uploadErr) throw new Error(`upload: ${uploadErr.message}`)

      // Public URL
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
      const publicUrl = pub.publicUrl

      // Write DB
      const { error: dbErr } = await admin
        .from("players")
        .update({ image_url: publicUrl })
        .eq("id", p.id)
      if (dbErr) throw new Error(`db: ${dbErr.message}`)

      result.uploaded++
    } catch (e) {
      result.failed++
      result.errors.push({
        player_id: p.id,
        name: p.name,
        reason: (e as Error).message,
      })
    }
    await sleep(SLEEP_BETWEEN_CALLS_MS)
  }

  return result
}

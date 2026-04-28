import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SyncImagesClient } from "./sync-client"

export default async function SyncImagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
  if (!profile?.is_admin) redirect("/")

  // Initial coverage stats
  const admin = createAdminClient()
  const { data: players } = await admin
    .from("players")
    .select("id, cricapi_id, image_url")
    .limit(500)

  const list = players ?? []
  const initialStats = {
    totalPlayers: list.length,
    withCricapiId: list.filter((p) => p.cricapi_id).length,
    withExistingImage: list.filter((p) => p.image_url).length,
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/players">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Back to players">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight uppercase">Sync Player Images</h1>
          <p className="text-2xs text-muted-foreground mt-0.5">
            One-time admin sync to populate <code>players.image_url</code> from Sportmonks.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-3">
        <p className="text-xs text-status-warning font-semibold mb-1">Setup required first</p>
        <ul className="text-2xs text-muted-foreground space-y-0.5 list-disc list-inside">
          <li>
            Run <code>npx supabase db push</code> to apply migration{" "}
            <code>036_player_photos_bucket.sql</code> (creates the bucket).
          </li>
          <li>
            Confirm <code>SPORTMONKS_TOKEN</code> is set in Vercel env vars.
          </li>
          <li>Start with the dry-run before live sync.</li>
        </ul>
      </div>

      <SyncImagesClient initialStats={initialStats} />
    </div>
  )
}

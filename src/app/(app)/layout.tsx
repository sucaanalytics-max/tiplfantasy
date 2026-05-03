import { AppShell } from "@/components/app-shell"
import { getMyProfile } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = createAdminClient()
  const [profile, liveMatchRes] = await Promise.all([
    getMyProfile(),
    admin.from("matches").select("id").eq("status", "live").limit(1).maybeSingle(),
  ])
  return (
    <AppShell isAdmin={profile?.is_admin ?? false} liveMatchId={liveMatchRes.data?.id ?? null}>
      {children}
    </AppShell>
  )
}

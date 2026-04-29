import { AppShell } from "@/components/app-shell"
import { getMyProfile } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getMyProfile()
  return (
    <AppShell isAdmin={profile?.is_admin ?? false}>
      {children}
    </AppShell>
  )
}

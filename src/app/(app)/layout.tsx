import { NavBar } from "@/components/nav-bar"
import { InstallPrompt } from "@/components/install-prompt"
import { PushPrompt } from "@/components/push-prompt"
import { getMyProfile } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getMyProfile()
  const isAdmin = profile?.is_admin ?? false

  return (
    <>
      <NavBar isAdmin={isAdmin} />
      <main className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0 md:pl-56">
        {children}
      </main>
      <InstallPrompt />
      <PushPrompt />
    </>
  )
}

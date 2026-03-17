import { NavBar } from "@/components/nav-bar"
import { InstallPrompt } from "@/components/install-prompt"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
    isAdmin = data?.is_admin ?? false
  }

  return (
    <>
      <NavBar isAdmin={isAdmin} />
      <main className="min-h-dvh pb-16 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0 md:pl-56">
        {children}
      </main>
      <InstallPrompt />
    </>
  )
}

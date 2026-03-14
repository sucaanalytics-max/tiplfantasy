import { NavBar } from "@/components/nav-bar"
import { InstallPrompt } from "@/components/install-prompt"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavBar />
      <main className="min-h-dvh pb-16 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0 md:pl-56">
        {children}
      </main>
      <InstallPrompt />
    </>
  )
}

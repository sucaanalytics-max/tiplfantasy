"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Swords,
  Trophy,
  Users,
  User,
  Shield,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/leagues", label: "Leagues", icon: Users },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
]

const adminItem = { href: "/admin", label: "Admin", icon: Shield }

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_admin) setIsAdmin(true)
        })
    })
  }, [])

  const isActive = (href: string) => pathname.startsWith(href)

  const items = isAdmin ? [...navItems, adminItem] : navItems

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <>
      {/* Mobile bottom nav */}
      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-center justify-around h-14">
          {items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] text-xs transition-colors relative",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px]">{item.label}</span>
                {active && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside aria-label="Sidebar navigation" className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-56 flex-col border-r border-white/[0.06] bg-background/60 backdrop-blur-xl">
        <div className="p-4 pb-6 flex items-center gap-3">
          <Image
            src="/icons/icon-192.png"
            alt="TIPL"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary">TIPL</h1>
            <p className="text-xs text-muted-foreground">Fantasy Cricket 2026</p>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_oklch(0.75_0.15_220/0.15)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-white/[0.06] space-y-1">
          <ThemeToggle showLabel className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full" />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}

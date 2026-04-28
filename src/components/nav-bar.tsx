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
  BookOpen,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/leagues", label: "Leagues", icon: Users },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
]

const sidebarNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/leagues", label: "Leagues", icon: Users },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/rules", label: "Rules", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
]

const adminItem = { href: "/admin", label: "Admin", icon: Shield }

export function NavBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => pathname.startsWith(href)

  const mobileItems = isAdmin ? [...mobileNavItems, adminItem] : mobileNavItems

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <>
      {/* Mobile bottom nav */}
      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-overlay-border pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-center justify-around h-14 px-1">
          {mobileItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] h-11 px-2.5 rounded-full text-xs transition-all",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-overlay-subtle"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} aria-hidden="true" />
                <span className={cn("text-[10px] leading-none", active && "font-semibold")}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside aria-label="Sidebar navigation" className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-56 flex-col glass-subtle border-r border-overlay-border">
        <div className="p-4 pb-6 flex items-center gap-3">
          <Image
            src="/icons/icon-192.png"
            alt="TIPL"
            width={44}
            height={44}
          />
          <div>
            <h1 className="text-xl font-bold italic tracking-tight text-primary font-display">TIPL <span className="not-italic text-foreground/80">Fantasy</span></h1>
            <p className="text-xs text-muted-foreground">Cricket 2026</p>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {sidebarNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20 border-l-2 border-l-primary shadow-[0_0_16px_oklch(0.68_0.22_35/0.25)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}

          {/* Admin section — visually separated below the divider */}
          {isAdmin && (
            <>
              <div className="my-2 mx-3 h-px bg-overlay-border" aria-hidden />
              <Link
                href={adminItem.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(adminItem.href)
                    ? "bg-primary/10 text-primary border border-primary/20 border-l-2 border-l-primary shadow-[0_0_16px_oklch(0.68_0.22_35/0.25)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-current={isActive(adminItem.href) ? "page" : undefined}
              >
                <adminItem.icon className="h-4 w-4" aria-hidden="true" />
                {adminItem.label}
              </Link>
            </>
          )}
        </nav>
        <div className="p-2 border-t border-overlay-border space-y-1">
          <ThemeToggle showLabel className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full" />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-[var(--tw-red-text)] transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}

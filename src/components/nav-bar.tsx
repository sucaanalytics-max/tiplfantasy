"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Swords,
  Trophy,
  User,
  Shield,
  LogOut,
  BookOpen,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

// 4-tab mobile nav. Leagues + Stats dropped from primary nav — Leagues
// now lives as an accordion at the top of /leaderboard, Stats remains
// reachable via the existing "Player Stats" link on /leaderboard.
// All routes (/leagues, /leagues/[id], /stats) still resolve as deep
// links so invite codes and bookmarks keep working.
const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
]

const sidebarNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/rules", label: "Rules", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
]

const adminItem = { href: "/admin", label: "Admin", icon: Shield }

export function NavBar({
  isAdmin = false,
  collapsed = false,
  onToggle,
}: {
  isAdmin?: boolean
  collapsed?: boolean
  onToggle?: () => void
}) {
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
      <aside
        aria-label="Sidebar navigation"
        className={cn(
          "hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col glass-subtle border-r border-overlay-border transition-[width] duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Header: logo + branding */}
        <div className={cn("flex items-center", collapsed ? "justify-center p-3 pb-5" : "gap-3 p-4 pb-6")}>
          <Image
            src="/icons/icon-192.png"
            alt="TIPL"
            width={collapsed ? 32 : 44}
            height={collapsed ? 32 : 44}
            className="shrink-0"
          />
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold italic tracking-tight text-primary font-display">TIPL <span className="not-italic text-foreground/80">Fantasy</span></h1>
              <p className="text-xs text-muted-foreground">Cricket 2026</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 space-y-1">
          {sidebarNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg py-2.5 text-sm transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? collapsed
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_16px_oklch(0.68_0.22_35/0.25)]"
                      : "bg-primary/10 text-primary border border-primary/20 border-l-2 border-l-primary shadow-[0_0_16px_oklch(0.68_0.22_35/0.25)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && item.label}
              </Link>
            )
          })}

          {/* Admin section — visually separated below the divider */}
          {isAdmin && (
            <>
              <div className={cn("h-px bg-overlay-border", collapsed ? "my-2 mx-1" : "my-2 mx-3")} aria-hidden />
              <Link
                href={adminItem.href}
                title={collapsed ? adminItem.label : undefined}
                className={cn(
                  "flex items-center rounded-lg py-2.5 text-sm transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive(adminItem.href)
                    ? collapsed
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_16px_oklch(0.68_0.22_35/0.25)]"
                      : "bg-primary/10 text-primary border border-primary/20 border-l-2 border-l-primary shadow-[0_0_16px_oklch(0.68_0.22_35/0.25)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-current={isActive(adminItem.href) ? "page" : undefined}
              >
                <adminItem.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && adminItem.label}
              </Link>
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 border-t border-overlay-border space-y-1">
          <ThemeToggle
            showLabel={!collapsed}
            className={cn(
              "flex items-center rounded-lg py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full",
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            )}
            title={collapsed ? "Toggle theme" : undefined}
          />
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex items-center rounded-lg py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-[var(--tw-red-text)] transition-colors w-full",
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sign Out"}
          </button>
          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center rounded-lg py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full",
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

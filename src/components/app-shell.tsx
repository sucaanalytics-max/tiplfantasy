"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { NavBar } from "@/components/nav-bar"
import { InstallPrompt } from "@/components/install-prompt"
import { PushPrompt } from "@/components/push-prompt"

export function AppShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true")
  }, [])

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem("sidebar-collapsed", String(next))
      return next
    })

  return (
    <>
      <NavBar isAdmin={isAdmin} collapsed={collapsed} onToggle={toggle} />
      <main
        className={cn(
          "min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0 transition-[padding] duration-200",
          collapsed ? "md:pl-14" : "md:pl-56"
        )}
      >
        {children}
      </main>
      <InstallPrompt />
      <PushPrompt />
    </>
  )
}

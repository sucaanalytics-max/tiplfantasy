"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="pt-4">
      <button
        onClick={handleSignOut}
        className="text-sm text-muted-foreground hover:text-red-400 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

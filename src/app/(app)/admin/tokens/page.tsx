import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getAllBalances } from "@/actions/h2h"
import { TokenManagementClient } from "./tokens-client"

export default async function AdminTokensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
  if (!profile?.is_admin) redirect("/")

  const balances = await getAllBalances()

  // Get all users (including those without tokens)
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name")

  const balanceMap = new Map(
    balances.map((b) => [b.user_id, b.balance])
  )

  const users = (allProfiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    balance: balanceMap.get(p.id) ?? 0,
  }))

  return <TokenManagementClient users={users} />
}

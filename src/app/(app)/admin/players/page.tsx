import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PlayersClient } from "./players-client"
import type { PlayerWithTeam } from "@/lib/types"

export default async function AdminPlayersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  const { data: players } = await supabase
    .from("players")
    .select("*, team:teams(*)")
    .order("name")
    .limit(500)

  return <PlayersClient players={(players ?? []) as unknown as PlayerWithTeam[]} />
}

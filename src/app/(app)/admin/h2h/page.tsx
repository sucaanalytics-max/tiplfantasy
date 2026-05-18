import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  compareTwoUsersSeason,
  listProfilesForH2H,
} from "@/actions/h2h-compare"
import { H2HClient } from "./h2h-client"

// Defaults: Sidd K vs JVB (the pair that prompted this page)
const DEFAULT_A = "1fceb6c7-ecfa-4eec-bdea-e0c2b93c587c"
const DEFAULT_B = "a6e15917-4a91-409a-9ae7-555df837320d"

export default async function AdminH2HPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
  if (!profile?.is_admin) redirect("/")

  const params = await searchParams
  const a = params.a ?? DEFAULT_A
  const b = params.b ?? DEFAULT_B

  const [result, profiles] = await Promise.all([
    compareTwoUsersSeason(a, b),
    listProfilesForH2H(),
  ])

  return <H2HClient result={result} profiles={profiles} aId={a} bId={b} />
}

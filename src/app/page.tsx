import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getAuthUser } from "@/lib/supabase/server"

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  : ""

export default async function RootPage() {
  const user = await getAuthUser()
  if (!user) {
    // Self-heal: middleware checks cookie presence only. If the cookie is stale
    // and getAuthUser() returns null, clear it so middleware stops bouncing
    // /login back to / on the next request.
    const cookieStore = await cookies()
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith(`sb-${PROJECT_REF}-auth-token`)) {
        cookieStore.delete(c.name)
      }
    }
    redirect("/login")
  }
  redirect("/dashboard")
}

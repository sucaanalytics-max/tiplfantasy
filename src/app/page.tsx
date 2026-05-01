import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getAuthUser } from "@/lib/supabase/server"

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  : ""

export default async function RootPage() {
  const user = await getAuthUser()
  if (!user) {
    // If stale auth cookies are present, route via /auth/clear so a Route
    // Handler can write Set-Cookie deletion headers (Server Components can't).
    // This breaks the loop where middleware sees the cookie and redirects
    // /login back to /.
    const cookieStore = await cookies()
    const hasStaleAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.startsWith(`sb-${PROJECT_REF}-auth-token`))
    redirect(hasStaleAuthCookies ? "/auth/clear" : "/login")
  }
  redirect("/dashboard")
}

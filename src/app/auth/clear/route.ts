import { NextResponse } from "next/server"

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  : ""

// Clears stale Supabase auth cookies and redirects to /login. Reached from
// RootPage when getAuthUser() returns null but cookies are still present —
// breaks the middleware/page redirect loop on mobile Safari.
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const response = NextResponse.redirect(`${origin}/login`)

  const cookieHeader = request.headers.get("cookie") ?? ""
  const names = cookieHeader
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter(Boolean)

  for (const name of names) {
    if (name.startsWith(`sb-${PROJECT_REF}-auth-token`)) {
      response.cookies.delete(name)
    }
  }

  return response
}

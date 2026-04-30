import { NextResponse, type NextRequest } from "next/server"

// Supabase SSR stores the session in a cookie named sb-<project-ref>-auth-token
// (or chunked as .0, .1, ... when the value exceeds cookie size limits)
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  : ""
const SESSION_COOKIE = `sb-${PROJECT_REF}-auth-token`

// Synchronous, zero-network-call auth gate.
// Token refresh happens in Server Components via getUser() in server.ts.
export function updateSession(request: NextRequest) {
  // Handle PKCE code exchange — when Supabase redirects to Site URL with ?code=xxx
  // instead of /auth/callback, forward the code to the dedicated callback handler
  const code = request.nextUrl.searchParams.get("code")
  if (code && !request.nextUrl.pathname.startsWith("/auth")) {
    const callbackUrl = request.nextUrl.clone()
    callbackUrl.pathname = "/auth/callback"
    return NextResponse.redirect(callbackUrl)
  }

  const isLoggedIn =
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(`${SESSION_COOKIE}.0`)

  if (
    !isLoggedIn &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isLoggedIn && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

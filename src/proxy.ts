import { updateSession } from "@/lib/supabase/middleware"
import { type NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|workbox-.*\\.js|api/cron/|opengraph-image).*)",
  ],
}

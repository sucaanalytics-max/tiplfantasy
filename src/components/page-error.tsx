"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

// Safe error messages that can be shown to users
const SAFE_MESSAGES: Record<string, string> = {
  "Not authenticated": "Please log in to continue.",
  "Not admin": "You don't have permission to access this page.",
  "Match not found": "This match could not be found.",
  "Match is locked": "This match is locked and can no longer be edited.",
  "Match has started": "This match has already started.",
}

function getSafeMessage(error: Error): string {
  if (error.message && SAFE_MESSAGES[error.message]) {
    return SAFE_MESSAGES[error.message]
  }
  if ((error as Error & { digest?: string }).digest) {
    return "An unexpected error occurred. Please try again."
  }
  return "Something went wrong. Please try again or contact support."
}

export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const message = getSafeMessage(error)

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-4 animate-slide-up">
      <AlertCircle className="h-12 w-12 text-status-danger" />
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}

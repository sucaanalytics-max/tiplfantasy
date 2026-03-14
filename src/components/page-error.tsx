"use client"

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
  // Check if the error message is in our safe list
  if (error.message && SAFE_MESSAGES[error.message]) {
    return SAFE_MESSAGES[error.message]
  }

  // For digest errors (server-side), show generic message
  if ((error as Error & { digest?: string }).digest) {
    return "An unexpected error occurred. Please try again."
  }

  // Don't expose raw error messages — they may contain DB schema info
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
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-4">
      <AlertCircle className="h-10 w-10 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  )
}

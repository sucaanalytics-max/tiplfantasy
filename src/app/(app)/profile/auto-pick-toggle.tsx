"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { setAutoPickEnabled } from "@/actions/profile"

export function AutoPickToggle({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = useState(enabled)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    const next = !checked
    setChecked(next)
    startTransition(async () => {
      const result = await setAutoPickEnabled(next)
      if (result.error) setChecked(!next) // revert on error
    })
  }

  return (
    <Card className="border border-border">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Auto-pick backup</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you miss the match deadline, we&apos;ll auto-pick your team within 2 minutes.
              Auto-picked teams get no Captain / VC bonus.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={checked}
            aria-label="Auto-pick backup"
            disabled={pending}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              checked ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                checked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

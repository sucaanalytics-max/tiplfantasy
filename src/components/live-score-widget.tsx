"use client"

import { useState, useEffect, useRef } from "react"
import type { LiveScoreEntry } from "@/app/api/live-scores/route"

const POLL_INTERVAL = 60_000
const WINDOW_BEFORE_MS = 30 * 60 * 1000
const WINDOW_AFTER_MS = 4 * 60 * 60 * 1000

function isActiveWindow(startTime: string): boolean {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  return now >= start - WINDOW_BEFORE_MS && now <= start + WINDOW_AFTER_MS
}

export function LiveScoreWidget({
  cricapiMatchId,
  startTime,
}: {
  cricapiMatchId: string | null
  startTime: string
}) {
  const [entry, setEntry] = useState<LiveScoreEntry | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!cricapiMatchId) return
    if (!isActiveWindow(startTime)) return

    async function poll() {
      try {
        const res = await fetch("/api/live-scores")
        if (!res.ok) return
        const scores: LiveScoreEntry[] = await res.json()
        const match = scores.find((s) => s.cricapiMatchId === cricapiMatchId)
        setEntry(match ?? null)
      } catch {
        // silently ignore network errors
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [cricapiMatchId, startTime])

  if (!entry || entry.ms === "fixture") return null

  if (entry.ms === "live") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-status-live">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-live animate-pulse" />
          {entry.score1 && <span>{entry.score1}</span>}
          {entry.score1 && entry.score2 && <span className="text-muted-foreground">·</span>}
          {entry.score2 && <span>{entry.score2}</span>}
        </div>
        {entry.note && (
          <p className="text-[10px] text-muted-foreground">{entry.note}</p>
        )}
      </div>
    )
  }

  // result
  if (entry.score1 || entry.score2) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {entry.score1 && <span>{entry.score1}</span>}
          {entry.score1 && entry.score2 && <span>·</span>}
          {entry.score2 && <span>{entry.score2}</span>}
        </div>
        {entry.note && (
          <p className="text-[10px] text-muted-foreground">{entry.note}</p>
        )}
      </div>
    )
  }

  return null
}

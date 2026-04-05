"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { LiveScoreWidget } from "@/components/live-score-widget"
import { BallTicker } from "@/components/ball-ticker"
import { cn } from "@/lib/utils"

type BallEvent = { ball: number; runs: number; four: boolean; six: boolean; wicket: boolean }

type Props = {
  cricapiMatchId: string | null
  startTime: string
  lastBalls: BallEvent[]
  isLive: boolean
  resultSummary: string | null
}

export function CricketStrip({ cricapiMatchId, startTime, lastBalls, isLive, resultSummary }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!isLive && !resultSummary) return null

  return (
    <div className="border-b border-white/[0.06] bg-white/[0.02]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between gap-2"
      >
        <div className="flex-1 min-w-0">
          {isLive && cricapiMatchId ? (
            <LiveScoreWidget cricapiMatchId={cricapiMatchId} startTime={startTime} />
          ) : resultSummary ? (
            <p className="text-xs text-muted-foreground truncate">{resultSummary}</p>
          ) : null}
        </div>
        {isLive && (
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        )}
      </button>

      {/* Ball ticker — always visible during live */}
      {isLive && lastBalls.length > 0 && (
        <div className="px-4 pb-2">
          <BallTicker balls={lastBalls} />
        </div>
      )}

      {/* Expanded detail — placeholder for batsmen/bowler when data available */}
      {expanded && isLive && (
        <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-white/[0.04] pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Live scores update every ~60s
          </p>
        </div>
      )}
    </div>
  )
}

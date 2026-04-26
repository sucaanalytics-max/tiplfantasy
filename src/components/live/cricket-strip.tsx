"use client"

import { LiveScoreWidget } from "@/components/live-score-widget"
import { BallTicker } from "@/components/ball-ticker"

type BallEvent = { ball: number; runs: number; four: boolean; six: boolean; wicket: boolean }

type Props = {
  cricapiMatchId: string | null
  startTime: string
  lastBalls: BallEvent[]
  isLive: boolean
  resultSummary: string | null
}

export function CricketStrip({ cricapiMatchId, startTime, lastBalls, isLive, resultSummary }: Props) {
  if (!isLive && !resultSummary) return null

  return (
    <div className="border-b border-overlay-border bg-overlay-subtle">
      <div className="px-4 py-2">
        {isLive && cricapiMatchId ? (
          <LiveScoreWidget cricapiMatchId={cricapiMatchId} startTime={startTime} />
        ) : resultSummary ? (
          <p className="text-xs text-muted-foreground truncate">{resultSummary}</p>
        ) : null}
      </div>

      {isLive && lastBalls.length > 0 && (
        <div className="px-4 pb-2">
          <BallTicker balls={lastBalls} />
        </div>
      )}
    </div>
  )
}

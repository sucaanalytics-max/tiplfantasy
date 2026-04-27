"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CricketStrip } from "@/components/live/cricket-strip"
import { FantasyHUD } from "@/components/live/fantasy-hud"

type TeamInfo = { short_name: string; color: string; logo_url: string | null }
type BallEvent = { ball: number; runs: number; four: boolean; six: boolean; wicket: boolean }

type Props = {
  match: {
    match_number: number
    status: string
    result_summary: string | null
    cricapi_match_id: string | null
    start_time: string
  }
  home: TeamInfo
  away: TeamInfo
  lastBalls: BallEvent[]
  myRank: number | null
  myPoints: number
  totalUsers: number
  leaderPoints: number
  captainName: string | null
  captainPoints: number
  vcName: string | null
  vcPoints: number
}

/**
 * Sticky live-state bar shown below the hero band:
 *   nav back + cricket strip (live balls / result) + my fantasy HUD.
 * The whole group is `position: sticky; top: 0` so during scroll the user
 * always sees their rank/pts and the live score.
 */
export function StickyHeader({
  match, home: _home, away: _away, lastBalls,
  myRank, myPoints, totalUsers, leaderPoints,
  captainName, captainPoints, vcName, vcPoints,
}: Props) {
  const isLive = match.status === "live"

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-overlay-border">
      {/* Compact nav row */}
      <div className="px-3 py-1.5 flex items-center gap-2 bg-overlay-subtle">
        <Link href="/matches">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="text-2xs uppercase tracking-widest text-muted-foreground font-semibold">
          Match {match.match_number}
        </span>
        {isLive && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-live/15">
            <span className="h-1.5 w-1.5 rounded-full bg-status-live animate-pulse" />
            <span className="text-2xs font-bold uppercase tracking-wider text-status-live">LIVE</span>
          </span>
        )}
        {(match.status === "completed" || match.status === "no_result") && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full tag-pill-gold">
            FINAL
          </span>
        )}
      </div>

      {/* Cricket strip — only renders when live or completed-with-summary */}
      <CricketStrip
        cricapiMatchId={match.cricapi_match_id}
        startTime={match.start_time}
        lastBalls={lastBalls}
        isLive={isLive}
        resultSummary={!isLive ? match.result_summary : null}
      />

      {/* My strip — always rendered if user has any score */}
      {myRank != null && (
        <FantasyHUD
          variant="compact"
          rank={myRank}
          totalPoints={myPoints}
          captainName={captainName}
          captainPoints={captainPoints}
          vcName={vcName}
          vcPoints={vcPoints}
          leaderPoints={leaderPoints}
          isLive={isLive}
          totalUsers={totalUsers}
        />
      )}
    </div>
  )
}

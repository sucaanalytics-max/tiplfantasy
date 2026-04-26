"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamLogo } from "@/components/team-logo"
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
 * Status-aware sticky group: app row + cricket strip + my-strip.
 * The whole group is `position: sticky; top: 0` so my rank/pts and the
 * live score never leave the screen during scroll.
 */
export function StickyHeader({
  match, home, away, lastBalls,
  myRank, myPoints, totalUsers, leaderPoints,
  captainName, captainPoints, vcName, vcPoints,
}: Props) {
  const isLive = match.status === "live"

  return (
    <div className="sticky top-0 z-30 bg-background">
      {/* App row */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{ background: `linear-gradient(135deg, ${home.color} 0%, transparent 40%, transparent 60%, ${away.color} 100%)` }}
        />
        <div className="relative px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/matches">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo team={home} size="md" />
                <span className="text-2xs font-bold text-muted-foreground/50">VS</span>
                <TeamLogo team={away} size="md" />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">M#{match.match_number}</span>
            </div>
            {isLive && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-live/15 border border-status-live/20">
                <span className="h-2 w-2 rounded-full bg-status-live animate-pulse" />
                <span className="text-2xs font-bold uppercase tracking-wider text-status-live">LIVE</span>
              </div>
            )}
            {(match.status === "completed" || match.status === "no_result") && match.result_summary && (
              <span className="text-[10px] text-muted-foreground max-w-[160px] text-right truncate">{match.result_summary}</span>
            )}
          </div>
        </div>
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

'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AutoPickToggle } from "./auto-pick-toggle"
import { ThemeCard } from "./theme-card"
import { SeasonArcTab } from "./season-arc-tab"
import type { ScoreTimelineEntry, RoleBreakdownData } from "./season-arc-tab"
import { CaptaincyTab } from "./captaincy-tab"
import type { CaptainStatsData } from "./captaincy-tab"
import type { MatchHistoryRow } from "./match-history-table"

// Re-export for use by the parent server component
export type { ScoreTimelineEntry, RoleBreakdownData, CaptainStatsData }

type ProfileTabsProps = {
  // ── Overview ──
  matchesPlayed: number
  avgPoints: number
  firstPlaceCount: number
  podiumCount: number
  favCaptain: { name: string; count: number } | null
  roleCounts: { WK: number; BAT: number; AR: number; BOWL: number }
  totalPicks: number
  autoPick: boolean
  // ── Season Arc ──
  scoreTimeline: ScoreTimelineEntry[]
  roleBreakdown: RoleBreakdownData
  matchHistoryRows: MatchHistoryRow[]
  totalPoints: number
  leagueSize: number
  seasonAvg: number
  // ── Captaincy ──
  captainStats: CaptainStatsData
}

export function ProfileTabs(props: ProfileTabsProps) {
  const { roleCounts, totalPicks } = props
  const roleLabels = {
    WK: "Wicket-Keepers",
    BAT: "Batters",
    AR: "All-Rounders",
    BOWL: "Bowlers",
  } as const

  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full mb-4">
        <TabsTrigger value="overview" className="flex-1">
          Overview
        </TabsTrigger>
        <TabsTrigger value="season" className="flex-1">
          Season Arc
        </TabsTrigger>
        <TabsTrigger value="captaincy" className="flex-1">
          Captaincy
        </TabsTrigger>
      </TabsList>

      {/* ── Overview ── */}
      <TabsContent value="overview" className="space-y-6">
        <AutoPickToggle enabled={props.autoPick} />

        <Card className="glass">
          <CardContent className="pt-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Matches Played</span>
              <span className="font-medium">{props.matchesPlayed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Points / Match</span>
              <span className="font-medium">{props.avgPoints.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">1st Place Finishes</span>
              <span className="font-medium">{props.firstPlaceCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Podium Finishes</span>
              <span className="font-medium">{props.podiumCount}</span>
            </div>
            {props.favCaptain && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Favorite Captain</span>
                <span className="font-medium">
                  {props.favCaptain.name} ({props.favCaptain.count}×)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPicks > 0 && (
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Role Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(["WK", "BAT", "AR", "BOWL"] as const).map((role) => {
                const count = roleCounts[role]
                const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{roleLabels[role]}</span>
                      <span className="font-medium">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <ThemeCard />
      </TabsContent>

      {/* ── Season Arc ── */}
      <TabsContent value="season">
        <SeasonArcTab
          scoreTimeline={props.scoreTimeline}
          roleBreakdown={props.roleBreakdown}
          matchHistoryRows={props.matchHistoryRows}
          totalPoints={props.totalPoints}
          leagueSize={props.leagueSize}
          seasonAvg={props.seasonAvg}
        />
      </TabsContent>

      {/* ── Captaincy ── */}
      <TabsContent value="captaincy">
        <CaptaincyTab stats={props.captainStats} />
      </TabsContent>
    </Tabs>
  )
}

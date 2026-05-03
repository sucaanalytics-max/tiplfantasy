'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { Star, Zap, Bot, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

export type CaptainPickRow = {
  id: string
  name: string
  count: number
  totalBonus: number
  avgBonus: number
}

export type CaptainStatsData = {
  perCaptain: CaptainPickRow[]
  autoPickCount: number
  avgManualScore: number
  avgAutoPickScore: number
  totalCaptainBonus: number
  totalVcBonus: number
  bestMatchCaptainBonus: number
}

export function CaptaincyTab({ stats }: { stats: CaptainStatsData }) {
  const showAutoPickNote =
    stats.autoPickCount > 0 && (stats.avgManualScore > 0 || stats.avgAutoPickScore > 0)

  return (
    <div className="space-y-6">
      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Star}
          value={Math.round(stats.totalCaptainBonus)}
          label="Captain Bonus"
          gradient="from-amber-500/10"
          iconColor="bg-amber-500/15 text-amber-500"
        />
        <StatCard
          icon={Zap}
          value={Math.round(stats.totalVcBonus)}
          label="VC Bonus"
          gradient="from-primary/10"
          iconColor="bg-primary/15 text-primary"
        />
        <StatCard
          icon={Trophy}
          value={Math.round(stats.bestMatchCaptainBonus)}
          label="Best Captain Match"
          gradient="from-green-500/10"
          iconColor="bg-green-500/15 text-green-400"
        />
        <StatCard
          icon={Bot}
          value={String(stats.autoPickCount)}
          label="Auto-picks"
          gradient="from-muted/10"
          iconColor="bg-muted/40 text-muted-foreground"
        />
      </div>

      {/* Auto-pick comparison note */}
      {showAutoPickNote && (
        <Card className="glass border-dashed">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">
            Auto-picked{" "}
            <span className="text-foreground font-medium">{stats.autoPickCount}</span>{" "}
            time{stats.autoPickCount !== 1 ? "s" : ""} — avg{" "}
            <span
              className={cn(
                "font-medium",
                stats.avgAutoPickScore < stats.avgManualScore
                  ? "text-red-400"
                  : "text-green-400"
              )}
            >
              {stats.avgAutoPickScore.toFixed(0)} pts
            </span>{" "}
            vs{" "}
            <span className="text-foreground font-medium">
              {stats.avgManualScore.toFixed(0)} pts
            </span>{" "}
            when manual
          </CardContent>
        </Card>
      )}

      {/* Captain picks table */}
      {stats.perCaptain.length > 0 ? (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Captain Picks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  <th className="text-left py-2 px-4 font-medium">Player</th>
                  <th className="text-right py-2 px-3 font-medium">Times</th>
                  <th className="text-right py-2 px-3 font-medium">Bonus</th>
                  <th className="text-right py-2 px-4 font-medium">Avg</th>
                </tr>
              </thead>
              <tbody>
                {stats.perCaptain.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/30 last:border-0",
                      i === 0 && "bg-amber-500/5"
                    )}
                  >
                    <td className="py-2.5 px-4 font-medium">
                      {i === 0 && (
                        <span className="mr-1.5 text-amber-400" aria-hidden>
                          ★
                        </span>
                      )}
                      {row.name}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {row.count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-display font-bold text-accent">
                      {Math.round(row.totalBonus)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {row.avgBonus.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No matches played yet
        </div>
      )}
    </div>
  )
}

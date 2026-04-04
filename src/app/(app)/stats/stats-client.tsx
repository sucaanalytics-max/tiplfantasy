"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PlayerAgg = {
  id: string
  name: string
  role: string
  team: string
  color: string
  logoUrl: string | null
  matches: number
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  wickets: number
  oversBowled: number
  runsConceded: number
  maidens: number
  catches: number
  stumpings: number
  runOuts: number
  totalFantasy: number
  ducks: number
  scores: number[]
}

function StatRow({ rank, player, stat, sub, accent }: { rank: number; player: PlayerAgg; stat: string; sub?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.03]">
      <span className={cn(
        "text-sm font-bold tabular-nums w-5 text-center",
        rank === 1 ? (accent ?? "text-amber-400") : rank === 2 ? "text-zinc-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground"
      )}>
        {rank}
      </span>
      {player.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.logoUrl} alt={player.team} className="w-6 h-6 rounded-full object-contain shrink-0" />
      ) : (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          style={{ backgroundColor: player.color }}
        >
          {player.team.slice(0, 2)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{player.name}</p>
        <p className="text-[10px] text-muted-foreground">{player.role} · {player.team}{sub ? ` · ${sub}` : ""}</p>
      </div>
      <span className={cn("text-base font-bold tabular-nums", accent ?? "text-foreground")}>{stat}</span>
    </div>
  )
}

function SectionCard({ title, emoji, children, accent }: { title: string; emoji: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="space-y-2">
      <h2 className={cn("text-sm font-bold flex items-center gap-2", accent ?? "text-foreground")}>
        <span>{emoji}</span> {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function StatsClient({ players, matchCount }: { players: PlayerAgg[]; matchCount: number }) {
  // --- Orange Cap: Most Runs ---
  const orangeCap = [...players].sort((a, b) => b.runs - a.runs).slice(0, 7)

  // --- Purple Cap: Most Wickets ---
  const purpleCap = [...players].filter((p) => p.wickets > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 7)

  // --- Best Fielders ---
  const bestFielders = [...players]
    .map((p) => ({ ...p, fieldingPts: p.catches + p.stumpings + p.runOuts }))
    .filter((p) => p.fieldingPts > 0)
    .sort((a, b) => b.fieldingPts - a.fieldingPts)
    .slice(0, 7)

  // --- Fantasy MVP ---
  const mvp = [...players].sort((a, b) => b.totalFantasy - a.totalFantasy).slice(0, 7)

  // --- Most Sixes ---
  const mostSixes = [...players].filter((p) => p.sixes > 0).sort((a, b) => b.sixes - a.sixes).slice(0, 7)

  // --- Form Table (last 3 matches avg, min 2 matches) ---
  const formTable = [...players]
    .filter((p) => p.scores.length >= 2)
    .map((p) => {
      const last3 = p.scores.slice(-3)
      const avg = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length)
      return { ...p, formAvg: avg, last3 }
    })
    .sort((a, b) => b.formAvg - a.formAvg)
    .slice(0, 10)

  // --- Duck Club ---
  const duckClub = [...players].filter((p) => p.ducks > 0).sort((a, b) => b.ducks - a.ducks).slice(0, 7)

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" asChild>
          <Link href="/leaderboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-lg font-bold">Season Stats</h1>
          <p className="text-xs text-muted-foreground">{matchCount} matches completed</p>
        </div>
      </div>

      {/* Fantasy MVP */}
      <SectionCard title="Fantasy MVP" emoji="⭐" accent="text-primary">
        {mvp.map((p, i) => (
          <StatRow
            key={p.id}
            rank={i + 1}
            player={p}
            stat={`${Math.round(p.totalFantasy)}`}
            sub={`avg ${Math.round(p.totalFantasy / p.matches)}`}
            accent="text-primary"
          />
        ))}
      </SectionCard>

      {/* Orange + Purple side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orange Cap */}
        <SectionCard title="Orange Cap" emoji="🧡" accent="text-orange-400">
          {orangeCap.map((p, i) => {
            const avg = p.ballsFaced > 0 ? (p.runs / Math.max(p.matches, 1)).toFixed(0) : "—"
            const sr = p.ballsFaced > 0 ? ((p.runs / p.ballsFaced) * 100).toFixed(0) : "—"
            return (
              <StatRow
                key={p.id}
                rank={i + 1}
                player={p}
                stat={`${p.runs}`}
                sub={`avg ${avg} · SR ${sr}`}
                accent="text-orange-400"
              />
            )
          })}
        </SectionCard>

        {/* Purple Cap */}
        <SectionCard title="Purple Cap" emoji="💜" accent="text-purple-400">
          {purpleCap.map((p, i) => {
            const econ = p.oversBowled > 0 ? (p.runsConceded / p.oversBowled).toFixed(1) : "—"
            return (
              <StatRow
                key={p.id}
                rank={i + 1}
                player={p}
                stat={`${p.wickets}`}
                sub={`econ ${econ}`}
                accent="text-purple-400"
              />
            )
          })}
        </SectionCard>
      </div>

      {/* Best Fielders */}
      <SectionCard title="Best Fielders" emoji="🧤" accent="text-emerald-400">
        {bestFielders.map((p, i) => {
          const parts: string[] = []
          if (p.catches > 0) parts.push(`${p.catches}c`)
          if (p.stumpings > 0) parts.push(`${p.stumpings}st`)
          if (p.runOuts > 0) parts.push(`${p.runOuts}ro`)
          return (
            <StatRow
              key={p.id}
              rank={i + 1}
              player={p}
              stat={`${p.catches + p.stumpings + p.runOuts}`}
              sub={parts.join(" · ")}
              accent="text-emerald-400"
            />
          )
        })}
      </SectionCard>

      {/* Form Table */}
      <SectionCard title="Form Table" emoji="📈" accent="text-foreground">
        {formTable.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.03]">
            <span className={cn(
              "text-sm font-bold tabular-nums w-5 text-center",
              i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
            )}>
              {i + 1}
            </span>
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt={p.team} className="w-6 h-6 rounded-full object-contain shrink-0" />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: p.color }}
              >
                {p.team.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {p.last3.map((s, j) => (
                  <span
                    key={j}
                    className={cn(
                      "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded",
                      s >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                      s >= 40 ? "bg-amber-500/15 text-amber-400" :
                      s >= 0 ? "bg-zinc-500/15 text-zinc-400" :
                      "bg-red-500/15 text-red-400"
                    )}
                  >
                    {Math.round(s)}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-base font-bold tabular-nums">{p.formAvg}</span>
          </div>
        ))}
      </SectionCard>

      {/* Most Sixes */}
      <SectionCard title="Most Sixes" emoji="💥">
        {mostSixes.map((p, i) => (
          <StatRow
            key={p.id}
            rank={i + 1}
            player={p}
            stat={`${p.sixes}`}
            sub={`${p.fours} fours`}
          />
        ))}
      </SectionCard>

      {/* Duck Club */}
      {duckClub.length > 0 && (
        <SectionCard title="Duck Club" emoji="🦆" accent="text-red-400">
          {duckClub.map((p, i) => (
            <StatRow
              key={p.id}
              rank={i + 1}
              player={p}
              stat={`${p.ducks}`}
              sub={`${p.matches} mat`}
              accent="text-red-400"
            />
          ))}
        </SectionCard>
      )}
    </div>
  )
}

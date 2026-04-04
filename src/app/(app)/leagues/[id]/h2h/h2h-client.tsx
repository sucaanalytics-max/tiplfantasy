"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Swords } from "lucide-react"

type Member = { user_id: string; display_name: string }
type Score = { user_id: string; match_id: string; total_points: number; match_number: number }

type Props = {
  leagueId: string
  leagueName: string
  members: Member[]
  scores: Score[]
  currentUserId: string
}

export function H2HClient({ leagueId, leagueName, members, scores, currentUserId }: Props) {
  const [playerA, setPlayerA] = useState(currentUserId)
  const [playerB, setPlayerB] = useState(members.find((m) => m.user_id !== currentUserId)?.user_id ?? "")

  const comparison = useMemo(() => {
    if (!playerA || !playerB || playerA === playerB) return null

    const scoresByMatch = new Map<string, { a?: number; b?: number; matchNum: number }>()
    for (const s of scores) {
      if (s.user_id !== playerA && s.user_id !== playerB) continue
      const entry = scoresByMatch.get(s.match_id) ?? { matchNum: s.match_number }
      if (s.user_id === playerA) entry.a = s.total_points
      else entry.b = s.total_points
      scoresByMatch.set(s.match_id, entry)
    }

    let winsA = 0, winsB = 0, ties = 0, totalA = 0, totalB = 0
    const matches: { matchNum: number; a: number; b: number }[] = []

    for (const [, entry] of scoresByMatch) {
      if (entry.a === undefined || entry.b === undefined) continue
      matches.push({ matchNum: entry.matchNum, a: entry.a, b: entry.b })
      totalA += entry.a
      totalB += entry.b
      if (entry.a > entry.b) winsA++
      else if (entry.b > entry.a) winsB++
      else ties++
    }

    matches.sort((a, b) => a.matchNum - b.matchNum)

    let bestDiff = 0, bestDiffMatch = 0
    for (const m of matches) {
      const diff = Math.abs(m.a - m.b)
      if (diff > bestDiff) { bestDiff = diff; bestDiffMatch = m.matchNum }
    }

    return { winsA, winsB, ties, totalA, totalB, matches, bestDiff, bestDiffMatch }
  }, [playerA, playerB, scores])

  const nameA = members.find((m) => m.user_id === playerA)?.display_name ?? "Player A"
  const nameB = members.find((m) => m.user_id === playerB)?.display_name ?? "Player B"

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      <div>
        <Link
          href={`/leagues/${leagueId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> {leagueName}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Swords className="h-5 w-5" /> Head-to-Head
        </h1>
      </div>

      {/* Player selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Player A</label>
          <select
            value={playerA}
            onChange={(e) => setPlayerA(e.target.value)}
            className="w-full text-sm bg-secondary border border-white/[0.06] rounded-md px-2 py-2 text-foreground"
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Player B</label>
          <select
            value={playerB}
            onChange={(e) => setPlayerB(e.target.value)}
            className="w-full text-sm bg-secondary border border-white/[0.06] rounded-md px-2 py-2 text-foreground"
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {playerA === playerB && (
        <p className="text-sm text-muted-foreground text-center py-4">Select two different players to compare.</p>
      )}

      {comparison && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
          {/* Summary */}
          <Card className="border border-white/[0.06]">
            <CardContent className="pt-5">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{comparison.winsA}</p>
                  <p className="text-xs text-muted-foreground truncate">{nameA}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{comparison.ties}</p>
                  <p className="text-xs text-muted-foreground">Draws</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{comparison.winsB}</p>
                  <p className="text-xs text-muted-foreground truncate">{nameB}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Points</span>
                  <span className="font-semibold">{comparison.totalA}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Points</span>
                  <span className="font-semibold">{comparison.totalB}</span>
                </div>
              </div>

              {comparison.bestDiff > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Biggest margin: {comparison.bestDiff} pts (Match #{comparison.bestDiffMatch})
                </p>
              )}
            </CardContent>
          </Card>

          {/* Match-by-match */}
          <Card className="border border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Match by Match</CardTitle>
            </CardHeader>
            <CardContent>
              {comparison.matches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No common matches yet</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center py-1.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span className="w-12">Match</span>
                    <span className="flex-1 text-right truncate pr-2">{nameA.split(" ")[0]}</span>
                    <span className="flex-1 text-left truncate pl-2">{nameB.split(" ")[0]}</span>
                    <span className="w-14 text-right">Winner</span>
                  </div>
                  {comparison.matches.map((m) => {
                    const winner = m.a > m.b ? "A" : m.b > m.a ? "B" : "tie"
                    return (
                      <div key={m.matchNum} className="flex items-center py-2 px-2 rounded bg-white/[0.03]">
                        <span className="w-12 text-xs text-muted-foreground font-mono">#{m.matchNum}</span>
                        <span className={`flex-1 text-right text-sm pr-2 ${winner === "A" ? "font-bold text-primary" : ""}`}>
                          {m.a}
                        </span>
                        <span className={`flex-1 text-left text-sm pl-2 ${winner === "B" ? "font-bold text-primary" : ""}`}>
                          {m.b}
                        </span>
                        <span className="w-14 text-right">
                          {winner === "tie" ? (
                            <Badge variant="outline" className="text-[10px]">Draw</Badge>
                          ) : (
                            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                              {winner === "A" ? nameA.split(" ")[0] : nameB.split(" ")[0]}
                            </Badge>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

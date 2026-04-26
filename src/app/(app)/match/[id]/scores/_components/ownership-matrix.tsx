"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { PreMatchAnalysis, MatrixCell } from "@/lib/match-analysis"

const TIER_ORDER: PreMatchAnalysis["picks"][0]["status"][] = [
  "UNIVERSAL", "CORE", "COMMON", "SPLIT", "DIFF", "UNIQUE",
]
const TIER_LABEL: Record<string, string> = {
  UNIVERSAL: "Universal (100%)",
  CORE: "Core (80%+)",
  COMMON: "Common (60%+)",
  SPLIT: "Split (40%+)",
  DIFF: "Differential",
  UNIQUE: "Unique",
}
const TIER_DOT: Record<string, string> = {
  UNIVERSAL: "bg-emerald-500",
  CORE: "bg-blue-500",
  COMMON: "bg-yellow-500",
  SPLIT: "bg-orange-500",
  DIFF: "bg-red-500",
  UNIQUE: "bg-purple-500",
}

function getMatrixCell(playerId: string, user: PreMatchAnalysis["users"][0]): MatrixCell {
  if (user.captainId === playerId) return "C"
  if (user.vcId === playerId) return "VC"
  if (user.playerIds.includes(playerId)) return "picked"
  return null
}

function MatrixCellBadge({ cell }: { cell: MatrixCell }) {
  if (cell === "C") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-emerald-500 rounded-[3px]">
        <span className="text-[10px] font-bold text-white">C</span>
      </div>
    )
  }
  if (cell === "VC") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-blue-500 rounded-[3px]">
        <span className="text-[10px] font-bold text-white">VC</span>
      </div>
    )
  }
  if (cell === "picked") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 rounded-[3px]">
        <span className="text-[10px] text-zinc-700 dark:text-zinc-300">✓</span>
      </div>
    )
  }
  return <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800/40 rounded-[3px]" />
}

type Props = {
  analysis: PreMatchAnalysis
}

/**
 * Tier-grouped league ownership matrix.
 *
 * Rows are players (grouped by ownership tier: Universal → Unique).
 * Columns are league members. Cells show captain (C, green), vice
 * captain (VC, blue), picked (✓, neutral) or empty.
 *
 * Renders inside a horizontal-scroll container; the player column is
 * sticky on the left so the row labels stay anchored as the user pans.
 */
export function OwnershipMatrix({ analysis }: Props) {
  const tiers = useMemo(() => {
    const groups: Record<string, typeof analysis.picks> = {}
    for (const tier of TIER_ORDER) groups[tier] = []
    for (const p of analysis.picks) groups[p.status].push(p)
    return TIER_ORDER
      .filter((t) => groups[t].length > 0)
      .map((t) => ({ tier: t, picks: groups[t] }))
  }, [analysis.picks])

  const colNames = useMemo(() => {
    return analysis.users.map((u) => {
      const parts = u.displayName.split(" ")
      if (u.displayName.length <= 6) return u.displayName
      return parts[0].length <= 8 ? parts[0] : parts[0].slice(0, 6)
    })
  }, [analysis.users])

  if (analysis.users.length === 0 || analysis.picks.length === 0) return null

  return (
    <section className="px-3 pt-5 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Ownership Matrix
        </h3>
        <span className="text-[10px] text-muted-foreground/60">
          {analysis.totalMembers} {analysis.totalMembers === 1 ? "member" : "members"}
        </span>
      </div>

      <div className="overflow-x-auto -mx-3 px-3">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-overlay-border">
              <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-background z-10 min-w-[120px]">
                PLAYER
              </th>
              {colNames.map((name, i) => (
                <th
                  key={i}
                  className="text-center px-0.5 py-2 font-semibold text-muted-foreground"
                  style={{ minWidth: 44 }}
                >
                  <span className="block truncate max-w-[44px] mx-auto">{name}</span>
                </th>
              ))}
              <th className="text-right pl-2 py-2 font-semibold text-muted-foreground w-10">%</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(({ tier, picks }) => (
              <React.Fragment key={tier}>
                <tr>
                  <td colSpan={colNames.length + 2} className="pt-3 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", TIER_DOT[tier])} />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {TIER_LABEL[tier]}
                      </span>
                    </div>
                  </td>
                </tr>
                {picks.map((p) => (
                  <tr key={p.id} className="border-b border-overlay-border hover:bg-overlay-subtle">
                    <td className="py-1.5 pr-2 sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", TIER_DOT[p.status])} />
                        <span className="font-medium truncate max-w-[100px]">{p.name}</span>
                      </div>
                    </td>
                    {analysis.users.map((u) => {
                      const cell = getMatrixCell(p.id, u)
                      return (
                        <td key={u.displayName} className="px-0.5 py-1.5">
                          <div className="w-[38px] h-[24px] mx-auto">
                            <MatrixCellBadge cell={cell} />
                          </div>
                        </td>
                      )
                    })}
                    <td className={cn(
                      "text-right pl-2 py-1.5 font-bold tabular-nums",
                      p.ownership === 100 ? "text-[var(--tw-emerald-text)]" :
                      p.ownership >= 80 ? "text-[var(--tw-blue-text)]" :
                      p.ownership >= 60 ? "text-yellow-600 dark:text-yellow-400" :
                      p.ownership >= 40 ? "text-orange-600 dark:text-orange-400" :
                      "text-[var(--tw-red-text)]",
                    )}>
                      {p.ownership}%
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] text-muted-foreground">
        <Legend swatch="bg-emerald-500" label="Captain" />
        <Legend swatch="bg-blue-500" label="Vice Captain" />
        <Legend swatch="bg-zinc-200 dark:bg-zinc-700" label="Picked" />
        <Legend swatch="bg-zinc-100 dark:bg-zinc-800/40" label="Not Picked" />
      </div>
    </section>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("w-4 h-3 rounded-[2px]", swatch)} />
      <span>{label}</span>
    </div>
  )
}

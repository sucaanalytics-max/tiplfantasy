"use client"

import React, { useMemo } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarHexColor } from "@/lib/avatar"
import type { PreMatchAnalysis, MatrixCell } from "@/lib/match-analysis"

const TIER_ORDER: PreMatchAnalysis["picks"][0]["status"][] = ["UNIVERSAL", "CORE", "COMMON", "SPLIT", "DIFF", "UNIQUE"]
const TIER_LABEL: Record<string, string> = { UNIVERSAL: "Universal (100%)", CORE: "Core (80%+)", COMMON: "Common (60%+)", SPLIT: "Split (40%+)", DIFF: "Differential", UNIQUE: "Unique" }
const TIER_DOT: Record<string, string> = { UNIVERSAL: "bg-emerald-500", CORE: "bg-blue-500", COMMON: "bg-yellow-500", SPLIT: "bg-orange-500", DIFF: "bg-red-500", UNIQUE: "bg-purple-500" }

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
      <div className="w-full h-full flex items-center justify-center bg-zinc-700 rounded-[3px]">
        <span className="text-[10px] text-zinc-300">✓</span>
      </div>
    )
  }
  return <div className="w-full h-full bg-zinc-800/40 rounded-[3px]" />
}

export function AnalysisContent({ analysis, whatsapp, copied, onCopy }: { analysis: PreMatchAnalysis; whatsapp: string; copied: boolean; onCopy: () => void }) {
  const tiers = useMemo(() => {
    const groups: Record<string, typeof analysis.picks> = {}
    for (const tier of TIER_ORDER) groups[tier] = []
    for (const p of analysis.picks) groups[p.status].push(p)
    return TIER_ORDER.filter((t) => groups[t].length > 0).map((t) => ({ tier: t, picks: groups[t] }))
  }, [analysis.picks])

  const colNames = useMemo(() => {
    return analysis.users.map((u) => {
      const parts = u.displayName.split(" ")
      if (u.displayName.length <= 6) return u.displayName
      return parts[0].length <= 8 ? parts[0] : parts[0].slice(0, 6)
    })
  }, [analysis.users])

  return (
    <div className="space-y-5">
      <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy for WhatsApp"}
      </Button>

      {/* Ownership Matrix */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ownership Matrix</h3>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-background z-10 min-w-[120px]">PLAYER</th>
                {colNames.map((name, i) => (
                  <th key={i} className="text-center px-0.5 py-2 font-semibold text-muted-foreground" style={{ minWidth: 44 }}>
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
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{TIER_LABEL[tier]}</span>
                      </div>
                    </td>
                  </tr>
                  {picks.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
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
                        p.ownership === 100 ? "text-emerald-400" :
                        p.ownership >= 80 ? "text-blue-400" :
                        p.ownership >= 60 ? "text-yellow-400" :
                        p.ownership >= 40 ? "text-orange-400" :
                        "text-red-400"
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

        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-emerald-500 rounded-[2px]" />
            <span>Captain</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-500 rounded-[2px]" />
            <span>Vice Captain</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-zinc-700 rounded-[2px]" />
            <span>Picked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-zinc-800/40 rounded-[2px]" />
            <span>Not Picked</span>
          </div>
        </div>
      </div>

      {/* Per-user threats */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Threats Per User</h3>
        <div className="space-y-3">
          {analysis.users.map((u) => (
            <div key={u.displayName} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: getAvatarHexColor(u.displayName) }}
                >
                  {getInitials(u.displayName)}
                </div>
                <span className="text-sm font-semibold">{u.displayName}</span>
                {u.captainName ? (
                  <span className="text-[10px] text-amber-400">C: {u.captainName}</span>
                ) : (
                  <span className="text-[10px] text-red-400">⚠️ No Captain</span>
                )}
              </div>
              {u.missing.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-red-400 font-medium">Missing: </span>
                  {u.missing.map((m) => `${m.name} (${m.ownership}%)`).join(", ")}
                </div>
              )}
              {u.unique.length > 0 && (
                <div className="text-[11px]">
                  <span className="text-purple-400 font-medium">Unique: </span>
                  {u.unique.join(", ")} 🔥
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

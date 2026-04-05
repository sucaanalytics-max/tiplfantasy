"use client"

import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

type ThreatPlayer = {
  name: string
  role: string
  teamShortName: string
  fantasyPoints: number
  ownershipPct: number
  ownerCount: number
  totalUsers: number
}

type Props = {
  threats: ThreatPlayer[]
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  BAT: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  AR: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  BOWL: "text-purple-400 border-purple-400/30 bg-purple-400/10",
}

export function ThreatsSection({ threats }: Props) {
  if (threats.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Threats</span>
        <span className="text-[10px] text-muted-foreground/60">Players you missed</span>
      </div>

      <div className="space-y-1">
        {threats.map((t) => (
          <div key={t.name} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className={`text-[8px] px-1 py-0 h-[14px] ${ROLE_COLORS[t.role] ?? ""}`}>
                {t.role}
              </Badge>
              <span className="text-xs font-medium truncate">{t.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {t.ownerCount}/{t.totalUsers}
              </span>
            </div>
            <span className="text-xs font-bold text-amber-400 tabular-nums shrink-0">+{t.fantasyPoints}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

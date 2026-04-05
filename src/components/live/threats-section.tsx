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
  WK: "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]",
  BAT: "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]",
  AR: "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]",
  BOWL: "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]",
}

export function ThreatsSection({ threats }: Props) {
  if (threats.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-[var(--tw-amber-text)]" />
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
            <span className="text-xs font-bold text-[var(--tw-amber-text)] tabular-nums shrink-0">+{t.fantasyPoints}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

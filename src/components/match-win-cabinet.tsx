interface Win {
  matchId: string
  matchNumber: number
}

interface Props {
  wins: Win[]
  winsRank: number | null
  totalMatches: number
}

export function MatchWinCabinet({ wins, winsRank, totalMatches }: Props) {
  const SLOTS = 8
  const displayWins = wins.slice(0, SLOTS)
  const overflow = wins.length > SLOTS ? wins.length - SLOTS : 0

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {displayWins.map((w) => (
          <span
            key={w.matchId}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[oklch(0.78_0.17_86/0.12)] border border-[oklch(0.78_0.17_86/0.25)] text-[11px] font-bold text-[var(--captain-gold)] tabular-nums"
            style={{ color: "var(--captain-gold)" }}
          >
            🏆 M{w.matchNumber}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-xs text-muted-foreground">+{overflow} more</span>
        )}
        {/* Dashed placeholder slots */}
        {Array.from({ length: Math.max(0, Math.min(3, SLOTS - displayWins.length)) }).map((_, i) => (
          <span
            key={`placeholder-${i}`}
            className="inline-flex items-center justify-center w-10 h-7 rounded-lg border border-dashed border-white/10 text-muted-foreground/30 text-xs"
          >
            —
          </span>
        ))}
      </div>

      {wins.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {wins.length} match {wins.length === 1 ? "win" : "wins"}
          {winsRank != null && ` · #${winsRank} all-time`}
          {totalMatches > 0 && ` of ${totalMatches} played`}
        </p>
      )}
      {wins.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No match wins yet — next one could be yours</p>
      )}
    </div>
  )
}

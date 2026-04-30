interface Props {
  playerName: string
  teamShortName: string
  pts: number
  ownershipCount: number
  totalUsers: number
}

export function MatchGemCallout({ playerName, teamShortName, pts, ownershipCount, totalUsers }: Props) {
  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
      <span className="text-lg shrink-0">💎</span>
      <div>
        <span className="font-semibold">Match Gem — </span>
        <span>{playerName}</span>
        <span className="text-muted-foreground"> ({teamShortName}, {pts} pts)</span>
        <span className="text-muted-foreground"> — picked by {ownershipCount} of {totalUsers}</span>
      </div>
    </div>
  )
}

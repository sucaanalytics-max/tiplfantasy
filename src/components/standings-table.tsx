import { StandingsRow } from "@/components/standings-row"

export interface StandingsEntry {
  user_id: string
  display_name: string
  total_points: number
  season_rank: number
}

interface Props {
  entries: StandingsEntry[]
  currentUserId: string
  myRank?: StandingsEntry | null
}

export function StandingsTable({ entries, currentUserId, myRank }: Props) {
  const leader = entries[0]
  const showMeOutside = myRank != null && myRank.season_rank > entries.length
  const meInList = entries.some((e) => e.user_id === currentUserId)

  return (
    <div className="glass rounded-2xl overflow-hidden divide-y divide-overlay-border stagger-children">
      {/* Header row — shares grid columns with data rows for vertical alignment */}
      <div className="standings-grid px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium bg-overlay-subtle">
        <span className="text-center">#</span>
        <span />
        <span>Player</span>
        <span className="text-right tabular-nums">Pts</span>
        <span className="text-right tabular-nums">Gap</span>
      </div>

      {entries.map((entry, idx) => {
        const gap = idx === 0 || !leader ? null : Number(entry.total_points) - Number(leader.total_points)
        return (
          <StandingsRow
            key={entry.user_id}
            rank={entry.season_rank}
            displayName={entry.display_name}
            isMe={entry.user_id === currentUserId}
            gap={gap}
            points={entry.total_points}
          />
        )
      })}

      {showMeOutside && myRank && !meInList && (
        <>
          <div className="text-center py-1.5 text-muted-foreground text-xs">···</div>
          <StandingsRow
            rank={myRank.season_rank}
            displayName={myRank.display_name}
            isMe
            gap={leader ? Number(myRank.total_points) - Number(leader.total_points) : null}
            points={myRank.total_points}
          />
        </>
      )}
    </div>
  )
}

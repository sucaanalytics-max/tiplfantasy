"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Users } from "lucide-react"

export function LeaderboardSelector({
  leagues,
  currentLeagueId,
}: {
  leagues: { id: string; name: string }[]
  currentLeagueId: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (value === "overall") {
      params.delete("league")
    } else {
      params.set("league", value)
    }
    router.push(`/leaderboard?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <select
        value={currentLeagueId ?? "overall"}
        onChange={handleChange}
        className="text-sm bg-secondary border border-border rounded-md px-2 py-1.5 text-foreground"
      >
        <option value="overall">Overall</option>
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  )
}

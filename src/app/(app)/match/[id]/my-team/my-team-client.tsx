"use client"

import { useRouter } from "next/navigation"
import { TeamSubmitPreview } from "@/components/team-submit-preview"
import type { PlayerWithTeam, MatchWithTeams } from "@/lib/types"

type Props = {
  players: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
  match: MatchWithTeams
}

export function MyTeamClient({ players, captainId, viceCaptainId, match }: Props) {
  const router = useRouter()
  return (
    <TeamSubmitPreview
      players={players}
      captainId={captainId}
      viceCaptainId={viceCaptainId}
      match={match}
      mode="view"
      onDone={() => router.back()}
    />
  )
}

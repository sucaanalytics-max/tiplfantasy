import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CricketField } from "@/components/cricket-field"
import { cn } from "@/lib/utils"
import { ROLE_COLORS, CAPTAIN_BADGE, VICE_CAPTAIN_BADGE } from "@/lib/badges"
import type { PlayerWithTeam, MatchWithTeams, PlayerRole } from "@/lib/types"

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]

const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "WK",
  BAT: "BAT",
  AR: "AR",
  BOWL: "BOWL",
}

type Props = {
  players: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
  match: MatchWithTeams
  isUpdate?: boolean
  onDone: () => void
}

export function TeamSubmitPreview({
  players,
  captainId,
  viceCaptainId,
  match,
  isUpdate,
  onDone,
}: Props) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-tight font-display">
            {isUpdate ? "Team Updated!" : "Team Submitted!"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {match.team_home.short_name} vs {match.team_away.short_name}
          {" · "}Match {match.match_number}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {/* Cricket field */}
        <div className="px-4 mb-4">
          <CricketField players={players} captainId={captainId} viceCaptainId={viceCaptainId} />
        </div>

        {/* Player list grouped by role */}
        <div className="px-4 max-w-xl mx-auto space-y-1">
          {ROLE_ORDER.map((role) => {
            const rolePlayers = players.filter((p) => p.role === role)
            if (rolePlayers.length === 0) return null
            return rolePlayers.map((player) => {
              const isCaptain = player.id === captainId
              const isViceCaptain = player.id === viceCaptainId
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-secondary/40 border border-border/40"
                >
                  {/* Role pill */}
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0",
                      ROLE_COLORS[role as PlayerRole]
                    )}
                  >
                    {ROLE_LABELS[role as PlayerRole]}
                  </span>

                  {/* Name + team */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{player.name}</p>
                    <p className="text-[11px] text-muted-foreground">{player.team.short_name}</p>
                  </div>

                  {/* C / VC badge */}
                  {isCaptain && (
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", CAPTAIN_BADGE)}>
                      C
                    </span>
                  )}
                  {isViceCaptain && (
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", VICE_CAPTAIN_BADGE)}>
                      VC
                    </span>
                  )}

                  {/* Credits */}
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {(player.credit_cost ?? 0).toFixed(1)}
                  </span>
                </div>
              )
            })
          })}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 bg-background/90 backdrop-blur border-t border-border md:left-56">
        <div className="max-w-xl mx-auto">
          <Button
            onClick={onDone}
            className="w-full bg-gradient-to-r from-primary to-emerald-400 text-black font-semibold"
          >
            View Matches
          </Button>
        </div>
      </div>
    </div>
  )
}

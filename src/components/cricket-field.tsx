import type { PlayerWithTeam } from "@/lib/types"
import { cn } from "@/lib/utils"

const roleZones: Record<string, { top: string; label: string }> = {
  WK: { top: "8%", label: "WICKET-KEEPERS" },
  BAT: { top: "28%", label: "BATTERS" },
  AR: { top: "52%", label: "ALL-ROUNDERS" },
  BOWL: { top: "76%", label: "BOWLERS" },
}

export function CricketField({
  players,
  captainId,
  viceCaptainId,
}: {
  players: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
}) {
  const grouped = {
    WK: players.filter((p) => p.role === "WK"),
    BAT: players.filter((p) => p.role === "BAT"),
    AR: players.filter((p) => p.role === "AR"),
    BOWL: players.filter((p) => p.role === "BOWL"),
  }

  return (
    <div className="relative w-full aspect-[3/4] max-w-sm mx-auto rounded-[50%] bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-800 overflow-hidden">
      {/* Pitch strip */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-24 bg-emerald-500/40 rounded-sm" />
      {/* Crease lines */}
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 w-12 h-px bg-white/30" />
      <div className="absolute left-1/2 top-[62%] -translate-x-1/2 w-12 h-px bg-white/30" />

      {/* Role zones */}
      {(["WK", "BAT", "AR", "BOWL"] as const).map((role) => {
        const zone = roleZones[role]
        const rolePlayers = grouped[role]
        if (rolePlayers.length === 0) return null

        return (
          <div
            key={role}
            className="absolute left-0 right-0"
            style={{ top: zone.top }}
          >
            <p className="text-[9px] font-semibold text-white/50 uppercase tracking-wider text-center mb-1">
              {zone.label}
            </p>
            <div className="flex justify-center gap-2 px-4 flex-wrap">
              {rolePlayers.map((player) => {
                const isCaptain = player.id === captainId
                const isVC = player.id === viceCaptainId
                const name =
                  player.name.length > 10
                    ? player.name.split(" ").pop()?.slice(0, 10) ?? player.name.slice(0, 10)
                    : player.name

                return (
                  <div key={player.id} className="flex flex-col items-center gap-0.5">
                    {/* Avatar circle */}
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full bg-slate-700/80 border-2 flex items-center justify-center text-white text-xs font-bold"
                        style={{ borderColor: player.team.color }}
                      >
                        {player.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      {(isCaptain || isVC) && (
                        <span
                          className={cn(
                            "absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center",
                            isCaptain
                              ? "bg-amber-400 text-black"
                              : "bg-violet-400 text-black"
                          )}
                        >
                          {isCaptain ? "C" : "VC"}
                        </span>
                      )}
                    </div>
                    {/* Name pill */}
                    <span className="bg-slate-900/80 text-white text-[9px] font-medium px-1.5 py-0.5 rounded max-w-[72px] truncate">
                      {name}
                    </span>
                    <span className="text-[8px] text-white/50">
                      {player.credit_cost} Cr
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

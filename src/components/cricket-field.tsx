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
  size = "sm",
}: {
  players: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
  size?: "sm" | "lg"
}) {
  const isLg = size === "lg"
  const grouped = {
    WK: players.filter((p) => p.role === "WK"),
    BAT: players.filter((p) => p.role === "BAT"),
    AR: players.filter((p) => p.role === "AR"),
    BOWL: players.filter((p) => p.role === "BOWL"),
  }

  return (
    <div className={cn(
      "relative w-full aspect-[3/4] mx-auto rounded-[50%] bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-800 overflow-hidden",
      isLg ? "max-w-md" : "max-w-sm"
    )}>
      {/* Pitch strip */}
      <div className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500/40 rounded-sm", isLg ? "w-10 h-28" : "w-8 h-24")} />
      {/* Crease lines */}
      <div className={cn("absolute left-1/2 top-[38%] -translate-x-1/2 h-px bg-white/30", isLg ? "w-14" : "w-12")} />
      <div className={cn("absolute left-1/2 top-[62%] -translate-x-1/2 h-px bg-white/30", isLg ? "w-14" : "w-12")} />

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
            <p className={cn("font-semibold text-white/50 uppercase tracking-wider text-center mb-1", isLg ? "text-[10px]" : "text-[9px]")}>
              {zone.label}
            </p>
            <div className={cn("flex justify-center flex-wrap", isLg ? "gap-3 px-6" : "gap-2 px-4")}>
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
                        className={cn(
                          "rounded-full bg-slate-700/80 border-2 flex items-center justify-center text-white font-bold",
                          isLg ? "w-12 h-12 text-sm" : "w-10 h-10 text-xs"
                        )}
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
                            "absolute -top-1 -right-1 rounded-full font-bold flex items-center justify-center",
                            isLg ? "w-5 h-5 text-[9px]" : "w-4 h-4 text-[8px]",
                            isCaptain
                              ? "bg-[var(--tw-amber-text)] text-black"
                              : "bg-violet-400 text-black"
                          )}
                        >
                          {isCaptain ? "C" : "VC"}
                        </span>
                      )}
                    </div>
                    {/* Name pill */}
                    <span className={cn(
                      "bg-slate-900/80 text-white font-medium px-1.5 py-0.5 rounded truncate",
                      isLg ? "text-[10px] max-w-[84px]" : "text-[9px] max-w-[72px]"
                    )}>
                      {name}
                    </span>
                    <span className={cn("text-white/50", isLg ? "text-[9px]" : "text-[8px]")}>
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

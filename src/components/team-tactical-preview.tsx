import { Crown } from "@/components/icons/cricket-icons"
import { Star } from "lucide-react"
import { TeamLogo } from "@/components/team-logo"
import { PlayerHeadshot } from "@/components/player-headshot"
import { cn } from "@/lib/utils"
import type { PlayerWithTeam, PlayerRole, MatchWithTeams, TiplMatchEntry } from "@/lib/types"

const ROLE_ORDER: PlayerRole[] = ["WK", "BAT", "AR", "BOWL"]
const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: "Wicket-keepers",
  BAT: "Batters",
  AR: "All-rounders",
  BOWL: "Bowlers",
}

interface Props {
  selectedPlayers: PlayerWithTeam[]
  captainId: string | null
  viceCaptainId: string | null
  match: MatchWithTeams
  totalCost: number
  totalBudget: number
  tiplMatchLog: Record<string, TiplMatchEntry[]>
}

function getStats(playerId: string, log: Record<string, TiplMatchEntry[]>) {
  const entries = log[playerId] ?? []
  if (entries.length === 0) return { total: null as number | null, avg: null as number | null }
  const total = entries.reduce((acc, e) => acc + e.fantasyPoints, 0)
  return { total, avg: Math.round(total / entries.length) }
}

export function TeamTacticalPreview({
  selectedPlayers,
  captainId,
  viceCaptainId,
  match,
  totalCost,
  totalBudget,
  tiplMatchLog,
}: Props) {
  const captain = selectedPlayers.find((p) => p.id === captainId) ?? null
  const viceCaptain = selectedPlayers.find((p) => p.id === viceCaptainId) ?? null

  // Team balance
  const homeCount = selectedPlayers.filter((p) => p.team_id === match.team_home_id).length
  const awayCount = selectedPlayers.filter((p) => p.team_id === match.team_away_id).length
  const totalForBalance = Math.max(homeCount + awayCount, 1)

  // Projected fantasy points
  // Sum of all 11 players' season averages, with C × 2 and VC × 1.5 multipliers (so add 1× C avg + 0.5× VC avg).
  let projected = 0
  let projectedHasData = false
  for (const p of selectedPlayers) {
    const { avg } = getStats(p.id, tiplMatchLog)
    if (avg != null) {
      projected += avg
      projectedHasData = true
    }
  }
  if (captain) {
    const { avg } = getStats(captain.id, tiplMatchLog)
    if (avg != null) projected += avg // C × 2 means +1 extra × of C's avg
  }
  if (viceCaptain) {
    const { avg } = getStats(viceCaptain.id, tiplMatchLog)
    if (avg != null) projected += avg * 0.5 // VC × 1.5 means +0.5 extra
  }

  const creditsPct = Math.min(100, (totalCost / totalBudget) * 100)
  const homePct = (homeCount / totalForBalance) * 100

  return (
    <div className="space-y-5">
      {/* ── Header: counts + credit bar ─────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-gold-stat text-2xl leading-none">{selectedPlayers.length}</span>
            <span className="text-sm text-muted-foreground">/ 11 picked</span>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="font-display font-bold text-base tabular-nums">{totalCost.toFixed(1)}</span>
              <span className="text-2xs text-muted-foreground">/ {totalBudget} cr</span>
            </div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-overlay-subtle overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              creditsPct >= 100 ? "bg-status-danger" : creditsPct >= 90 ? "bg-status-warning" : "bg-primary"
            )}
            style={{ width: `${creditsPct}%` }}
          />
        </div>
      </div>

      {/* ── Team balance ─────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5">
            <TeamLogo team={match.team_home} size="sm" />
            <span style={{ color: match.team_home.color }}>{match.team_home.short_name}</span>
            <span className="text-foreground font-display font-bold tabular-nums">{homeCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-foreground font-display font-bold tabular-nums">{awayCount}</span>
            <span style={{ color: match.team_away.color }}>{match.team_away.short_name}</span>
            <TeamLogo team={match.team_away} size="sm" />
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-overlay-muted">
          <div
            className="transition-all"
            style={{ width: `${homePct}%`, backgroundColor: match.team_home.color }}
          />
          <div
            className="transition-all flex-1"
            style={{ backgroundColor: match.team_away.color }}
          />
        </div>
        {(homeCount > 7 || awayCount > 7) && (
          <p className="text-2xs text-status-danger">Max 7 from a single team — adjust your picks</p>
        )}
      </div>

      {/* ── Captain hero ─────────────────────────────────── */}
      {captain ? (
        <CaptainCard
          player={captain}
          stats={getStats(captain.id, tiplMatchLog)}
          variant="captain"
        />
      ) : (
        <NotSetCard label="Captain not set" multiplier="× 2 pts" />
      )}

      {/* ── Vice-captain hero ────────────────────────────── */}
      {viceCaptain ? (
        <CaptainCard
          player={viceCaptain}
          stats={getStats(viceCaptain.id, tiplMatchLog)}
          variant="vc"
        />
      ) : (
        <NotSetCard label="Vice-captain not set" multiplier="× 1.5 pts" />
      )}

      {/* ── Role groups ──────────────────────────────────── */}
      <div className="space-y-3">
        {ROLE_ORDER.map((role) => {
          const rolePlayers = selectedPlayers.filter((p) => p.role === role)
          if (rolePlayers.length === 0) return null
          return (
            <div key={role} className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs uppercase tracking-widest text-muted-foreground font-semibold">
                <span>{ROLE_LABELS[role]}</span>
                <span className="tabular-nums">{rolePlayers.length}</span>
              </div>
              <div className="rounded-xl border border-overlay-border overflow-hidden divide-y divide-overlay-border">
                {rolePlayers.map((p) => {
                  const stats = getStats(p.id, tiplMatchLog)
                  const isC = p.id === captainId
                  const isVC = p.id === viceCaptainId
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 px-3 py-2 bg-card"
                      style={{ borderLeft: `3px solid ${p.team.color}` }}
                    >
                      <TeamLogo team={p.team} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate flex items-center gap-1.5">
                          {p.name}
                          {isC && <Crown className="h-3.5 w-3.5 text-accent shrink-0" />}
                          {isVC && <Star className="h-3 w-3 text-violet-400 shrink-0 fill-violet-400" />}
                        </p>
                        <p className="text-2xs text-muted-foreground truncate">
                          <span style={{ color: p.team.color }}>{p.team.short_name}</span>
                          <span className="text-muted-foreground/50"> · </span>
                          {p.credit_cost.toFixed(1)} Cr
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {stats.total != null ? (
                          <>
                            <p className="text-gold-stat text-sm leading-none tabular-nums">{stats.total}</p>
                            <p className="text-[10px] text-muted-foreground tabular-nums">avg {stats.avg}</p>
                          </>
                        ) : (
                          <p className="text-2xs text-muted-foreground/40">—</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer: projected ────────────────────────────── */}
      {projectedHasData && (
        <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-3 flex items-center justify-between">
          <div>
            <p className="text-2xs uppercase tracking-widest text-muted-foreground font-semibold">Projected next match</p>
            <p className="text-2xs text-muted-foreground">Based on season averages · C × 2 · VC × 1.5</p>
          </div>
          <div className="text-right">
            <p className="text-gold-stat text-2xl leading-none">{Math.round(projected)}</p>
            <p className="text-2xs text-muted-foreground">pts</p>
          </div>
        </div>
      )}
    </div>
  )
}

function CaptainCard({
  player,
  stats,
  variant,
}: {
  player: PlayerWithTeam
  stats: { total: number | null; avg: number | null }
  variant: "captain" | "vc"
}) {
  const isC = variant === "captain"
  return (
    <div
      className={cn(
        "rounded-xl border-2 p-3 flex items-center gap-3 relative overflow-hidden",
        isC ? "border-accent/40 bg-accent/[0.06]" : "border-violet-400/30 bg-violet-400/[0.04]"
      )}
    >
      {/* Top-right multiplier chip */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {isC ? (
          <span className="tag-pill-gold">
            <Crown className="h-2.5 w-2.5" />
            CAPTAIN · ×2
          </span>
        ) : (
          <span className="tag-pill-gold !bg-violet-500 !text-white">
            <Star className="h-2.5 w-2.5 fill-white" />
            VICE · ×1.5
          </span>
        )}
      </div>

      {/* Photo */}
      <PlayerHeadshot player={player} size="lg" ring="team" />


      <div className="flex-1 min-w-0 mt-5">
        <p className="font-display font-bold text-base leading-tight truncate">{player.name}</p>
        <p className="text-2xs text-muted-foreground truncate mt-0.5">
          <span className="font-semibold" style={{ color: player.team.color }}>{player.team.short_name}</span>
          <span className="text-muted-foreground/50"> · </span>
          {player.credit_cost.toFixed(1)} Cr
        </p>
        {stats.total != null && (
          <p className="text-xs mt-1 tabular-nums">
            <span className="text-gold-stat text-base leading-none">{stats.total}</span>
            <span className="text-muted-foreground ml-1">pts</span>
            <span className="text-muted-foreground/50"> · </span>
            <span className="text-muted-foreground">avg {stats.avg}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function NotSetCard({ label, multiplier }: { label: string; multiplier: string }) {
  return (
    <div className="rounded-xl border border-dashed border-overlay-border-hover p-3 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <span className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">{multiplier}</span>
    </div>
  )
}

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { TeamLogo } from "@/components/team-logo"
import { cn } from "@/lib/utils"

interface Team {
  short_name: string
  name?: string | null
  color: string
  logo_url?: string | null
}

export interface TopPerformer {
  name: string
  role: string
  teamShortName: string
  fantasyPoints: number
}

export interface MatchResultData {
  matchId: string
  matchNumber: number
  startTime: string
  teamHome: Team
  teamAway: Team
  winnerDisplayName: string | null
  winnerPoints: number | null
  userScore: number
  userRank: number | null
  captainName: string | null
  captainBasePoints: number | null
  avgScore: number | null
  maxScore: number | null
  h2hTarget: { displayName: string; score: number } | null
  topPerformers: TopPerformer[]
}

export function MatchResultCard({ data }: { data: MatchResultData }) {
  const {
    matchId, matchNumber, startTime, teamHome, teamAway,
    winnerDisplayName, winnerPoints, userScore, userRank,
    captainName, captainBasePoints,
    avgScore, maxScore, h2hTarget,
    topPerformers,
  } = data

  const relativeTime = formatDistanceToNow(new Date(startTime), { addSuffix: true })

  return (
    <Link href={`/match/${matchId}/scores`} className="block group">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-overlay-border">
          <div className="flex items-center gap-2">
            <TeamLogo team={teamHome} size="sm" />
            <span className="text-xs text-muted-foreground font-medium">vs</span>
            <TeamLogo team={teamAway} size="sm" />
            <span className="text-xs font-semibold">M{matchNumber}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{relativeTime}</span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {/* Winner row + your result */}
          <div className="px-4 py-3 space-y-1.5">
            {winnerDisplayName && winnerPoints != null && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🥇</span>
                  <span className="text-sm font-semibold truncate max-w-[140px]">{winnerDisplayName}</span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--captain-gold)" }}>
                  {Math.round(winnerPoints)} pts
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {userRank != null && (
                  <span className="text-[10px] font-bold text-muted-foreground w-6">#{userRank}</span>
                )}
                <span className="text-sm font-semibold text-primary">You</span>
                {captainName && (
                  <span className="text-[9px] text-muted-foreground">
                    <span className="text-primary font-bold">©</span> {captainName}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {Math.round(userScore)} pts
              </span>
            </div>
          </div>

          {/* Captain scorecard */}
          {captainName != null && captainBasePoints != null && (
            <div className="px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-bold text-primary">©</span>{" "}
                <span className="font-medium">{captainName}</span>
                {" · "}
                <span className="tabular-nums">{captainBasePoints} × 2 = </span>
                <span className="font-bold tabular-nums">{captainBasePoints * 2} pts</span>
              </p>
            </div>
          )}

          {/* You vs avg bars */}
          {avgScore != null && maxScore != null && maxScore > 0 && (
            <div className="px-4 py-3 space-y-1.5">
              <ScoreBar label="You" score={userScore} max={maxScore} color="var(--primary)" />
              <ScoreBar label="Avg" score={avgScore} max={maxScore} color="oklch(0.55 0 0 / 0.5)" />
              <ScoreBar label="Best" score={maxScore} max={maxScore} color="var(--captain-gold)" />
              <p className={cn(
                "text-[11px] font-semibold mt-1",
                userScore >= avgScore ? "text-emerald-400" : "text-rose-400"
              )}>
                {userScore >= avgScore
                  ? `+${Math.round(userScore - avgScore)} above avg`
                  : `−${Math.round(avgScore - userScore)} below avg`}
              </p>
            </div>
          )}

          {/* H2H spotlight */}
          {h2hTarget && (
            <div className="px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-5 w-5 rounded-md flex items-center justify-center text-white text-[8px] font-semibold shrink-0"
                  style={{ background: "var(--primary)" }}
                >
                  You
                </span>
                <span className="text-sm font-bold tabular-nums">{Math.round(userScore)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-bold">VS</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tabular-nums">{Math.round(h2hTarget.score)}</span>
                <span
                  className={cn(
                    "h-5 w-5 rounded-md flex items-center justify-center text-white text-[8px] font-semibold shrink-0",
                    getAvatarColor(h2hTarget.displayName)
                  )}
                >
                  {getInitials(h2hTarget.displayName).slice(0, 2)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {userScore > h2hTarget.score ? "you won" : userScore < h2hTarget.score ? "they won" : "draw"}
              </span>
            </div>
          )}

          {/* Top performers */}
          {topPerformers.length > 0 && (
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-2">Top Performers</p>
              {topPerformers.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-[10px] w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                  <div
                    className={cn("h-6 w-6 rounded-md flex items-center justify-center text-white text-[9px] font-semibold shrink-0", getAvatarColor(p.name))}
                  >
                    {getInitials(p.name).slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{p.name.split(" ")[0]}</span>
                    <span className="text-muted-foreground text-[10px] ml-1">{p.role} · {p.teamShortName}</span>
                  </div>
                  <span className="tabular-nums text-xs font-bold" style={{ color: "var(--captain-gold)" }}>
                    {Math.round(p.fantasyPoints)} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function ScoreBar({
  label,
  score,
  max,
  color,
}: {
  label: string
  score: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-7 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right shrink-0">
        {Math.round(score)}
      </span>
    </div>
  )
}

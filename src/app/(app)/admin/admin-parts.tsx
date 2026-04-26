import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronRight } from "lucide-react"
import { formatIST } from "@/lib/utils"

export const STATUS_COLOR: Record<string, string> = {
  upcoming: "bg-status-upcoming-bg text-status-upcoming border-status-upcoming/20",
  live: "bg-status-live-bg text-status-live border-status-live/20",
  completed: "bg-status-completed-bg text-status-completed border-status-completed/20",
  no_result: "bg-status-warning-bg text-status-warning border-status-warning/20",
  abandoned: "bg-status-danger-bg text-status-danger border-status-danger/20",
}

export type AdminMatch = {
  id: string
  match_number: number
  team_home_id: string
  team_away_id: string
  venue: string | null
  start_time: string
  status: string
}

export type AdminTeam = { id: string; short_name: string; color: string }

export function StatChip({
  count,
  label,
  tone,
  emphasis,
}: {
  count: number
  label: string
  tone: "upcoming" | "live" | "completed" | "muted"
  emphasis?: boolean
}) {
  const toneCls =
    tone === "live"
      ? emphasis
        ? "bg-status-live-bg text-status-live border-status-live/30"
        : "bg-overlay-subtle text-muted-foreground border-overlay-border"
      : tone === "upcoming"
      ? "bg-status-upcoming-bg text-status-upcoming border-status-upcoming/20"
      : tone === "completed"
      ? "bg-overlay-subtle text-zinc-300 border-overlay-border"
      : "bg-overlay-subtle text-muted-foreground border-overlay-border"
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border tabular-nums ${toneCls}`}>
      <span className="font-semibold">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  )
}

export function SectionHeader({
  children,
  count,
}: {
  children: React.ReactNode
  count?: number
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {children}
      </span>
      {count !== undefined && (
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">{count}</span>
      )}
    </div>
  )
}

export function MatchRow({
  match,
  teamMap,
  count,
}: {
  match: AdminMatch
  teamMap: Map<string, AdminTeam>
  count: number
}) {
  const home = teamMap.get(match.team_home_id)
  const away = teamMap.get(match.team_away_id)
  return (
    <Link href={`/admin/match/${match.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between py-2.5 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-muted-foreground font-mono w-7 shrink-0">
              #{match.match_number}
            </span>
            <div className="min-w-0">
              <div className="font-medium truncate">
                {home?.short_name ?? "?"} vs {away?.short_name ?? "?"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {formatIST(match.start_time, "MMM d, h:mm a")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
              {count} pick{count !== 1 ? "s" : ""}
            </span>
            <Badge variant="outline" className={STATUS_COLOR[match.status] ?? ""}>
              {match.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function NextMatchHero({
  match,
  teamMap,
  count,
}: {
  match: AdminMatch
  teamMap: Map<string, AdminTeam>
  count: number
}) {
  const home = teamMap.get(match.team_home_id)
  const away = teamMap.get(match.team_away_id)
  const countdown = formatCountdown(new Date(match.start_time).getTime() - Date.now())
  return (
    <Link href={`/admin/match/${match.id}`}>
      <Card className="border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.08] transition-colors cursor-pointer ring-1 ring-primary/10">
        <CardContent className="py-4 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-mono">#{match.match_number}</span>
                {countdown && (
                  <>
                    <span>·</span>
                    <span className="text-primary font-medium">{countdown}</span>
                  </>
                )}
              </div>
              <div className="text-lg font-bold tracking-tight">
                <span style={{ color: home?.color ?? "inherit" }}>{home?.short_name ?? "?"}</span>
                <span className="text-foreground mx-2 font-medium opacity-60">vs</span>
                <span style={{ color: away?.color ?? "inherit" }}>{away?.short_name ?? "?"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5 truncate">
                {match.venue ? `${match.venue} · ` : ""}
                {formatIST(match.start_time, "EEE, MMM d · h:mm a")} IST
              </div>
              <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                {count} pick{count !== 1 ? "s" : ""} submitted
              </div>
            </div>
            <div className="flex items-center text-primary text-sm font-medium shrink-0 self-center">
              Manage
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function formatCountdown(ms: number): string | null {
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60000)
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = minutes % 60
  if (days >= 1) return `in ${days}d ${hours}h`
  if (hours >= 1) return `in ${hours}h ${mins}m`
  if (mins >= 1) return `in ${mins}m`
  return "starting soon"
}

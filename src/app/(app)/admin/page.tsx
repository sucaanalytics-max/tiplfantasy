import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"
import { SeriesImportClient } from "./series-import-client"
import {
  StatChip,
  SectionHeader,
  MatchRow,
  NextMatchHero,
  type AdminMatch,
  type AdminTeam,
} from "./admin-parts"

const TOOLS = [
  { href: "/admin/players", emoji: "\u{1F3CF}", title: "Players", subtitle: "Manage player roster" },
  { href: "/admin/analytics", emoji: "\u{1F4CA}", title: "Analytics", subtitle: "Stats, ratings, predictions" },
  { href: "/admin/preferences", emoji: "\u{1F5D2}\u{FE0F}", title: "Preferences", subtitle: "User pick bias & captaincy" },
] as const

const COMPLETED_DEFAULT = 10

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  const [matchesRes, teamsRes, selectionsRes] = await Promise.all([
    supabase
      .from("matches")
      .select("id, match_number, team_home_id, team_away_id, venue, start_time, status")
      .order("start_time", { ascending: true })
      .limit(200),
    supabase.from("teams").select("id, short_name, color").limit(20),
    supabase.from("selections").select("match_id").limit(20000),
  ])

  const matches = (matchesRes.data ?? []) as AdminMatch[]
  const teams = (teamsRes.data ?? []) as AdminTeam[]
  const teamMap = new Map(teams.map((t) => [t.id, t]))

  const countByMatch = new Map<string, number>()
  for (const s of selectionsRes.data ?? []) {
    countByMatch.set(s.match_id, (countByMatch.get(s.match_id) ?? 0) + 1)
  }

  const live = matches.filter((m) => m.status === "live")
  const upcoming = matches.filter((m) => m.status === "upcoming")
  const finished = matches
    .filter((m) => m.status === "completed" || m.status === "no_result" || m.status === "abandoned")
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  const stats = {
    upcoming: upcoming.length,
    live: live.length,
    completed: matches.filter((m) => m.status === "completed").length,
    total: matches.length,
  }

  const nextMatch = upcoming[0] ?? null
  const restUpcoming = upcoming.slice(1)
  const completedShown = finished.slice(0, COMPLETED_DEFAULT)
  const completedHidden = finished.slice(COMPLETED_DEFAULT)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <StatChip count={stats.upcoming} label="upcoming" tone="upcoming" />
          <StatChip count={stats.live} label="live" tone="live" emphasis={stats.live > 0} />
          <StatChip count={stats.completed} label="done" tone="completed" />
          <StatChip count={stats.total} label="total" tone="muted" />
        </div>
      </div>

      <div>
        <SectionHeader>Tools</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardContent className="flex items-center gap-3 py-4 px-4">
                  <span className="text-2xl shrink-0">{t.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {live.length > 0 && (
        <div>
          <SectionHeader>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative inline-flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-live opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-live" />
              </span>
              Live now
            </span>
          </SectionHeader>
          <div className="space-y-2">
            {live.map((m) => (
              <MatchRow key={m.id} match={m} teamMap={teamMap} count={countByMatch.get(m.id) ?? 0} />
            ))}
          </div>
        </div>
      )}

      {nextMatch && (
        <div>
          <SectionHeader>Next match</SectionHeader>
          <NextMatchHero match={nextMatch} teamMap={teamMap} count={countByMatch.get(nextMatch.id) ?? 0} />
        </div>
      )}

      {restUpcoming.length > 0 && (
        <div>
          <SectionHeader count={restUpcoming.length}>Upcoming</SectionHeader>
          <div className="space-y-2">
            {restUpcoming.map((m) => (
              <MatchRow key={m.id} match={m} teamMap={teamMap} count={countByMatch.get(m.id) ?? 0} />
            ))}
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <SectionHeader count={finished.length}>Recently completed</SectionHeader>
          <div className="space-y-2">
            {completedShown.map((m) => (
              <MatchRow key={m.id} match={m} teamMap={teamMap} count={countByMatch.get(m.id) ?? 0} />
            ))}
          </div>
          {completedHidden.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent/50">
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                Show all {finished.length} completed
              </summary>
              <div className="mt-2 space-y-2">
                {completedHidden.map((m) => (
                  <MatchRow key={m.id} match={m} teamMap={teamMap} count={countByMatch.get(m.id) ?? 0} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div>
        <SectionHeader>Series import</SectionHeader>
        <SeriesImportClient />
      </div>
    </div>
  )
}

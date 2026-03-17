import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  // Fetch match stats
  const { data: matches } = await supabase
    .from("matches")
    .select("id, match_number, team_home_id, team_away_id, venue, start_time, status")
    .order("match_number", { ascending: true })

  // Fetch teams for display
  const { data: teams } = await supabase.from("teams").select("id, short_name, color")
  const teamMap = new Map(teams?.map((t) => [t.id, t]) ?? [])

  // Fetch selection counts per match
  const { data: selectionCounts } = await supabase
    .from("selections")
    .select("match_id")

  const countByMatch = new Map<string, number>()
  for (const s of selectionCounts ?? []) {
    countByMatch.set(s.match_id, (countByMatch.get(s.match_id) ?? 0) + 1)
  }

  const stats = {
    upcoming: matches?.filter((m) => m.status === "upcoming").length ?? 0,
    live: matches?.filter((m) => m.status === "live").length ?? 0,
    completed: matches?.filter((m) => m.status === "completed").length ?? 0,
    total: matches?.length ?? 0,
  }

  const statusColor: Record<string, string> = {
    upcoming: "bg-status-upcoming-bg text-status-upcoming border-status-upcoming/20",
    live: "bg-status-live-bg text-status-live border-status-live/20",
    completed: "bg-status-completed-bg text-status-completed border-status-completed/20",
    no_result: "bg-status-warning-bg text-status-warning border-status-warning/20",
    abandoned: "bg-status-danger-bg text-status-danger border-status-danger/20",
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">League management</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{stats.upcoming}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-live">{stats.live}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-400">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/tokens">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <span className="text-2xl">&#129689;</span>
              <div>
                <p className="font-medium">Token Management</p>
                <p className="text-xs text-muted-foreground">Grant & manage H2H tokens</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/players">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <span className="text-2xl">&#127951;</span>
              <div>
                <p className="font-medium">Players</p>
                <p className="text-xs text-muted-foreground">Manage player roster</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Match list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Matches</h2>
        {matches?.map((match) => {
          const home = teamMap.get(match.team_home_id)
          const away = teamMap.get(match.team_away_id)
          const selections = countByMatch.get(match.id) ?? 0

          return (
            <Link key={match.id} href={`/admin/match/${match.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      #{match.match_number}
                    </span>
                    <div>
                      <div className="font-medium">
                        {home?.short_name ?? "?"} vs {away?.short_name ?? "?"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(match.start_time), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {selections} pick{selections !== 1 ? "s" : ""}
                    </span>
                    <Badge variant="outline" className={statusColor[match.status] ?? ""}>
                      {match.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

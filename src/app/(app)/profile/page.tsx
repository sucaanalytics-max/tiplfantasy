export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Target, TrendingUp, TrendingDown, BookOpen, ChevronRight } from "lucide-react"
import { ProfileNameForm } from "./name-form"
import { SignOutButton } from "./sign-out-button"
import { ThemeCard } from "./theme-card"
import { AutoPickToggle } from "./auto-pick-toggle"
import { MatchHistoryTable, type MatchHistoryRow } from "./match-history-table"
import { StatCard } from "@/components/stat-card"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { PageTransition } from "@/components/page-transition"
import { cn } from "@/lib/utils"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Phase 1: all independent queries in parallel
  const [
    profileRes,
    myRankRes,
    matchScoresRes,
    teamsRes,
    captainRes,
    selectionsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("season_leaderboard").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_match_scores").select("*, match:matches(match_number, team_home_id, team_away_id, start_time)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("teams").select("id, short_name, color, logo_url").limit(20),
    supabase.from("selections").select("match_id, captain_id, vice_captain_id, captain:players!selections_captain_id_fkey(name), vc:players!selections_vice_captain_id_fkey(name)").eq("user_id", user.id).limit(200),
    supabase.from("selections").select("id").eq("user_id", user.id).limit(200),
  ])

  const profile = profileRes.data
  const myRank = myRankRes.data
  const matchScores = matchScoresRes.data
  const teamMap = new Map(teamsRes.data?.map((t) => [t.id, t]) ?? [])
  const captainData = captainRes.data
  const selectionIds = (selectionsRes.data ?? []).map((s) => s.id)

  // Phase 2: role counts + most-picked team — depends on selectionIds
  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  const teamPickCounts = new Map<string, number>()
  if (selectionIds.length > 0) {
    const { data: selPlayers } = await supabase
      .from("selection_players")
      .select("player:players(role, team_id)")
      .in("selection_id", selectionIds)
      .limit(900)
    for (const sp of selPlayers ?? []) {
      const player = sp.player as unknown as { role: string; team_id: string } | null
      const role = player?.role
      if (role && role in roleCounts) roleCounts[role as keyof typeof roleCounts]++
      if (player?.team_id) teamPickCounts.set(player.team_id, (teamPickCounts.get(player.team_id) ?? 0) + 1)
    }
  }
  // Tint the hero backdrop with the user's most-picked team color when available
  const topTeamId = teamPickCounts.size > 0
    ? Array.from(teamPickCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null
  const heroTintColor = topTeamId ? teamMap.get(topTeamId)?.color ?? null : null

  // Best and worst match
  const sorted = [...(matchScores ?? [])].sort((a, b) => b.total_points - a.total_points)
  const bestMatch = sorted[0] ?? null
  const worstMatch = sorted.length > 1 ? sorted[sorted.length - 1] : null
  const totalPicks = Object.values(roleCounts).reduce((a, b) => a + b, 0)

  const captainCounts = new Map<string, { name: string; count: number }>()
  for (const s of captainData ?? []) {
    const name = (s.captain as unknown as { name: string })?.name ?? "Unknown"
    const id = s.captain_id!
    const existing = captainCounts.get(id)
    if (existing) existing.count++
    else captainCounts.set(id, { name, count: 1 })
  }
  const favCaptain = captainCounts.size > 0
    ? Array.from(captainCounts.values()).sort((a, b) => b.count - a.count)[0]
    : null

  const matchCaptainMap = new Map<string, { captainName: string; vcName: string }>()
  for (const s of captainData ?? []) {
    const captainName = (s.captain as unknown as { name: string })?.name
    const vcName = (s.vc as unknown as { name: string })?.name
    if (s.match_id && (captainName || vcName)) {
      matchCaptainMap.set(s.match_id, {
        captainName: captainName ?? "—",
        vcName: vcName ?? "—",
      })
    }
  }

  const rankEntry = myRank as unknown as {
    season_rank: number; total_points: number
    matches_played: number; avg_points: number
    first_place_count: number; podium_count: number
  } | null

  return (
    <PageTransition>
    <div className="p-4 md:p-6 space-y-6 max-w-2xl lg:max-w-4xl">
      {/* ── Hero: avatar + name + rank + pts ──────────────────── */}
      <div
        className="relative flex items-center gap-5 py-4 px-4 -mx-4 md:-mx-6 md:px-6 mesh-gradient-bg-strong rounded-3xl overflow-hidden"
      >
        {/* Most-picked team color tint — soft radial behind the avatar.
            Layers above the parent mesh-gradient backdrop and below the
            avatar / text siblings via DOM order. */}
        {heroTintColor && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 40% 80% at 16% 50%, ${heroTintColor}29 0%, transparent 60%)`,
            }}
          />
        )}
        <div className={cn(
          "h-24 w-24 rounded-full flex items-center justify-center shrink-0 ring-2 shadow-lg",
          getAvatarColor(profile?.display_name ?? "U"),
          rankEntry?.season_rank === 1 ? "ring-accent shadow-[0_0_24px_oklch(0.78_0.17_86/0.4)]"
            : rankEntry?.season_rank === 2 ? "ring-[oklch(0.72_0.01_260)]"
            : rankEntry?.season_rank === 3 ? "ring-[oklch(0.63_0.10_55)]"
            : "ring-overlay-border-hover"
        )}>
          <span className="text-white text-3xl font-bold font-display">
            {getInitials(profile?.display_name ?? "U")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <ProfileNameForm currentName={profile?.display_name ?? ""} />
          <p className="text-2xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
          {rankEntry && (
            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              <div className="flex items-baseline gap-1">
                <span className="text-gold-stat text-3xl leading-none">#{rankEntry.season_rank}</span>
                <span className="text-2xs text-muted-foreground uppercase tracking-wider">Rank</span>
              </div>
              <span className="text-muted-foreground/40">·</span>
              <div className="flex items-baseline gap-1">
                <span className="text-gold-stat text-2xl leading-none">{rankEntry.total_points.toLocaleString()}</span>
                <span className="text-2xs text-muted-foreground uppercase tracking-wider">Pts</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Form strip: best / worst / avg / matches ──────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          value={bestMatch ? bestMatch.total_points : "\u2014"}
          label="Best Match"
          gradient="from-green-500/10"
          iconColor="bg-green-500/15 text-[var(--tw-green-text)]"
        />
        <StatCard
          icon={TrendingDown}
          value={worstMatch ? worstMatch.total_points : "\u2014"}
          label="Worst Match"
          gradient="from-red-500/10"
          iconColor="bg-red-500/15 text-red-500"
        />
        <StatCard
          icon={Target}
          value={rankEntry?.avg_points?.toFixed(1) ?? "\u2014"}
          label="Avg / Match"
          gradient="from-primary/10"
          iconColor="bg-primary/15 text-primary"
        />
        <StatCard
          icon={Trophy}
          value={String(rankEntry?.matches_played ?? 0)}
          label="Matches"
          gradient="from-amber-500/10"
          iconColor="bg-accent/15 text-accent"
        />
      </div>

      {/* Auto-pick backup */}
      <AutoPickToggle enabled={profile?.auto_pick_enabled ?? false} />

      {/* Desktop 2-column layout for detail cards */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
      <div className="space-y-6">
      {/* Extra stats */}
      <Card className="glass">
        <CardContent className="pt-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Matches Played</span>
            <span className="font-medium">{rankEntry?.matches_played ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg Points / Match</span>
            <span className="font-medium">{rankEntry?.avg_points?.toFixed(1) ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">1st Place Finishes</span>
            <span className="font-medium">{rankEntry?.first_place_count ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Podium Finishes</span>
            <span className="font-medium">{rankEntry?.podium_count ?? 0}</span>
          </div>
          {favCaptain && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Favorite Captain</span>
              <span className="font-medium">{favCaptain.name} ({favCaptain.count}x)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance — sparkline replaced by sortable Match History table at the bottom of this page (per "tables over charts" preference). */}

      {/* Rank Progression — chart-based section removed. Match-by-match
          ranks are now scannable in the sortable Match History table below. */}

      </div>{/* end left detail column */}
      <div className="space-y-6">
      {/* Role Preferences */}
      {totalPicks > 0 && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Role Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(["WK", "BAT", "AR", "BOWL"] as const).map((role) => {
              const count = roleCounts[role]
              const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0
              const labels = { WK: "Wicket-Keepers", BAT: "Batters", AR: "All-Rounders", BOWL: "Bowlers" }
              return (
                <div key={role} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{labels[role]}</span>
                    <span className="font-medium">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Theme */}
      <ThemeCard />
      </div>{/* end right detail column */}
      </div>{/* end desktop detail grid */}

      {/* Match history — sortable table */}
      {matchScores && matchScores.length > 0 && (() => {
        const rows: MatchHistoryRow[] = matchScores.map((ms) => {
          const m = ms.match as unknown as {
            match_number: number
            team_home_id: string
            team_away_id: string
            start_time: string
          }
          const homeTeam = teamMap.get(m.team_home_id)
          const awayTeam = teamMap.get(m.team_away_id)
          const cap = matchCaptainMap.get(ms.match_id)
          return {
            id: ms.id,
            matchId: ms.match_id,
            matchNumber: m.match_number,
            startTime: m.start_time,
            rank: ms.rank,
            totalPoints: ms.total_points,
            homeShortName: homeTeam?.short_name ?? "—",
            homeColor: homeTeam?.color ?? "#888",
            homeLogoUrl: homeTeam?.logo_url ?? null,
            awayShortName: awayTeam?.short_name ?? "—",
            awayColor: awayTeam?.color ?? "#888",
            awayLogoUrl: awayTeam?.logo_url ?? null,
            captainName: cap?.captainName ?? null,
            vcName: cap?.vcName ?? null,
          }
        })
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold tracking-wide uppercase">Match History</h2>
              <span className="text-2xs text-muted-foreground">Tap a header to sort</span>
            </div>
            <MatchHistoryTable rows={rows} />
          </div>
        )
      })()}

      <Link href="/rules">
        <Card className="glass hover:bg-accent/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Rules & Scoring Guide</p>
                <p className="text-xs text-muted-foreground">How to play and points reference</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <SignOutButton />
    </div>
    </PageTransition>
  )
}

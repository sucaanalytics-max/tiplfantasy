import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLeagueWithMembers } from "@/actions/leagues"
import { formatIST } from "@/lib/utils"
import type { PlayerWithTeam } from "@/lib/types"

const ROLE_ORDER = ["WK", "BAT", "AR", "BOWL"]
const ROLE_COLORS: Record<string, { text: string; bg: string }> = {
  WK: { text: "text-amber-400", bg: "bg-amber-400/10" },
  BAT: { text: "text-blue-400", bg: "bg-blue-400/10" },
  AR: { text: "text-emerald-400", bg: "bg-emerald-400/10" },
  BOWL: { text: "text-purple-400", bg: "bg-purple-400/10" },
}

export default async function TeamSheetPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>
}) {
  const { id: leagueId, matchId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const leagueData = await getLeagueWithMembers(leagueId)
  if (!leagueData) redirect("/leagues")

  const isMember = leagueData.members.some((m) => m.user_id === user.id)
  if (!isMember) redirect("/leagues")

  const admin = createAdminClient()

  const { data: match } = await admin
    .from("matches")
    .select("id, match_number, status, start_time, team_home:teams!team_home_id(short_name, color), team_away:teams!team_away_id(short_name, color)")
    .eq("id", matchId)
    .single()

  if (!match || match.status === "upcoming") redirect(`/leagues/${leagueId}`)

  const memberIds = leagueData.members.map((m) => m.user_id)
  const memberNames: Record<string, string> = {}
  for (const m of leagueData.members) {
    const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile
    memberNames[m.user_id] = (prof as { display_name?: string } | null)?.display_name ?? "Unknown"
  }

  // Fetch all selections + players
  const { data: rawSelections } = await admin
    .from("selections")
    .select("user_id, captain_id, vice_captain_id, selection_players(player_id)")
    .eq("match_id", matchId)
    .in("user_id", memberIds)

  const allPlayerIds = [...new Set(
    (rawSelections ?? []).flatMap((s) =>
      (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id)
    )
  )]

  const { data: players } = allPlayerIds.length > 0
    ? await admin.from("players").select("*, team:teams(short_name, color)").in("id", allPlayerIds)
    : { data: [] }

  const playerMap = new Map((players ?? []).map((p) => [p.id, p as unknown as PlayerWithTeam]))

  const selections = (rawSelections ?? []).map((s) => ({
    userId: s.user_id,
    name: memberNames[s.user_id] ?? "Unknown",
    captainId: s.captain_id as string | null,
    vcId: s.vice_captain_id as string | null,
    playerIds: (s.selection_players as { player_id: string }[]).map((sp) => sp.player_id),
  }))

  // Compute pick frequencies
  const pickCount = new Map<string, number>()
  const pickedBy = new Map<string, string[]>()
  for (const sel of selections) {
    for (const pid of sel.playerIds) {
      pickCount.set(pid, (pickCount.get(pid) ?? 0) + 1)
      const names = pickedBy.get(pid) ?? []
      names.push(sel.name)
      pickedBy.set(pid, names)
    }
  }

  // Captain frequency
  const captainCount = new Map<string, number>()
  for (const sel of selections) {
    if (sel.captainId) captainCount.set(sel.captainId, (captainCount.get(sel.captainId) ?? 0) + 1)
  }

  const totalMembers = selections.length

  // Differentials: picked by ≤ 2 members
  const differentials = [...pickCount.entries()]
    .filter(([, count]) => count <= 2 && count >= 1)
    .sort((a, b) => a[1] - b[1])
    .map(([pid, count]) => ({
      player: playerMap.get(pid),
      count,
      owners: pickedBy.get(pid) ?? [],
    }))
    .filter((d) => d.player)

  const home = match.team_home as unknown as { short_name: string; color: string }
  const away = match.team_away as unknown as { short_name: string; color: string }

  return (
    <div className="min-h-dvh bg-[hsl(var(--background))] text-foreground p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-lg font-bold font-display">Match #{match.match_number} Team Sheet</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="font-bold" style={{ color: home.color }}>{home.short_name}</span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="font-bold" style={{ color: away.color }}>{away.short_name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatIST(match.start_time, "EEE, MMM d · h:mm a")} IST
        </p>
        <p className="text-xs text-muted-foreground">
          {leagueData.league.name} · {totalMembers} members
        </p>
      </div>

      {/* Each member's team */}
      <div className="space-y-4">
        {selections.map((sel) => {
          const sortedPlayers = sel.playerIds
            .map((pid) => playerMap.get(pid))
            .filter(Boolean)
            .sort((a, b) => ROLE_ORDER.indexOf(a!.role) - ROLE_ORDER.indexOf(b!.role))

          return (
            <div key={sel.userId} className="rounded-lg border border-overlay-border bg-overlay-subtle overflow-hidden">
              {/* Member header */}
              <div className="px-4 py-2.5 bg-overlay-subtle border-b border-overlay-border flex items-center justify-between">
                <span className="text-sm font-bold">{sel.name}</span>
                <span className="text-[10px] text-muted-foreground">{sel.playerIds.length} players</span>
              </div>

              {/* Player list */}
              <div className="divide-y divide-overlay-border">
                {sortedPlayers.map((player) => {
                  if (!player) return null
                  const isCaptain = sel.captainId === player.id
                  const isVC = sel.vcId === player.id
                  const count = pickCount.get(player.id) ?? 0
                  const isDiff = count <= 2
                  const isUniversal = count === totalMembers
                  const isUniqueCaptain = isCaptain && (captainCount.get(player.id) ?? 0) === 1
                  const rc = ROLE_COLORS[player.role] ?? ROLE_COLORS.BAT

                  return (
                    <div key={player.id} className="flex items-center gap-2 px-4 py-1.5">
                      {/* C/VC indicator */}
                      <span className="w-5 text-center shrink-0">
                        {isCaptain && <span className="text-[10px] font-bold text-amber-400">👑</span>}
                        {isVC && <span className="text-[10px] font-bold text-violet-400">🥈</span>}
                      </span>

                      {/* Role */}
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${rc.text} ${rc.bg}`}>
                        {player.role}
                      </span>

                      {/* Name */}
                      <span className="text-sm flex-1 truncate">
                        {player.name}
                      </span>

                      {/* Team */}
                      <span
                        className="text-[9px] font-semibold shrink-0"
                        style={{ color: player.team.color }}
                      >
                        {player.team.short_name}
                      </span>

                      {/* Pick frequency + differential */}
                      <span className="text-[9px] tabular-nums shrink-0 w-8 text-right">
                        {isDiff ? (
                          <span className="text-amber-400 font-bold">{count}/{totalMembers}</span>
                        ) : isUniversal ? (
                          <span className="text-muted-foreground/40">{count}/{totalMembers}</span>
                        ) : (
                          <span className="text-muted-foreground/60">{count}/{totalMembers}</span>
                        )}
                      </span>

                      {/* Badges */}
                      {isDiff && (
                        <span className="text-[8px] font-bold text-amber-400 bg-amber-400/15 px-1 rounded shrink-0">DIFF</span>
                      )}
                      {isUniqueCaptain && (
                        <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/15 px-1 rounded shrink-0">UNIQUE C</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Differentials summary */}
      {differentials.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-400/10 flex items-center gap-2">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Key Differentials</span>
          </div>
          <div className="divide-y divide-amber-400/10">
            {differentials.slice(0, 10).map(({ player, count, owners }) => (
              <div key={player!.id} className="px-4 py-2 flex items-center gap-2">
                <span className="text-sm font-medium flex-1">{player!.name}</span>
                <span className="text-[10px] text-muted-foreground">{owners.join(", ")}</span>
                <span className="text-[10px] font-bold text-amber-400">{count}/{totalMembers}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground/40 mt-6">
        TIPL Fantasy 2026 · Team Sheet
      </p>
    </div>
  )
}

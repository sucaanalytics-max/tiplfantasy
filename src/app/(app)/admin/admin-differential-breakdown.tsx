"use client"

import type { DifferentialPickRow } from "@/lib/types"

export function AdminDifferentialBreakdown({
  picks,
  userNames,
}: {
  picks: DifferentialPickRow[]
  userNames: Record<string, string>
}) {
  const userIds = Object.keys(userNames)
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
        🔍 Full Differential Breakdown (Admin)
      </h2>
      {userIds.map((uid) => {
        const userPicks = picks
          .filter((p) => p.user_id === uid)
          .sort((a, b) => a.match_number - b.match_number || a.ownership_count - b.ownership_count)
        return (
          <details key={uid} className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-overlay-subtle">
              {userNames[uid]} — {userPicks.length} picks
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-overlay-border bg-overlay-subtle text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-1.5 text-left">M#</th>
                    <th className="px-3 py-1.5 text-left">Match</th>
                    <th className="px-3 py-1.5 text-left">Player</th>
                    <th className="px-3 py-1.5 text-center">Role</th>
                    <th className="px-3 py-1.5 text-center">Team</th>
                    <th className="px-3 py-1.5 text-right">Pts</th>
                    <th className="px-3 py-1.5 text-right">Owned</th>
                    <th className="px-3 py-1.5 text-center">C/VC</th>
                    <th className="px-3 py-1.5 text-center">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-overlay-border">
                  {userPicks.map((pick, i) => (
                    <tr key={i} className="hover:bg-overlay-subtle/50">
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{pick.match_number}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[100px]">{pick.matchup}</td>
                      <td className="px-3 py-1.5 font-medium">{pick.player_name}</td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">{pick.player_role}</td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">{pick.team_short_name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{pick.user_pts}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{pick.ownership_count}/{pick.total_users}</td>
                      <td className="px-3 py-1.5 text-center text-[10px]">
                        {pick.is_captain ? "C" : pick.is_vc ? "VC" : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-center text-[10px]">
                        {pick.category === "gem" ? "💎" : pick.category === "paid-off" ? "✅" : pick.category === "backfired" ? "❌" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </div>
  )
}

"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { formatIST } from "@/lib/utils"
import type { MatchWithTeams, PlayerWithTeam, MatchPlayerScore } from "@/lib/types"
import type { PlayerStats } from "@/lib/scoring"
import { lockMatch, markNoResult, fetchPlayingXI, fetchMatchScorecard, autoScoreMatch, testMatchPoints, getMatchMemo, generateMatchBanter, getPreMatchAnalysis } from "@/actions/matches"
import { savePlayerScores, calculateMatchPoints, calculateLiveMatchPoints, applyPotmBonus } from "@/actions/scoring"
import { adminUpdateCaptainVc } from "@/actions/selections"
import { formatMatchMessage } from "@/lib/whatsapp"

type UserScoreRow = {
  user_id: string
  total_points: number
  rank: number | null
  captain_points: number
  vc_points: number
  displayName: string
}

type UserSelection = {
  user_id: string
  display_name: string
  captain_id: string | null
  vice_captain_id: string | null
  player_ids: string[]
}

type Props = {
  match: MatchWithTeams
  players: PlayerWithTeam[]
  playingXIIds: string[]
  existingScores: MatchPlayerScore[]
  userScores: UserScoreRow[]
  seasonTop5: Array<{ displayName: string; totalPoints: number }>
  selectionCount: number
  userSelections?: UserSelection[]
}

type ScoreEntry = Record<string, PlayerStats>

const emptyStats = (): PlayerStats => ({
  runs: 0,
  balls_faced: 0,
  fours: 0,
  sixes: 0,
  wickets: 0,
  overs_bowled: 0,
  runs_conceded: 0,
  maidens: 0,
  catches: 0,
  stumpings: 0,
  run_outs: 0,
})

export function AdminMatchClient({
  match,
  players,
  playingXIIds: initialXIIds,
  existingScores,
  userScores,
  seasonTop5,
  selectionCount,
  userSelections = [],
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [playingXIIds, setPlayingXIIds] = useState<string[]>(initialXIIds)
  const [fantasyApiResult, setFantasyApiResult] = useState<unknown>(null)
  const [editUserId, setEditUserId] = useState<string>("")
  const [editCaptainId, setEditCaptainId] = useState<string>("")
  const [editVcId, setEditVcId] = useState<string>("")
  const [memoText, setMemoText] = useState<string | null>(null)
  const memoRef = useRef<HTMLPreElement>(null)

  // Initialize score entries from existing scores or empty
  const initScores = (): ScoreEntry => {
    const entries: ScoreEntry = {}
    const scoreMap = new Map(existingScores.map((s) => [s.player_id, s]))

    // Use playing XI if available, else all players
    const playerList = playingXIIds.length > 0
      ? players.filter((p) => playingXIIds.includes(p.id))
      : players

    for (const p of playerList) {
      const existing = scoreMap.get(p.id)
      if (existing) {
        entries[p.id] = {
          runs: existing.runs,
          balls_faced: existing.balls_faced,
          fours: existing.fours,
          sixes: existing.sixes,
          wickets: existing.wickets,
          overs_bowled: existing.overs_bowled,
          runs_conceded: existing.runs_conceded,
          maidens: existing.maidens,
          catches: existing.catches,
          stumpings: existing.stumpings,
          run_outs: existing.run_outs,
        }
      } else {
        entries[p.id] = emptyStats()
      }
    }
    return entries
  }

  const [scores, setScores] = useState<ScoreEntry>(initScores)

  function updateScore(playerId: string, field: keyof PlayerStats, value: number) {
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // --- Actions ---

  function handleFetchXI() {
    if (!match.cricapi_match_id) {
      showMsg("error", "No fixture ID set for this match")
      return
    }
    startTransition(async () => {
      const res = await fetchPlayingXI(match.id, match.cricapi_match_id!)
      if (res.error) {
        showMsg("error", res.error)
      } else {
        showMsg("success", `Matched ${res.matched} players. ${res.unmatched?.length ? `Unmatched: ${res.unmatched.join(", ")}` : ""}`)
        router.refresh()
      }
    })
  }

  function handleLock() {
    startTransition(async () => {
      const res = await lockMatch(match.id)
      if (res.error) showMsg("error", res.error)
      else {
        showMsg("success", "Match locked")
        router.refresh()
      }
    })
  }

  function handleNoResult() {
    if (!confirm("Mark as no result? All users get 15 pts.")) return
    startTransition(async () => {
      const res = await markNoResult(match.id)
      if (res.error) showMsg("error", res.error)
      else {
        showMsg("success", "Marked no result")
        router.refresh()
      }
    })
  }

  function handleAutoScore() {
    if (!match.cricapi_match_id) {
      showMsg("error", "No fixture ID set for this match")
      return
    }
    startTransition(async () => {
      const res = await autoScoreMatch(match.id, match.cricapi_match_id!)
      if (res.error) {
        showMsg("error", res.error)
      } else {
        const unmatchedNote = res.unmatched?.length ? ` (${res.unmatched.length} unmatched: ${res.unmatched.join(", ")})` : ""
        showMsg("success", `Auto-scored ${res.userScores?.length ?? 0} users${unmatchedNote}`)
        router.refresh()
      }
    })
  }

  function handleFetchScorecard() {
    if (!match.cricapi_match_id) {
      showMsg("error", "No fixture ID set for this match")
      return
    }
    startTransition(async () => {
      const res = await fetchMatchScorecard(match.id, match.cricapi_match_id!)
      if (res.error) {
        showMsg("error", res.error)
      } else if (res.scores) {
        const newScores: ScoreEntry = { ...scores }
        for (const s of res.scores) {
          newScores[s.playerId] = s.stats
        }
        setScores(newScores)
        showMsg("success", `Loaded ${res.scores.length} player scores. ${res.unmatched?.length ? `Unmatched: ${res.unmatched.join(", ")}` : ""}`)
      }
    })
  }

  function handleSaveScores() {
    const scoreArr = Object.entries(scores).map(([playerId, stats]) => ({
      playerId,
      stats,
    }))
    startTransition(async () => {
      const res = await savePlayerScores(match.id, scoreArr)
      if (res.error) showMsg("error", res.error)
      else {
        showMsg("success", "Scores saved")
        router.refresh()
      }
    })
  }

  function handleCalculatePoints() {
    startTransition(async () => {
      const res = await calculateMatchPoints(match.id)
      if (res.error) showMsg("error", res.error)
      else {
        showMsg("success", "Points calculated")
        router.refresh()
      }
    })
  }

  function handleApplyPotm() {
    startTransition(async () => {
      const res = await applyPotmBonus(match.id)
      if (res.error) showMsg("error", res.error)
      else {
        showMsg("success", `POTM: ${res.playerName} (+${res.bonus} pts)`)
        router.refresh()
      }
    })
  }

  function handleLivePoints() {
    startTransition(async () => {
      const res = await calculateLiveMatchPoints(match.id)
      if (res.error) showMsg("error", res.error)
      else {
        showMsg("success", `Live points updated for ${res.count} users`)
        router.refresh()
      }
    })
  }

  function handleTestFantasyApi() {
    if (!match.cricapi_match_id) {
      showMsg("error", "No fixture ID set for this match")
      return
    }
    startTransition(async () => {
      const res = await testMatchPoints(match.id)
      if (res.error) {
        showMsg("error", res.error)
      } else {
        setFantasyApiResult(res.data)
        showMsg("success", "Fantasy API response loaded below")
      }
    })
  }

  function handleWhatsApp() {
    const matchTitle = `${match.team_home.short_name} vs ${match.team_away.short_name}`
    const results = userScores.map((s) => ({
      displayName: s.displayName,
      totalPoints: s.total_points,
      rank: s.rank ?? 0,
    }))
    const msg = formatMatchMessage(matchTitle, match.match_number, results, seasonTop5)
    navigator.clipboard.writeText(msg)
    showMsg("success", "WhatsApp message copied to clipboard!")
  }

  const statusColor: Record<string, string> = {
    upcoming: "bg-status-upcoming-bg text-status-upcoming border-status-upcoming/20",
    live: "bg-status-live-bg text-status-live border-status-live/20",
    completed: "bg-status-completed-bg text-status-completed border-status-completed/20",
    no_result: "bg-status-warning-bg text-status-warning border-status-warning/20",
  }

  const playingPlayers = playingXIIds.length > 0
    ? players.filter((p) => playingXIIds.includes(p.id))
    : []

  // Group by team, sorted by role
  const ROLE_SORT = { WK: 0, BAT: 1, AR: 2, BOWL: 3 } as Record<string, number>
  const sortByRole = (a: PlayerWithTeam, b: PlayerWithTeam) => (ROLE_SORT[a.role] ?? 9) - (ROLE_SORT[b.role] ?? 9)
  const homePlayers = playingPlayers.filter((p) => p.team_id === match.team_home_id).sort(sortByRole)
  const awayPlayers = playingPlayers.filter((p) => p.team_id === match.team_away_id).sort(sortByRole)

  const statFields: Array<{ key: keyof PlayerStats; label: string; short: string }> = [
    { key: "runs", label: "Runs", short: "R" },
    { key: "balls_faced", label: "Balls", short: "B" },
    { key: "fours", label: "4s", short: "4s" },
    { key: "sixes", label: "6s", short: "6s" },
    { key: "wickets", label: "Wkts", short: "W" },
    { key: "overs_bowled", label: "Overs", short: "Ov" },
    { key: "runs_conceded", label: "Runs Con.", short: "RC" },
    { key: "maidens", label: "Maidens", short: "M" },
    { key: "catches", label: "Catches", short: "C" },
    { key: "stumpings", label: "Stumpings", short: "St" },
    { key: "run_outs", label: "Run Outs", short: "RO" },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Match #{match.match_number}
          </h1>
          <p className="text-lg mt-1">
            <span style={{ color: match.team_home.color }}>{match.team_home.short_name}</span>
            {" vs "}
            <span style={{ color: match.team_away.color }}>{match.team_away.short_name}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {match.venue} &middot; {formatIST(match.start_time, "MMM d, yyyy h:mm a")}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectionCount} selection{selectionCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge variant="outline" className={statusColor[match.status] ?? ""}>
          {match.status}
        </Badge>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-status-success-bg text-status-success border border-status-success/20"
              : "bg-status-danger-bg text-status-danger border border-status-danger/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Action buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Match Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchXI}
            disabled={isPending || !match.cricapi_match_id}
          >
            Fetch Playing XI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLock}
            disabled={isPending || match.status !== "upcoming"}
          >
            Lock Match
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNoResult}
            disabled={isPending || match.status === "completed"}
          >
            No Result
          </Button>
          <Button
            size="sm"
            onClick={handleAutoScore}
            disabled={isPending || !match.cricapi_match_id}
            className="gap-1.5"
          >
            ⚡ Auto-Score
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchScorecard}
            disabled={isPending || !match.cricapi_match_id}
          >
            Fetch Scorecard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveScores}
            disabled={isPending || Object.keys(scores).length === 0}
          >
            Save Scores
          </Button>
          <Button
            size="sm"
            onClick={handleCalculatePoints}
            disabled={isPending || existingScores.length === 0}
          >
            Calculate Points
          </Button>
          {match.status === "completed" && existingScores.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyPotm}
              disabled={isPending || !match.cricapi_match_id}
            >
              🏅 Apply POTM
            </Button>
          )}
          {match.status === "live" && existingScores.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLivePoints}
              disabled={isPending}
            >
              📊 Live Points
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestFantasyApi}
            disabled={isPending || !match.cricapi_match_id}
          >
            Test Fantasy API
          </Button>
          <Button variant="secondary" size="sm" onClick={() => {
            startTransition(async () => {
              // Fetch first league for analysis
              const res = await getPreMatchAnalysis(match.id, "__first__")
              if (res.error) showMsg("error", res.error)
              else if (res.whatsapp) setMemoText(res.whatsapp)
            })
          }}>
            Pre-Match Analysis
          </Button>
          {userScores.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => {
              startTransition(async () => {
                const res = await getMatchMemo(match.id)
                if (res.error) { showMsg("error", res.error); return }
                if (res.memo) setMemoText(res.memo)
              })
            }}>
              Generate Memo
            </Button>
          )}
          {userScores.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => {
              startTransition(async () => {
                const res = await generateMatchBanter(match.id)
                if (res.error) showMsg("error", res.error)
                else showMsg("success", `Generated ${res.generated ?? 0} banter messages`)
              })
            }}>
              Generate Banter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Match Memo Output */}
      {memoText && (
        <Card className="border border-overlay-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Match Memo</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  try { navigator.clipboard.writeText(memoText); showMsg("success", "Copied!") } catch { /* fallback: user selects text manually */ }
                }}>
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(memoText)}`, "_blank")
                }}>
                  WhatsApp
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMemoText(null)}>
                  ✕
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre
              ref={memoRef}
              className="whitespace-pre-wrap text-sm bg-overlay-subtle rounded-lg p-4 max-h-[60vh] overflow-y-auto select-all font-sans leading-relaxed"
            >
              {memoText}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Fantasy API diagnostic output */}
      {fantasyApiResult !== null && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fantasy API Response</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setFantasyApiResult(null)}>Dismiss</Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(fantasyApiResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Playing XI */}
      {playingXIIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Playing XI ({playingXIIds.length} players)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: match.team_home.color }}
                >
                  {match.team_home.short_name} ({homePlayers.length})
                </h3>
                <div className="space-y-0.5">
                  {homePlayers.map((p) => {
                    const rc = p.role === "WK" ? "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]" : p.role === "BAT" ? "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]" : p.role === "AR" ? "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]" : "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]"
                    return (
                      <div key={p.id} className="text-sm flex items-center gap-2 py-1.5 px-2 rounded-md bg-overlay-subtle">
                        <Badge variant="outline" className={`text-[9px] w-10 justify-center border ${rc}`}>{p.role}</Badge>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: match.team_away.color }}
                >
                  {match.team_away.short_name} ({awayPlayers.length})
                </h3>
                <div className="space-y-0.5">
                  {awayPlayers.map((p) => {
                    const rc = p.role === "WK" ? "text-[var(--tw-amber-text)] border-amber-400/30 bg-[var(--tw-amber-bg)]" : p.role === "BAT" ? "text-[var(--tw-blue-text)] border-blue-400/30 bg-[var(--tw-blue-bg)]" : p.role === "AR" ? "text-[var(--tw-emerald-text)] border-emerald-400/30 bg-[var(--tw-emerald-bg)]" : "text-[var(--tw-purple-text)] border-purple-400/30 bg-[var(--tw-purple-bg)]"
                    return (
                      <div key={p.id} className="text-sm flex items-center gap-2 py-1.5 px-2 rounded-md bg-overlay-subtle">
                        <Badge variant="outline" className={`text-[9px] w-10 justify-center border ${rc}`}>{p.role}</Badge>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score entry table */}
      {Object.keys(scores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Player Scores</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-overlay-border">
                  <th className="text-left py-2 px-1 font-medium sticky left-0 bg-card min-w-[120px]">
                    Player
                  </th>
                  {statFields.map((f) => (
                    <th key={f.key} className="text-center py-2 px-1 font-medium min-w-[50px]">
                      {f.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...homePlayers, ...awayPlayers].map((player) => {
                  const s = scores[player.id]
                  if (!s) return null
                  return (
                    <tr key={player.id} className="border-b border-overlay-border">
                      <td className="py-2 px-1 sticky left-0 bg-card">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-1 h-4 rounded-full"
                            style={{ backgroundColor: player.team.color }}
                          />
                          <span className="truncate max-w-[100px]">{player.name}</span>
                        </div>
                      </td>
                      {statFields.map((f) => (
                        <td key={f.key} className="py-1 px-0.5 text-center">
                          <Input
                            type="number"
                            min={0}
                            step={f.key === "overs_bowled" ? 0.1 : 1}
                            value={s[f.key] as number ?? 0}
                            onChange={(e) =>
                              updateScore(
                                player.id,
                                f.key,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 w-14 text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* User scores / results */}
      {userScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userScores.map((s, i) => {
                const medals = ["🥇", "🥈", "🥉"]
                const prefix =
                  i < 3
                    ? medals[i]
                    : i === userScores.length - 1 && userScores.length > 3
                    ? "🥄"
                    : `${s.rank ?? i + 1}.`

                return (
                  <div
                    key={s.user_id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center">{prefix}</span>
                      <span className="font-medium">{s.displayName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {s.captain_points > 0 && (
                        <span className="text-muted-foreground">
                          C: {s.captain_points}
                        </span>
                      )}
                      {s.vc_points > 0 && (
                        <span className="text-muted-foreground">
                          VC: {s.vc_points}
                        </span>
                      )}
                      <span className="font-bold text-lg">{s.total_points}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Edit User Team — C/VC Editor */}
      {userSelections.length > 0 && (
        <Card className="border border-overlay-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Edit User Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* User selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Select User</label>
              <select
                value={editUserId}
                onChange={(e) => {
                  const uid = e.target.value
                  setEditUserId(uid)
                  const sel = userSelections.find((s) => s.user_id === uid)
                  setEditCaptainId(sel?.captain_id ?? "")
                  setEditVcId(sel?.vice_captain_id ?? "")
                }}
                className="w-full rounded-md border border-overlay-border bg-secondary px-3 py-2 text-sm"
              >
                <option value="">Choose user...</option>
                {userSelections.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                ))}
              </select>
            </div>

            {editUserId && (() => {
              const sel = userSelections.find((s) => s.user_id === editUserId)
              if (!sel) return null
              const selPlayers = players.filter((p) => sel.player_ids.includes(p.id))

              return (
                <div className="space-y-3">
                  {/* Current XI list */}
                  <div className="text-xs text-muted-foreground">
                    XI: {selPlayers.map((p) => p.name).join(", ")}
                  </div>

                  {/* Captain selector */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Captain (2×)</label>
                    <select
                      value={editCaptainId}
                      onChange={(e) => setEditCaptainId(e.target.value)}
                      className="w-full rounded-md border border-overlay-border bg-secondary px-3 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {selPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  </div>

                  {/* Vice-Captain selector */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Vice-Captain (1.5×)</label>
                    <select
                      value={editVcId}
                      onChange={(e) => setEditVcId(e.target.value)}
                      className="w-full rounded-md border border-overlay-border bg-secondary px-3 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {selPlayers.filter((p) => p.id !== editCaptainId).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await adminUpdateCaptainVc(
                            match.id,
                            editUserId,
                            editCaptainId || null,
                            editVcId || null
                          )
                          if (res.error) showMsg("error", res.error)
                          else { showMsg("success", "C/VC updated"); router.refresh() }
                        })
                      }}
                    >
                      Update C/VC
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={`/match/${match.id}/pick?admin=${editUserId}`}>
                        Full Edit →
                      </a>
                    </Button>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

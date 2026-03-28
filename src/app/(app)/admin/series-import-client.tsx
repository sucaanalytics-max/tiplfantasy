"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { previewSeriesImport, confirmSeriesImport } from "@/actions/matches"
import type { SeriesImportProposal } from "@/actions/matches"
import { format } from "date-fns"

export function SeriesImportClient() {
  const [seriesId, setSeriesId] = useState("")
  const [isPending, startTransition] = useTransition()
  const [proposals, setProposals] = useState<SeriesImportProposal[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function handlePreview() {
    if (!seriesId.trim()) return
    startTransition(async () => {
      setProposals(null)
      setMessage(null)
      const res = await previewSeriesImport(seriesId.trim())
      if (res.error) {
        setMessage(`Error: ${res.error}`)
      } else {
        setProposals(res.proposals ?? [])
      }
    })
  }

  function handleConfirm() {
    if (!proposals) return
    const toUpdate = proposals.filter((p) => p.dbMatchId && !p.alreadySet)
    const toCreate = proposals.filter((p) => p.isNew)
    if (toUpdate.length === 0 && toCreate.length === 0) {
      setMessage("Nothing to do — all matches already have IDs set.")
      return
    }
    startTransition(async () => {
      const res = await confirmSeriesImport(
        toUpdate.map((p) => ({ dbMatchId: p.dbMatchId!, apiMatchId: p.apiMatchId })),
        toCreate.map((p) => ({
          apiMatchId: p.apiMatchId,
          teamHomeId: p.teamHomeId!,
          teamAwayId: p.teamAwayId!,
          venue: p.venue,
          startTime: p.dateTimeGMT,
          matchNumber: p.proposedMatchNumber!,
        }))
      )
      if (res.error) {
        setMessage(`Error: ${res.error}`)
      } else {
        const parts = []
        if (res.updated) parts.push(`${res.updated} updated`)
        if (res.created) parts.push(`${res.created} created`)
        setMessage(`Done — ${parts.join(", ")}.`)
        setProposals(null)
        setSeriesId("")
      }
    })
  }

  const alreadySet = proposals?.filter((p) => p.alreadySet) ?? []
  const toUpdate = proposals?.filter((p) => p.dbMatchId && !p.alreadySet) ?? []
  const toCreate = proposals?.filter((p) => p.isNew) ?? []
  const unmapped = proposals?.filter((p) => !p.dbMatchId && !p.isNew) ?? []
  const totalChanges = toUpdate.length + toCreate.length

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Import Series Matches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Fetch IPL 2026 fixtures from SportMonks and auto-map fixture IDs for all matches.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Any value (IPL 2026 auto-fetched)"
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={isPending || !seriesId.trim()}
          >
            {isPending && !proposals ? "Loading..." : "Preview"}
          </Button>
        </div>

        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}

        {proposals !== null && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                ✅ {alreadySet.length} already set &nbsp;·&nbsp;
                🔄 {toUpdate.length} to update &nbsp;·&nbsp;
                ➕ {toCreate.length} to create &nbsp;·&nbsp;
                ❌ {unmapped.length} unmapped
              </p>
            </div>

            {toUpdate.length > 0 && (
              <div className="max-h-32 overflow-y-auto border border-border rounded-md p-2 space-y-0.5 text-xs font-mono">
                <p className="text-muted-foreground mb-1">To update (cricapi_match_id):</p>
                {toUpdate.map((p) => (
                  <div key={p.apiMatchId} className="flex gap-2">
                    <span className="text-muted-foreground w-6 shrink-0">#{p.matchNumber}</span>
                    <span className="truncate">{p.apiName}</span>
                  </div>
                ))}
              </div>
            )}

            {toCreate.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-0.5 text-xs font-mono">
                <p className="text-muted-foreground mb-1">New matches to create:</p>
                {toCreate.map((p) => (
                  <div key={p.apiMatchId} className="flex gap-2">
                    <span className="text-muted-foreground w-6 shrink-0">#{p.proposedMatchNumber}</span>
                    <span className="truncate flex-1">{p.teams.join(" vs ")}</span>
                    <span className="text-muted-foreground shrink-0">{format(new Date(p.dateTimeGMT), "MMM d")}</span>
                  </div>
                ))}
              </div>
            )}

            {unmapped.length > 0 && (
              <div className="max-h-24 overflow-y-auto border border-border rounded-md p-2 space-y-0.5 text-xs font-mono">
                <p className="text-muted-foreground mb-1">Could not resolve teams:</p>
                {unmapped.map((p) => (
                  <div key={p.apiMatchId} className="text-muted-foreground">{p.apiName}</div>
                ))}
              </div>
            )}

            {totalChanges > 0 && (
              <Button size="sm" onClick={handleConfirm} disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : `Confirm ${totalChanges} Change${totalChanges !== 1 ? "s" : ""}${toUpdate.length && toCreate.length ? ` (${toUpdate.length} update + ${toCreate.length} create)` : ""}`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

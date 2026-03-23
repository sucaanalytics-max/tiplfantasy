"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { previewSeriesImport, confirmSeriesImport } from "@/actions/matches"
import type { SeriesImportProposal } from "@/actions/matches"

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
    const toConfirm = proposals.filter((p) => p.dbMatchId && !p.alreadySet)
    if (toConfirm.length === 0) {
      setMessage("Nothing to update — all matches already have IDs set.")
      return
    }
    startTransition(async () => {
      const res = await confirmSeriesImport(
        toConfirm.map((p) => ({ dbMatchId: p.dbMatchId!, apiMatchId: p.apiMatchId }))
      )
      if (res.error) {
        setMessage(`Error: ${res.error}`)
      } else {
        setMessage(`Updated ${res.updated} matches.`)
        setProposals(null)
        setSeriesId("")
      }
    })
  }

  const unmapped = proposals?.filter((p) => !p.dbMatchId) ?? []
  const toUpdate = proposals?.filter((p) => p.dbMatchId && !p.alreadySet) ?? []
  const alreadySet = proposals?.filter((p) => p.alreadySet) ?? []

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Import Series Matches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Paste a CricAPI series ID to auto-map <span className="font-mono">cricapi_match_id</span> for all matches.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="CricAPI series ID (e.g. abc123...)"
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
              <p>✅ {alreadySet.length} already set &nbsp;·&nbsp; 🔄 {toUpdate.length} to update &nbsp;·&nbsp; ❌ {unmapped.length} no DB match found</p>
            </div>

            {toUpdate.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-0.5 text-xs font-mono">
                {toUpdate.map((p) => (
                  <div key={p.apiMatchId} className="flex gap-2">
                    <span className="text-muted-foreground w-6 shrink-0">#{p.matchNumber}</span>
                    <span className="truncate">{p.apiName}</span>
                  </div>
                ))}
              </div>
            )}

            {unmapped.length > 0 && (
              <div className="max-h-24 overflow-y-auto border border-border rounded-md p-2 space-y-0.5 text-xs font-mono">
                <p className="text-muted-foreground mb-1">No match found in DB:</p>
                {unmapped.map((p) => (
                  <div key={p.apiMatchId} className="text-muted-foreground">{p.apiName}</div>
                ))}
              </div>
            )}

            {toUpdate.length > 0 && (
              <Button size="sm" onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Saving..." : `Confirm ${toUpdate.length} Updates`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

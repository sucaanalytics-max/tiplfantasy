"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, ImageIcon, Loader2 } from "lucide-react"
import { runSportmonksDryRun, runLiveSportmonksSync, type DryRunResult, type LiveSyncResult } from "./actions"

export function SyncImagesClient({ initialStats }: { initialStats: { totalPlayers: number; withCricapiId: number; withExistingImage: number } }) {
  const [isPending, startTransition] = useTransition()
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [liveResult, setLiveResult] = useState<LiveSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmLive, setConfirmLive] = useState(false)

  function handleDryRun(sampleSize: number) {
    setError(null)
    setLiveResult(null)
    startTransition(async () => {
      try {
        const res = await runSportmonksDryRun(sampleSize)
        setDryRun(res)
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  function handleLiveSync(limit: number) {
    setError(null)
    startTransition(async () => {
      try {
        const res = await runLiveSportmonksSync(limit)
        setLiveResult(res)
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Current state */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total players" value={initialStats.totalPlayers} />
        <StatTile label="With Sportmonks ID" value={initialStats.withCricapiId} accent />
        <StatTile label="With image_url" value={initialStats.withExistingImage} accent />
      </div>

      {/* Dry run controls */}
      <Card className="glass">
        <CardContent className="pt-5 pb-5 space-y-3">
          <div>
            <h2 className="font-display font-bold text-lg">Step 1 — Dry-run investigation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sample N players that need an image, fetch Sportmonks metadata, report what
              <code className="mx-1 px-1 py-0.5 rounded bg-overlay-subtle text-foreground">image_path</code>
              coverage looks like. No writes.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => handleDryRun(10)} disabled={isPending} size="sm" variant="outline">
              {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Sample 10
            </Button>
            <Button onClick={() => handleDryRun(30)} disabled={isPending} size="sm" variant="outline">
              {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Sample 30
            </Button>
            <Button onClick={() => handleDryRun(60)} disabled={isPending} size="sm" variant="outline">
              {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Sample 60
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dry run result */}
      {dryRun && (
        <Card className="glass">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display font-bold text-base">Dry-run report</h3>
              <span className="text-2xs text-muted-foreground">
                Sampled {dryRun.sampleSize}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ResultPill label="Has image" value={dryRun.ok} tone="success" />
              <ResultPill label="No image" value={dryRun.noImage} tone="warning" />
              <ResultPill label="Fetch failed" value={dryRun.fetchFailed} tone="danger" />
            </div>
            <div className="border border-overlay-border rounded-lg overflow-hidden divide-y divide-overlay-border">
              {dryRun.sampleRows.map((r) => (
                <div key={r.player_id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="flex-1 truncate font-medium">{r.name}</span>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {r.cricapi_id ?? "—"}
                  </span>
                  <span
                    className={
                      r.status === "ok"
                        ? "text-status-success"
                        : r.status === "no-image"
                        ? "text-status-warning"
                        : "text-status-danger"
                    }
                  >
                    {r.status === "ok" ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : r.status === "no-image" ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
              ))}
            </div>
            {dryRun.ok > 0 && (
              <p className="text-2xs text-muted-foreground">
                Coverage: {Math.round((dryRun.ok / dryRun.sampleSize) * 100)}% of sampled players have a Sportmonks image. Estimated total to import:{" "}
                <span className="text-foreground font-semibold">
                  ~{Math.round((dryRun.ok / dryRun.sampleSize) * (initialStats.withCricapiId - initialStats.withExistingImage))}
                </span>
                .
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live sync */}
      <Card className="glass border-status-warning/30">
        <CardContent className="pt-5 pb-5 space-y-3">
          <div>
            <h2 className="font-display font-bold text-lg">Step 2 — Live sync</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              For each player without an existing image_url, fetch Sportmonks → download → upload to
              <code className="mx-1 px-1 py-0.5 rounded bg-overlay-subtle text-foreground">player-photos</code>
              bucket → write
              <code className="mx-1 px-1 py-0.5 rounded bg-overlay-subtle text-foreground">players.image_url</code>.
              Idempotent: re-running skips players that already have an image.
            </p>
          </div>
          {!confirmLive ? (
            <Button
              onClick={() => setConfirmLive(true)}
              disabled={isPending}
              size="sm"
              variant="outline"
              className="border-status-warning/40 text-status-warning"
            >
              I&apos;ve reviewed the dry-run, proceed
            </Button>
          ) : (
            <div className="flex gap-2 flex-wrap items-center">
              <Button onClick={() => handleLiveSync(50)} disabled={isPending} size="sm" className="bg-primary text-white">
                {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Run live sync — 50 at a time
              </Button>
              <Button onClick={() => handleLiveSync(250)} disabled={isPending} size="sm" variant="outline">
                {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Run all (up to 250)
              </Button>
              <Button onClick={() => setConfirmLive(false)} disabled={isPending} size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live result */}
      {liveResult && (
        <Card className="glass">
          <CardContent className="pt-5 pb-5 space-y-3">
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              Live sync complete
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <ResultPill label="Attempted" value={liveResult.attempted} />
              <ResultPill label="Uploaded" value={liveResult.uploaded} tone="success" />
              <ResultPill label="Skipped" value={liveResult.skipped} tone="warning" />
              <ResultPill label="Failed" value={liveResult.failed} tone="danger" />
            </div>
            {liveResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-status-danger mb-1.5">Errors</p>
                <ul className="text-2xs space-y-1 max-h-48 overflow-y-auto">
                  {liveResult.errors.map((e) => (
                    <li key={e.player_id} className="flex items-center gap-2">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-muted-foreground">— {e.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="glass-panel rounded-xl p-3 text-center">
      <p className={accent ? "text-gold-stat text-2xl leading-none" : "font-display font-bold text-2xl leading-none tabular-nums"}>
        {value}
      </p>
      <p className="text-2xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

function ResultPill({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success" ? "text-status-success border-status-success/30 bg-status-success/5"
      : tone === "warning" ? "text-status-warning border-status-warning/30 bg-status-warning/5"
      : tone === "danger" ? "text-status-danger border-status-danger/30 bg-status-danger/5"
      : "text-foreground border-overlay-border"
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${toneClass}`}>
      <p className="font-display font-bold text-lg leading-none tabular-nums">{value}</p>
      <p className="text-2xs uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

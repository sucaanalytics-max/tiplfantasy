"use client"

import { cn } from "@/lib/utils"

export type OwnershipEntry = {
  player_id: string
  name: string
  pct: number
  isMine: boolean
}

type Props = {
  entries: OwnershipEntry[]
}

/**
 * Top owned players across all entries in the league. A pill per player,
 * showing the ownership percentage. Picks owned by the current user are
 * highlighted; missing ones get a muted ✗ marker so the cost of being
 * out-of-template is legible at a glance.
 */
export function OwnershipGrid({ entries }: Props) {
  if (!entries.length) return null

  return (
    <section className="px-3 pt-4 pb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Most Picked
        </span>
        <span className="text-[10px] text-muted-foreground/60">top {entries.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((p) => {
          const surname = p.name.split(/\s+/).pop() ?? p.name
          return (
            <span
              key={p.player_id}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border",
                p.isMine
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              <span className="tabular-nums font-semibold">{p.pct}%</span>
              <span className="font-medium">{surname}</span>
              {!p.isMine && <span className="text-[var(--tw-amber-text)] text-[10px]">✗</span>}
            </span>
          )
        })}
      </div>
    </section>
  )
}

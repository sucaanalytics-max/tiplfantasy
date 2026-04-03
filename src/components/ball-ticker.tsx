"use client"

import { cn } from "@/lib/utils"

type BallEvent = {
  ball: number
  runs: number
  four: boolean
  six: boolean
  wicket: boolean
}

function ballColor(b: BallEvent): string {
  if (b.wicket) return "bg-red-500 text-white"
  if (b.six) return "bg-purple-500 text-white"
  if (b.four) return "bg-emerald-500 text-white"
  if (b.runs === 0) return "bg-zinc-700 text-zinc-400"
  return "bg-zinc-600 text-zinc-200"
}

function ballLabel(b: BallEvent): string {
  if (b.wicket) return "W"
  if (b.six) return "6"
  if (b.four) return "4"
  return String(b.runs)
}

export function BallTicker({ balls }: { balls: BallEvent[] }) {
  if (!balls || balls.length === 0) return null

  return (
    <div className="flex items-center gap-1 justify-center mt-1.5">
      <span className="text-[9px] text-muted-foreground/50 mr-1 shrink-0">LAST</span>
      {balls.map((b, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
            ballColor(b)
          )}
        >
          {ballLabel(b)}
        </span>
      ))}
    </div>
  )
}

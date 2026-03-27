import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type FormIndicator = "hot" | "warm" | "neutral" | "cold" | string | null

export function FormIcon({ indicator }: { indicator: FormIndicator }) {
  if (!indicator) return null

  if (indicator === "hot") {
    return (
      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-status-success/15">
        <TrendingUp className="h-2.5 w-2.5 text-status-success" />
      </span>
    )
  }

  if (indicator === "warm") {
    return (
      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/15">
        <TrendingUp className="h-2.5 w-2.5 text-amber-400" />
      </span>
    )
  }

  if (indicator === "neutral") {
    return (
      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted/50">
        <Minus className="h-2.5 w-2.5 text-muted-foreground" />
      </span>
    )
  }

  // cold (default fallback)
  return (
    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500/15">
      <TrendingDown className="h-2.5 w-2.5 text-blue-400" />
    </span>
  )
}

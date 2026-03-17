import { TrendingUp, TrendingDown } from "lucide-react"

export function FormIcon({ indicator }: { indicator: "hot" | "cold" | null }) {
  if (!indicator) return null

  if (indicator === "hot") {
    return (
      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-status-success/15">
        <TrendingUp className="h-2.5 w-2.5 text-status-success" />
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500/15">
      <TrendingDown className="h-2.5 w-2.5 text-blue-400" />
    </span>
  )
}

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export function StatCard({
  icon: Icon,
  value,
  label,
  gradient,
  iconColor,
  trend,
}: {
  icon: LucideIcon
  value: string | number
  label: string
  gradient: string
  iconColor: string
  trend?: { value: string; positive: boolean }
}) {
  return (
    <Card className={`border border-overlay-border overflow-hidden relative bg-gradient-to-br ${gradient} via-transparent to-transparent`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-full ${iconColor} p-2.5`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold font-display">{value}</p>
              {trend && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  trend.positive
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}>
                  {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {trend.value}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

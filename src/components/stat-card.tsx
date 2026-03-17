import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

export function StatCard({
  icon: Icon,
  value,
  label,
  gradient,
  iconColor,
}: {
  icon: LucideIcon
  value: string | number
  label: string
  gradient: string
  iconColor: string
}) {
  return (
    <Card className={`border border-border overflow-hidden relative bg-gradient-to-br ${gradient} via-transparent to-transparent`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-full ${iconColor} p-2.5`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

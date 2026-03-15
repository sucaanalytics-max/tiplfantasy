import { cn } from "@/lib/utils"

export function SegmentedProgressBar({
  filled,
  total,
  className,
}: {
  filled: number
  total: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-4 rounded-sm transition-colors",
              i < filled ? "bg-cyan-500" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-xs font-semibold tabular-nums">
        {filled}/{total}
      </span>
    </div>
  )
}

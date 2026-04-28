import { Crown, Star } from "lucide-react"
import { cn } from "@/lib/utils"

type Variant = "captain" | "vice"
type Size = "sm" | "md" | "lg"

type Props = {
  variant: Variant
  size?: Size
  className?: string
  position?: "tr" | "tl" | "br" | "bl"
}

const SIZE_PX: Record<Size, { box: string; icon: string; text: string }> = {
  sm: { box: "h-4 w-4 text-[8px]", icon: "h-2 w-2", text: "text-[8px]" },
  md: { box: "h-5 w-5 text-[10px]", icon: "h-2.5 w-2.5", text: "text-[10px]" },
  lg: { box: "h-6 w-6 text-xs", icon: "h-3 w-3", text: "text-xs" },
}

const POSITION: Record<NonNullable<Props["position"]>, string> = {
  tr: "-top-1 -right-1",
  tl: "-top-1 -left-1",
  br: "-bottom-1 -right-1",
  bl: "-bottom-1 -left-1",
}

export function CaptainOverlay({ variant, size = "md", className, position = "tr" }: Props) {
  const isC = variant === "captain"
  const Icon = isC ? Crown : Star
  const dims = SIZE_PX[size]

  return (
    <span
      className={cn(
        "absolute z-10 inline-flex items-center justify-center rounded-full font-bold font-display tabular-nums",
        "border border-background/40",
        "animate-scale-in",
        dims.box,
        POSITION[position],
        isC ? "bg-[var(--captain-gold)] text-[oklch(0.18_0.02_86)]" : "bg-[var(--vice-silver)] text-[oklch(0.15_0.01_60)]",
        className
      )}
      style={{
        boxShadow: isC
          ? "0 0 10px var(--captain-gold-glow)"
          : "0 0 8px var(--vice-silver-glow)",
      }}
      aria-label={isC ? "Captain (×2)" : "Vice-captain (×1.5)"}
    >
      <Icon className={cn(dims.icon, isC ? "fill-current" : "")} aria-hidden />
    </span>
  )
}

/** Inline pill version (e.g. "⭐ Captain ×2") for under-headshot labels. */
type PillProps = Omit<Props, "position">
export function CaptainPill({ variant, size = "md", className }: PillProps) {
  const isC = variant === "captain"
  const Icon = isC ? Crown : Star
  const dims = SIZE_PX[size]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display font-bold uppercase tracking-wider",
        dims.text,
        isC ? "bg-[var(--captain-gold)] text-[oklch(0.18_0.02_86)]" : "bg-[var(--vice-silver)] text-[oklch(0.15_0.01_60)]",
        className
      )}
    >
      <Icon className={cn(dims.icon, isC ? "fill-current" : "")} aria-hidden />
      {isC ? "Captain ×2" : "Vice ×1.5"}
    </span>
  )
}

"use client"

import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type SortDir = "asc" | "desc"

export function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
  hide,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: "left" | "right" | "center"
  hide?: "md" | "lg"
}) {
  const alignClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  const hideClass = hide === "md" ? "hidden md:flex" : hide === "lg" ? "hidden lg:flex" : "flex"
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "items-center gap-0.5 tabular-nums transition-colors",
        hideClass,
        alignClass,
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {active && (dir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
    </button>
  )
}

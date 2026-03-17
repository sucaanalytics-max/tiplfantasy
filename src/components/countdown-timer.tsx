"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  targetTime: string
  variant?: "compact" | "full"
  onExpire?: () => void
  className?: string
}

function getTimeLeft(target: Date) {
  const now = Date.now()
  const diff = target.getTime() - now
  if (diff <= 0) return null

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  return { days, hours, minutes, seconds, totalMs: diff }
}

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

export function CountdownTimer({ targetTime, variant = "compact", onExpire, className }: Props) {
  const target = new Date(targetTime)
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(target))

  useEffect(() => {
    const interval = setInterval(() => {
      const tl = getTimeLeft(target)
      setTimeLeft(tl)
      if (!tl) {
        clearInterval(interval)
        onExpire?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetTime])

  // Expired
  if (!timeLeft) {
    return (
      <Badge variant="completed" className={cn("gap-1", className)}>
        <Lock className="h-3 w-3" />
        Locked
      </Badge>
    )
  }

  const { days, hours, minutes, seconds, totalMs } = timeLeft
  const totalHours = days * 24 + hours

  // Urgency levels
  const isUrgent = totalMs < 2 * 3600000 // < 2 hours
  const isCritical = totalMs < 15 * 60000 // < 15 minutes
  const isWarning = totalMs < 24 * 3600000 && !isUrgent // < 24 hours

  const urgencyClass = isCritical
    ? "text-status-danger font-bold animate-urgency-pulse"
    : isUrgent
    ? "text-status-danger"
    : isWarning
    ? "text-status-warning"
    : "text-muted-foreground"

  if (variant === "full") {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {isCritical ? "Locks soon!" : "Team locks in"}
        </span>
        <div className={cn("font-display tabular-nums flex items-center gap-1", urgencyClass)}>
          {totalHours >= 24 ? (
            <span className="text-2xl">{days}d {hours}h</span>
          ) : totalHours >= 1 ? (
            <>
              <TimeBox value={pad(totalHours)} label="hrs" />
              <Colon />
              <TimeBox value={pad(minutes)} label="min" />
              <Colon />
              <TimeBox value={pad(seconds)} label="sec" />
            </>
          ) : (
            <>
              <TimeBox value={pad(minutes)} label="min" />
              <Colon />
              <TimeBox value={pad(seconds)} label="sec" />
            </>
          )}
        </div>
      </div>
    )
  }

  // Compact variant
  const text = totalHours >= 24
    ? `${days}d ${hours}h`
    : totalHours >= 1
    ? `${totalHours}h ${minutes}m`
    : `${minutes}m ${seconds}s`

  return (
    <span className={cn("text-xs tabular-nums", urgencyClass, className)}>
      {text}
    </span>
  )
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl leading-none">{value}</span>
      <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-sans font-normal">
        {label}
      </span>
    </div>
  )
}

function Colon() {
  return <span className="text-xl leading-none text-muted-foreground/50 self-start mt-0.5">:</span>
}

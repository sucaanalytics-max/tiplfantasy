"use client"

import { useEffect, useState } from "react"

const COLORS = [
  "oklch(0.68 0.16 265)",  // primary blue
  "oklch(0.70 0.20 40)",   // accent orange
  "oklch(0.75 0.15 85)",   // amber
  "oklch(0.65 0.20 150)",  // green
  "oklch(0.60 0.25 330)",  // pink
  "oklch(0.80 0.10 200)",  // cyan
]

const PIECE_COUNT = 30

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

export function Confetti({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  if (!visible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }).map((_, i) => {
        const color = COLORS[i % COLORS.length]
        const left = randomBetween(5, 95)
        const delay = randomBetween(0, 0.8)
        const duration = randomBetween(1.8, 3)
        const size = randomBetween(6, 12)
        const rotation = randomBetween(0, 360)

        return (
          <div
            key={i}
            className="absolute top-0"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`,
              transform: `rotate(${rotation}deg)`,
              opacity: 0,
            }}
          />
        )
      })}
    </div>
  )
}

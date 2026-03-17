"use client"

import { useEffect, useRef } from "react"
import { useMotionValue, useSpring, useTransform, motion } from "framer-motion"

export function AnimatedNumber({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 20 })
  const display = useTransform(springValue, (v) => Math.round(v))

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v)
    })
    return unsubscribe
  }, [display])

  return <motion.span ref={ref} className={className}>{value}</motion.span>
}

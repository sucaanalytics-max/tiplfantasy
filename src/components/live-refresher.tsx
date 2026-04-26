"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Polls `router.refresh()` every `interval` ms.
 *
 * Skips a refresh if the user is actively touching/scrolling — the next
 * tick after the gesture ends picks up the deferred refresh, so the table
 * doesn't reorder under the user's finger. A single deferred-poll fires
 * within 1.5s of touch-end.
 */
export function LiveRefresher({ interval = 30000 }: { interval?: number }) {
  const router = useRouter()
  const touchingRef = useRef(false)
  const deferredRef = useRef(false)

  useEffect(() => {
    const onTouchStart = () => { touchingRef.current = true }
    const onTouchEnd = () => {
      touchingRef.current = false
      if (deferredRef.current) {
        deferredRef.current = false
        // Settle a beat after touch-end so we don't re-render while the
        // user's momentum scroll is still resolving.
        setTimeout(() => router.refresh(), 1500)
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    window.addEventListener("touchcancel", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [router])

  useEffect(() => {
    const id = setInterval(() => {
      if (touchingRef.current) {
        deferredRef.current = true
        return
      }
      router.refresh()
    }, interval)
    return () => clearInterval(id)
  }, [router, interval])

  return null
}

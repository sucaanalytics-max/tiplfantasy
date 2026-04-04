"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return

    // Track visit count — only show on 2nd+ visit
    const visitCount = parseInt(localStorage.getItem("pwa-visit-count") ?? "0", 10) + 1
    localStorage.setItem("pwa-visit-count", visitCount.toString())
    if (visitCount < 2) return

    // Check if dismissed recently
    const dismissed = localStorage.getItem("pwa-prompt-dismissed")
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return
    }

    // iOS detection — Safari doesn't fire beforeinstallprompt
    const ua = navigator.userAgent
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)
    if (isIOSDevice) {
      setIsIOS(true)
      setShowPrompt(true)
      return
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] md:left-56">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs">
        <span className="text-foreground/80">
          {isIOS
            ? "📱 Tap Share → Add to Home Screen"
            : "📱 Add to home screen for the best experience"}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!isIOS && (
            <button onClick={handleInstall} className="font-semibold text-primary hover:underline">
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

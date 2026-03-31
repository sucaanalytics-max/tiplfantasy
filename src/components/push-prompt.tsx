"use client"

import { useState, useEffect } from "react"
import { Bell, Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function PushPrompt() {
  const [show, setShow] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [needsInstall, setNeedsInstall] = useState(false)

  useEffect(() => {
    // Check if dismissed recently
    const dismissed = localStorage.getItem("push-prompt-dismissed")
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return

    // Check if push is supported
    const pushSupported = "Notification" in window && "serviceWorker" in navigator

    if (!pushSupported) {
      // On mobile browser without PWA installed — show install guidance
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      if (!isStandalone) {
        const timer = setTimeout(() => { setNeedsInstall(true); setShow(true) }, 3000)
        return () => clearTimeout(timer)
      }
      return
    }

    if (Notification.permission === "granted") {
      subscribeUser()
      return
    }
    if (Notification.permission === "denied") return

    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  async function subscribeUser() {
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      })

      const json = sub.toJSON()
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })

      setSubscribed(true)
      setShow(false)
    } catch {
      // User declined or error — hide prompt
      setShow(false)
    }
  }

  function dismiss() {
    localStorage.setItem("push-prompt-dismissed", String(Date.now()))
    setShow(false)
  }

  if (!show || subscribed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-80 z-40 animate-slide-up">
      <div className="bg-secondary border border-border rounded-xl p-4 shadow-lg flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2 shrink-0">
          {needsInstall ? <Download className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          {needsInstall ? (
            <>
              <p className="text-sm font-medium">Install TIPL App</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add to Home Screen to get live score notifications during matches
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Tap <span className="font-medium text-foreground">Share</span> → <span className="font-medium text-foreground">Add to Home Screen</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Enable Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get live score updates and banter during matches
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs" onClick={subscribeUser}>
                  Enable
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
                  Later
                </Button>
              </div>
            </>
          )}
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

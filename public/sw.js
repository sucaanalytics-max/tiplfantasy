const CACHE_NAME = "tipl-v2"
const APP_SHELL = [
  "/",
  "/dashboard",
  "/leaderboard",
  "/matches",
  "/profile",
  "/manifest.json",
]

// Install — cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event

  // Skip non-GET and API/auth requests
  if (request.method !== "GET") return
  if (request.url.includes("/auth/")) return
  if (request.url.includes("/rest/")) return
  if (request.url.includes("supabase")) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful HTML/JS responses
        if (response.ok && (request.url.endsWith("/") || request.destination === "document")) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // For navigation requests, return cached dashboard
          if (request.destination === "document") {
            return caches.match("/dashboard")
          }
          return new Response("Offline", { status: 503 })
        })
      })
  )
})

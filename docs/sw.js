// Bump CACHE_VERSION on every deploy that must invalidate cached assets.
const CACHE_VERSION = 'v2'
const CACHE_NAME = `learningspace-${CACHE_VERSION}`
const APP_SHELL = ['/', '/favicon.svg', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

const putInCache = (request, response) => {
  if (!response || !response.ok || response.type === 'opaque') return
  const clone = response.clone()
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only same-origin GETs are intercepted. Cross-origin calls (Supabase, Google
  // Fonts, dictionary proxies) and all mutations go straight to the network so
  // API responses are never cached or replayed stale.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // App shell: network-first, so a new deploy is picked up on the next load.
  // The cached shell is only an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(new Request('/'), response)
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match(request)))
    )
    return
  }

  // Build output lives under /assets/ with a content hash in the filename, so
  // a given URL is immutable: cache-first never serves the wrong version.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          putInCache(request, response)
          return response
        })
      })
    )
    return
  }

  // Unhashed same-origin files (favicon, manifest, ...): serve from cache but
  // refresh in the background so they never stay stale.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          putInCache(request, response)
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})

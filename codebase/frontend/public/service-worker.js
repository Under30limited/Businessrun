/**
 * service-worker.js
 *
 * Place this file in your React project's `public/` folder so CRA copies
 * it into the build root as-is (it must NOT be inside src/).
 *
 * CACHE STRATEGY
 * ──────────────
 * Two named caches are used:
 *
 *   businessrun-static-v{VERSION}
 *     CRA's hashed JS/CSS/media files under /static/.
 *     Strategy: Cache-First — filename IS the cache key; if content
 *     changes CRA gives it a new hash so the old cache entry is never
 *     used for new content.
 *
 *   businessrun-pages-v{VERSION}
 *     HTML navigation requests (index.html / SPA routes).
 *     Strategy: Network-First — always try the network; fall back to
 *     the cache only when the user is offline.
 *
 * DEPLOYMENT / VERSIONING
 * ───────────────────────
 * Bump CACHE_VERSION with every deploy (or wire it to your CI pipeline).
 * On activation the SW deletes all caches whose names don't match the
 * current version strings, so stale assets are automatically evicted
 * and every user gets the fresh build on their next page load — no
 * manual cache clearing required.
 *
 * SKIP WAITING
 * ────────────
 * The SW calls skipWaiting() during install so it activates immediately
 * instead of waiting for all existing tabs to close. Combined with
 * clients.claim() in activate, the new SW takes control right away and
 * the registration script in index.html reloads the page to apply it.
 */

// ── Version — bump this string on every deployment ───────────────────────────
// Tip: replace manually, or inject via your build script:
//   sed -i "s/CACHE_VERSION = '.*'/CACHE_VERSION = '$(date +%Y%m%d%H%M%S)'/" public/service-worker.js
const CACHE_VERSION = '1.0.0';

const STATIC_CACHE = `businessrun-static-v${CACHE_VERSION}`;
const PAGES_CACHE  = `businessrun-pages-v${CACHE_VERSION}`;
const ALL_CACHES   = [STATIC_CACHE, PAGES_CACHE];

// ── Install ───────────────────────────────────────────────────────────────────
// Take over immediately — do not wait for existing tabs to close.
self.addEventListener('install', event => {
  self.skipWaiting();
  // Pre-cache index.html so the app works offline from the first visit.
  event.waitUntil(
    caches.open(PAGES_CACHE).then(cache => cache.add('/'))
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
// Delete every cache that doesn't belong to this version.
// This is the core of the cache-busting: old static assets are wiped the
// moment the new SW activates, so users never see a mix of old and new files.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => !ALL_CACHES.includes(name))
          .map(name => {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => {
      // Take control of all open tabs immediately.
      return self.clients.claim();
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── 1. Never intercept API calls ─────────────────────────────────────────
  // Let /api/* go straight to the network — no caching, no interference.
  if (url.pathname.startsWith('/api')) return;

  // ── 2. Only handle same-origin requests ──────────────────────────────────
  if (url.origin !== self.location.origin) return;

  // ── 3. CRA hashed static assets — Cache-First ────────────────────────────
  // Files under /static/ have content-hashed names. If it's in the cache,
  // serve it instantly. If not, fetch from network and cache it.
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── 4. HTML navigation requests — Network-First ───────────────────────────
  // For page navigations (GET requests that return HTML / SPA routes),
  // always try the network first so users get the latest index.html.
  // Fall back to the cached version only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy of index.html for offline use.
          if (response.ok) {
            caches.open(PAGES_CACHE).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          // Offline fallback — serve the cached index.html.
          caches.match('/').then(cached => cached || Response.error())
        )
    );
    return;
  }

  // ── 5. Everything else (fonts, images, manifest) — Network-First ─────────
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

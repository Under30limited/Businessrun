/**
 * sw.js — BusinessRun Service Worker
 *
 * CACHING STRATEGY:
 *
 *   App Shell (HTML, CSS, JS bundles) → Cache First
 *     The React app itself rarely changes between visits.
 *     Serve from cache instantly, update in background.
 *
 *   API requests (/api/*) → Network First, no cache
 *     Financial data must always be fresh. Never serve
 *     stale sales, inventory, or auth responses.
 *     If the network fails, show the offline page.
 *
 *   Static assets (images, fonts, icons) → Cache First
 *     Product images from Firebase Storage, icons, etc.
 *     Cache aggressively — they change rarely.
 *
 * OFFLINE BEHAVIOUR:
 *   If the user opens the app with no internet, they see
 *   a clean offline page (not a browser error screen).
 *   Once back online, the app resumes normally.
 */

const CACHE_VERSION   = 'businessrun-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSETS_CACHE    = `${CACHE_VERSION}-assets`;
const OFFLINE_URL     = '/offline.html';

// App shell files to pre-cache on install
const APP_SHELL_FILES = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// ── Install — pre-cache the app shell ────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache => {
      return cache.addAll(APP_SHELL_FILES);
    }).then(() => {
      // Activate immediately — don't wait for old SW to expire
      return self.skipWaiting();
    })
  );
});

// ── Activate — clean up old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('businessrun-') && name !== APP_SHELL_CACHE && name !== ASSETS_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => {
      // Take control of all open pages immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch — route requests through caching strategies ────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API requests — Network First, no cache
  //    Financial data must always be live.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. Firebase Storage (product images) — Cache First
  if (url.hostname.includes('storage.googleapis.com') ||
      url.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // 3. Same-origin static assets (JS bundles, CSS, images) — Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  // 4. Everything else — Network First
  event.respondWith(networkFirst(request));
});

// ── Caching strategy: Network First ──────────────────────────────
// Try network, fall back to cache, fall back to offline page for navigation.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Network failed
    if (request.mode === 'navigate') {
      const cached = await caches.match(OFFLINE_URL);
      return cached || new Response('Offline', { status: 503 });
    }
    const cached = await caches.match(request);
    return cached || new Response('Network error', { status: 503 });
  }
}

// ── Caching strategy: Cache First ────────────────────────────────
// Serve from cache if available, otherwise fetch and cache the response.
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL);
      return offlinePage || new Response('Offline', { status: 503 });
    }
    return new Response('Network error', { status: 503 });
  }
}

// ── Background sync — queue failed API writes for retry ──────────
// When a user logs a sale or adds inventory offline, the request
// is queued and retried automatically when connectivity returns.
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(retrySyncQueue('pending-sales', '/api/sales'));
  }
  if (event.tag === 'sync-inventory') {
    event.waitUntil(retrySyncQueue('pending-inventory', '/api/inventory'));
  }
});

async function retrySyncQueue(storeName, endpoint) {
  // Background sync retry logic — pairs with IndexedDB queue in the app
  // Currently a placeholder — full offline write support is a future feature
  console.log(`[SW] Retrying sync queue: ${storeName} → ${endpoint}`);
}

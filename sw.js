// =============================================
// TRAVEL ASSIST — Service Worker (sw.js)
// Offline-first, cache-first strategy
// =============================================

const CACHE_NAME = 'travel-assist-v1.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap'
];

// ---- INSTALL: Pre-cache all assets ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE.map(url => {
        // Use 'no-cors' for cross-origin resources (Google Fonts)
        if (url.startsWith('https://fonts.googleapis.com')) {
          return new Request(url, { mode: 'no-cors' });
        }
        return url;
      })).catch((err) => {
        console.warn('[SW] Cache failed for some assets:', err);
      });
    }).then(() => {
      console.log('[SW] Assets cached successfully');
      return self.skipWaiting();
    })
  );
});

// ---- ACTIVATE: Clean old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated. Claiming clients...');
      return self.clients.claim();
    })
  );
});

// ---- FETCH: Cache-first, fallback to network ----
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and data URLs
  if (request.url.startsWith('chrome-extension://') ||
      request.url.startsWith('data:')) return;

  // For API/Maps requests: network-first
  if (request.url.includes('maps.google.com') ||
      request.url.includes('googleapis.com/maps') ||
      request.url.includes('nominatim.openstreetmap.org')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // For fonts: cache-first with long TTL
  if (request.url.includes('fonts.googleapis.com') ||
      request.url.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // For app shell: cache-first
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return offline fallback
    return offlineFallback(request);
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

// Offline fallback
async function offlineFallback(request) {
  const cached = await caches.match('./index.html');
  if (cached) return cached;

  return new Response(
    '<html><body><h1>Offline</h1><p>Travel Assist funziona anche offline. Ricarica quando hai connessione.</p></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ---- MESSAGE: Force update ----
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- BACKGROUND SYNC (future use) ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trip-data') {
    console.log('[SW] Background sync: trip-data');
  }
});

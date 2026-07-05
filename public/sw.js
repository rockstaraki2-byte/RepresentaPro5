const CACHE_NAME = 'representapro-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installs the service worker and pre-caches the core shells/assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pré-cacheando arquivos essenciais');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activates and cleans up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Limpando cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepts network requests with a highly robust strategy:
// 1. Navigation requests ('navigate') -> Try Network-First, fallback to cached '/index.html' so SPA loads offline
// 2. Same-origin static assets -> Stale-While-Revalidate (serve instantly from cache, update in background)
// 3. Other requests (Firestore, APIs) -> Bypass and let native browser / SDK handle
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Firestore & external Auth/DB bypass (handled natively by Firebase's persistentLocalCache)
  if (!url.origin.includes(self.location.hostname)) {
    return;
  }

  // Handle SPA Navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Keep a copy of the latest index.html in cache
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If offline, serve the cached SPA shell
          console.log('[Service Worker] Offline: Servindo shell de index.html');
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Handle static assets (JS, CSS, images, icons, local resources) on same-origin
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[Service Worker] Falha ao atualizar recurso do servidor:', url.pathname, err);
          return cachedResponse; // Return cached if network fails
        });

      // Stale-While-Revalidate strategy: return cached response instantly, but update in background
      return cachedResponse || fetchPromise;
    })
  );
});

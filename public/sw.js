const CACHE_NAME = 'representapro-cache-dev';
const BASE_ASSETS = ['/', '/index.html', '/manifest.json', '/representapro-icon.svg'];
const BUILD_ASSETS = []; // INJECT_BUILD_ASSETS
const ASSETS_TO_CACHE = [...new Set([...BASE_ASSETS, ...BUILD_ASSETS])];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => {
        if (key.startsWith('representapro-cache-') && key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return undefined;
      })))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('/index.html')) || new Response(
          'O RepresentaPRO ainda não foi carregado neste dispositivo. Conecte-se à internet e abra o sistema uma vez.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        );
      }
    })());
    return;
  }

  const isPrecached = ASSETS_TO_CACHE.includes(url.pathname);
  const isStaticAsset = ['script', 'style', 'image', 'font'].includes(request.destination);
  if (!isPrecached && !isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('Recurso indisponível sem conexão.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

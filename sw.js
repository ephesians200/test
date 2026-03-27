const CACHE_NAME = 'predictpro-v4';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install — precache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API calls → network-first, cache fallback
  if (url.hostname.includes('football-ai-backend') || url.hostname.includes('workers.dev')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(event.request, { signal: AbortSignal.timeout(15000) })
          .then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }

  // Static assets → cache-first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

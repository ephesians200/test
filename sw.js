// ═══════════════════════════════════════════════════════════
// PredictPro Service Worker — Cache-first for static,
// Network-first for API, offline fallback
// ═══════════════════════════════════════════════════════════
const CACHE = 'predictpro-sw-v5';
const API_HOST = 'football-ai-backend.ephesians2004.workers.dev';

const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API requests → network-first, cache fallback
  if (url.hostname === API_HOST || url.hostname.includes('workers.dev')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(e.request, { signal: AbortSignal.timeout(20000) })
          .then(resp => {
            if (resp.ok) cache.put(e.request, resp.clone());
            return resp;
          })
          .catch(() => cache.match(e.request))
      )
    );
    return;
  }

  // Static assets → cache-first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && url.origin === self.location.origin) {
          const cl = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, cl));
        }
        return resp;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

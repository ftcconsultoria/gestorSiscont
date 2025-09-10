self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Only handle same-origin GET requests to avoid CORS noise in console
self.addEventListener('fetch', (event) => {
  try {
    const req = event.request;
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;

    // Let the browser handle cross-origin or non-GET requests
    if (!sameOrigin || req.method !== 'GET') return;

    event.respondWith(
      caches.open('app-cache-v1').then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            try { cache.put(req, res.clone()); } catch (_) { /* ignore */ }
          }
          return res;
        } catch (_) {
          // As a last resort, try any cached match (might be undefined)
          return cache.match(req);
        }
      })
    );
  } catch (_) {
    // Swallow unexpected errors in the SW fetch handler
  }
});

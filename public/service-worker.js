self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('file-share-cache').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/style.css',
        '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  // Network-first strategy for API requests
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Clone the response before caching
          const responseClone = response.clone();
          caches.open('file-share-cache').then(cache => {
            cache.put(e.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(e.request);
        })
    );
  } else {
    // Cache-first strategy for static assets
    e.respondWith(
      caches.match(e.request).then(response => {
        return response || fetch(e.request);
      })
    );
  }
});

// Background sync event listener (placeholder for future implementation)
self.addEventListener('sync', e => {
  // TODO: Implement background sync for offline post submissions
});

// Handle online/offline status changes (placeholder for future implementation)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
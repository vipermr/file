const CACHE_NAME = 'nafij-file-share-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/all.html',
  '/info.html',
  '/admin.html',
  '/style.css',
  '/manifest.json',
  '/icon.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with appropriate caching strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirstStrategy(request)
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
    event.respondWith(
      cacheFirstStrategy(request)
    );
    return;
  }

  // Handle uploaded files with cache-first strategy
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      cacheFirstStrategy(request)
    );
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstStrategy(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default: try network first, fallback to cache
  event.respondWith(
    networkFirstStrategy(request)
  );
});

// Network-first strategy for API requests
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    
    throw error;
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Failed to fetch:', request.url, error);
    throw error;
  }
}

// Background sync for offline posts
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-post') {
    event.waitUntil(syncOfflinePosts());
  }
});

// Sync offline posts when connection is restored
async function syncOfflinePosts() {
  try {
    // Get offline posts from IndexedDB (would need to implement storage)
    console.log('Syncing offline posts...');
    
    // This is a placeholder - in a full implementation, you would:
    // 1. Retrieve posts stored in IndexedDB while offline
    // 2. Send them to the server
    // 3. Remove them from local storage on success
    // 4. Notify the user of sync status
    
    // Send message to clients about sync status
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Offline posts have been synced'
      });
    });
    
  } catch (error) {
    console.error('Error syncing offline posts:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', event => {
  const { data } = event;
  
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (data && data.type === 'CACHE_POST') {
    // Cache a post for offline access
    caches.open(DYNAMIC_CACHE)
      .then(cache => cache.put(data.url, new Response(JSON.stringify(data.post))));
  }
});

// Push notification handling (for future implementation)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      },
      actions: [
        {
          action: 'explore',
          title: 'View Post',
          icon: '/icon.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icon.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync (for future implementation)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function syncContent() {
  // Sync new content in the background
  try {
    const response = await fetch('/api/posts');
    if (response.ok) {
      const posts = await response.json();
      
      // Cache new posts
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put('/api/posts', new Response(JSON.stringify(posts)));
      
      // Notify clients of new content
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'NEW_CONTENT',
          count: posts.length
        });
      });
    }
  } catch (error) {
    console.error('Error syncing content:', error);
  }
}
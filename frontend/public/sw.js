/**
 * NiyamCheck Service Worker (Milestone 6: Real-World Hardening & PWA)
 * 
 * Safety & Privacy Guarantees:
 * - Caches ONLY static application shell assets (HTML, CSS, JS, icons).
 * - STRICTLY BYPASSES all /api/ endpoints (analysis, inspections, reports, and legal search).
 * - Zero caching of private inspection data, photos, or confidential audit findings.
 */

const CACHE_NAME = 'niyamcheck-app-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
];

// Install Event: Pre-cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-while-revalidate for static assets, network-only for all API routes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL RULE: Never cache or intercept any API endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/v1/')) {
    // Pass straight to network without Service Worker caching
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Navigation requests (HTML document)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Static assets: Cache-First with background revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch updated version in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Offline - cached response already used
          });
        return cachedResponse;
      }

      // Not in cache: fetch from network and cache static chunks
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache JS, CSS, fonts, and images
        if (
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.png') ||
          url.pathname.includes('/assets/')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      }).catch(() => {
        // Fallback for failed asset loads when offline
        if (event.request.destination === 'image') {
          return caches.match('/favicon.svg');
        }
      });
    })
  );
});

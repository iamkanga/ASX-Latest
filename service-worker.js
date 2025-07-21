// Service Worker Version: 1.0.1

// Cache name for the current version of the service worker
const CACHE_NAME = 'share-watchlist-v1.0.1'; // Version incremented

// List of essential application assets to precache
const CACHED_ASSETS = [
    './', // Caches the root (index.html)
    './index.html',
    './script.js',
    './style.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    // Firebase SDKs are loaded as modules, so they might not be directly in the cache list
    // if not explicitly requested by the main app. However, if they are, it's good to list them.
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Install event: caches all essential assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache opened, adding assets.');
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: All assets added to cache. Skipping waiting.');
                return self.skipWaiting(); // Force the new service worker to activate immediately
            })
            .catch(error => {
                console.error('Service Worker: Installation failed:', error);
            })
    );
});

// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`Service Worker: Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            ).then(() => self.clients.claim()); // Take control of clients immediately
        })
    );
});

// Fetch event: serves cached content or fetches from network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests, ignore others (like POST, PUT, DELETE)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Check if we received a valid response and if it's cacheable
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    // Not a valid or cacheable response, just return it without caching
                    return networkResponse;
                }

                // Clone the response to cache it. The original response will be returned to the browser.
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    // Use a try-catch block around cache.put for extra resilience
                    try {
                        cache.put(event.request, responseToCache);
                    } catch (e) {
                        console.warn(`Service Worker: Failed to cache ${event.request.url}:`, e);
                        // This catch handles potential issues with put, like NotFoundError
                        // but the original networkResponse is still returned.
                    }
                });

                return networkResponse;
            }).catch(error => {
                console.error(`Service Worker: Network fetch failed for ${event.request.url}.`, error);
                // If network fails, try to return a cached response as a fallback
                return caches.match(event.request);
            });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker: Cache match failed for ${event.request.url}.`, error);
                // Fallback in case both cache match and network fetch fail
                return fetch(event.request); // Try network one more time if cache fails
            })
        );
    } else {
        // For non-GET requests (e.g., POST, PUT, DELETE), just fetch from network
        // Do NOT cache these requests as they modify data.
        event.respondWith(fetch(event.request));
    }
});

// Message event: allows the app to send messages to the service worker (e.g., to skip waiting)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        console.log('Service Worker: Skip waiting message received, new SW activated.');
    }
});

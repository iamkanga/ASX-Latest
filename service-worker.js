// Service Worker Version: 1.0.2

// Cache name for the current version of the service worker
const CACHE_NAME = 'share-watchlist-v1.0.2'; // Version incremented

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
            .catch((error) => {
                console.error('Service Worker: Cache.addAll failed during install:', error);
            })
    );
});

// Activate event: deletes old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => {
            console.log('Service Worker: Old caches cleared. Claiming clients.');
            return self.clients.claim(); // Take control of un-controlled clients
        })
    );
});

// Fetch event: serves cached content when offline, falls back to network
self.addEventListener('fetch', (event) => {
    // Only intercept GET requests
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // If a response is found in the cache, return it
                if (cachedResponse) {
                    // console.log('Service Worker: Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // If not in cache, try to fetch from the network
                // console.log('Service Worker: Fetching from network:', event.request.url);
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Check if we received a valid response
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        // IMPORTANT: Clone the response. A response is a stream
                        // and can only be consumed once. We need to consume it once
                        // to cache it and once to return it.
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker: Network fetch failed for ${event.request.url}.`, error);
                    // If network fails, try to return a cached response as a fallback
                    return caches.match(event.request); // Try to get from cache again if network failed
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

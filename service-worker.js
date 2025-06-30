// File Version: v47
// Last Updated: 2025-06-30 (Precache local assets)

// Increment the cache name to force the browser to re-install this new service worker.
const CACHE_NAME = 'asx-tracker-v47'; 

// List of assets to precache.
const CACHED_ASSETS = [
    './', // Caches the root HTML file (index.html)
    'index.html', // Explicitly cache index.html
    'script.js',  // Explicitly cache script.js
    'style.css',  // Explicitly cache style.css
    'manifest.json', // Explicitly cache the PWA manifest
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker v47: Installing...'); // Updated log for version
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v47: Cache opened'); // Updated log
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => self.skipWaiting()) // Activate the new service worker immediately
            .catch((error) => {
                console.error('Service Worker v47: Cache addAll failed:', error); // Updated log
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker v47: Activating...'); // Updated log for version
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker v47: Deleting old cache:', cacheName); // Updated log
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of existing clients immediately
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests for caching. Do NOT cache POST, PUT, DELETE requests.
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // If a cached response is found, return it immediately
                if (cachedResponse) {
                    console.log(`Service Worker v47: Serving from cache: ${event.request.url}`); // Updated log
                    return cachedResponse;
                }

                // Otherwise, fetch from the network
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // IMPORTANT: Clone the response. A response is a stream
                    // and can only be consumed once. We must clone it so that
                    // the browser can consume one and we can consume the other.
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker v47: Network fetch failed for ${event.request.url}.`, error); // Updated log
                    // If network fails and there's no cache, or if you want to provide a specific fallback
                    // return caches.match('/offline.html'); // Example fallback
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker v47: Cache match failed for ${event.request.url}.`, error); // Updated log
                // Fallback in case both cache and network fail (unlikely given fetchPromise)
                return fetch(event.request); // Try network one more time if cache fails
            })
        );
    } else {
        // For non-GET requests (e.g., POST, PUT, DELETE), just fetch from network
        // Do NOT cache these requests as they modify data.
        event.respondWith(fetch(event.request));
    }
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        console.log('Service Worker v47: Skip waiting message received, new SW activated.'); // Updated log
    }
});

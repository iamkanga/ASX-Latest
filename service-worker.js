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
                console.log('Service Worker: Cache opened, adding assets...');
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: All assets added to cache. Skipping waiting.');
                return self.skipWaiting(); // Activate the new service worker immediately
            })
            .catch((error) => {
                console.error('Service Worker: Failed to cache essential assets during install:', error);
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
                    if (cacheName.startsWith('share-watchlist-') && cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Old caches cleared. Claiming clients.');
            return self.clients.claim(); // Take control of all clients immediately
        })
    );
});

// Fetch event: intercepts network requests
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method === 'GET') {
        // IMPORTANT: Do NOT cache Firestore API calls (or any dynamic API calls).
        // These are real-time data streams or dynamic queries and should always go to the network.
        if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('script.google.com/macros')) {
            // console.log(`Service Worker: Bypassing cache for dynamic API request: ${event.request.url}`);
            event.respondWith(fetch(event.request));
            return; // Exit early, don't try to cache this
        }

        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // If cached response is found, return it
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise, go to network
                return fetch(event.request).then((networkResponse) => {
                    // Check if the response is valid to cache
                    // A response is valid if it has a status of 200 and is not opaque (cross-origin without CORS)
                    // Opaque responses cannot be inspected or cached reliably.
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                        // console.log(`Service Worker: Skipping caching for response (status ${networkResponse ? networkResponse.status : 'N/A'}, type ${networkResponse ? networkResponse.type : 'N/A'}): ${event.request.url}`);
                        return networkResponse; // Return the response without caching
                    }

                    // Clone the response because it's a stream and can only be consumed once
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache).catch(e => {
                            console.error(`Service Worker: Failed to cache (put error) ${event.request.url}:`, e);
                        });
                    });

                    return networkResponse; // Always return the original network response
                }).catch(error => {
                    console.error(`Service Worker: Network fetch failed for ${event.request.url}. Returning offline fallback if available.`, error);
                    // If network fails, try to return a cached response as a fallback
                    return caches.match(event.request);
                });

            }) // No second .catch here, as the inner fetch promise already handles its own errors and returns a fallback
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

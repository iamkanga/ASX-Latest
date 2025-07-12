// Service Worker Version: 1.0.2 (AGGRESSIVE EXTERNAL FETCH BYPASS)

// Cache name for the current version of the service worker
const CACHE_NAME = 'share-watchlist-v1.0.2'; // Updated cache name to force update

// List of essential application assets to precache
const CACHED_ASSETS = [
    './', // Caches the root (index.html)
    './index.html',
    './script.js',
    './style.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Apps Script URL (for reference, but now all external fetches are bypassed)
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxyxL-InwjKpRzIXLSJz0ib_3slbUyuIhxPg3klWIe0rkEVRSNc3tLaYo8m4rTjBWM/exec';


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
    // Check if the request is for an external resource (not on the same origin as the app)
    // This will bypass the service worker for ALL external fetches, including Apps Script
    if (event.request.url.startsWith('http') && !event.request.url.startsWith(self.location.origin)) {
        console.log(`Service Worker: Bypassing external fetch for: ${event.request.url}`);
        return; // Let the request go directly to the network, don't intercept or cache
    }

    // For internal (same-origin) GET requests, use cache-first strategy
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse.ok && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker: Network fetch failed for ${event.request.url}.`, error);
                    return caches.match(event.request); 
                });

                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker: Cache match failed for ${event.request.url}.`, error);
                return fetch(event.request); 
            })
        );
    } else {
        // For non-GET requests (e.g., POST, PUT, DELETE), just fetch from network
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

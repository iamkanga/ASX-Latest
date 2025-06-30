// File Version: v48
// Last Updated: 2025-06-30 (Added local files to precache, incremented version for update)

// Increment the cache name to force the browser to re-install this new service worker.
const CACHE_NAME = 'asx-tracker-v48'; 

// Assets to precache (local files and external CDNs)
const CACHED_ASSETS = [
    './', // Important for the root path
    './index.html',
    './script.js', 
    './style.css', 
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker v48: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v48: Cache opened');
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => {
                console.log('Service Worker v48: All assets added to cache. Calling skipWaiting.');
                self.skipWaiting(); // Activate new service worker immediately
            })
            .catch(error => {
                console.error('Service Worker v48: Installation failed:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker v48: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches starting with 'asx-tracker-' but not matching the current CACHE_NAME
                    if (cacheName.startsWith('asx-tracker-') && cacheName !== CACHE_NAME) {
                        console.log('Service Worker v48: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker v48: Old caches cleared. Claiming clients.');
            return self.clients.claim(); // Take control of all open clients immediately
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Check if the response is valid before caching
                    if (networkResponse.ok && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker v48: Network fetch failed for ${event.request.url}.`, error);
                    // If network fails, return cached response. If no cached, respond with a fallback (e.g., offline page)
                    return cachedResponse || new Response('<h1>Offline Content Not Available</h1><p>Please check your internet connection.</p>', { status: 503, headers: { 'Content-Type': 'text/html' } });
                });

                // Serve from cache immediately if available, but also update from network in background
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker v48: Cache match failed for ${event.request.url}.`, error);
                // If cache matching fails for some reason, try fetching from network
                return fetch(event.request);
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
        console.log('Service Worker v48: Skip waiting message received, new SW activated.');
    }
});

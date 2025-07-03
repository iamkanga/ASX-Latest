// File Version: v47
// Last Updated: 2025-06-30 (Added core app files to precache for faster initial load)

// Increment the cache name to force the browser to re-install this new service worker.
const CACHE_NAME = 'asx-tracker-v47'; 

// Precache all essential application assets, including local files.
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

self.addEventListener('install', (event) => {
    console.log('Service Worker v47: Installing...'); // Updated log for version
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v47: Cache opened'); // Updated log
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => {
                console.log('Service Worker v47: All assets added to cache. Calling skipWaiting.'); // Updated log
                return self.skipWaiting(); // Force the new service worker to activate immediately
            })
            .catch(error => {
                console.error('Service Worker v47: Installation failed:', error); // Updated log
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker v47: Activating...'); // Updated log
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`Service Worker v47: Deleting old cache: ${cacheName}`); // Updated log
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            ).then(() => self.clients.claim()); // Take control of clients immediately
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests, ignore others (like POST, PUT, DELETE)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Cache successful responses for future use
                    // Do not cache opaque responses (e.g., from third-party CDNs that don't allow CORS)
                    if (networkResponse.ok && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker v47: Network fetch failed for ${event.request.url}.`, error); // Updated log
                    // If network fails, try to return a cached response as a fallback
                    return caches.match(event.request); // Try to get from cache again if network failed
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker v47: Cache match failed for ${event.request.url}.`, error); // Updated log
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

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        console.log('Service Worker v47: Skip waiting message received, new SW activated.'); // Updated log
    }
});

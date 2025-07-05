// File Version: v50
// Last Updated: 2025-07-05 (Cache Version Increment for PWA Refresh)
// Added another small comment to force a new file hash for deployment.

// Increment the cache name to force the browser to re-install this new service worker.
const CACHE_NAME = 'asx-tracker-v50'; 

// Precache all essential application assets, including local files.
const CACHED_ASSETS = [
    './', // Caches the root (index.html)
    './index.html',
    './script.js',
    './style.css',
    './manifest.json', // Cache the manifest file
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker v50: Installing...'); // Updated log for version
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v50: Cache opened'); // Updated log
                return cache.addAll(CACHED_ASSETS);
            })
            .catch(error => {
                console.error('Service Worker v50: Failed to cache essential assets during install:', error); // Log specific error
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker v50: Activating...'); // Updated log
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker v50: Deleting old cache:', cacheName); // Updated log
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Immediately take control of clients
    console.log('Service Worker v50: Activated and claimed clients.'); // Updated log
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests, ignore others (e.g., POST for Firestore writes)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // If cached response is found, return it immediately
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise, fetch from the network
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse; // Return non-cacheable response as is
                    }

                    // Clone the response because it's a stream and can only be consumed once
                    const responseToCache = networkResponse.clone();

                    // Cache the new response
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker v50: Network fetch failed for ${event.request.url}.`, error); // Updated log
                    // If network fails, try to return a cached response as a fallback
                    return caches.match(event.request); // Try to get from cache again if network failed
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker v50: Cache match failed for ${event.request.url}.`, error); // Updated log
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
        console.log('Service Worker v50: Skip waiting message received, new SW activated.'); // Updated log
    }
});

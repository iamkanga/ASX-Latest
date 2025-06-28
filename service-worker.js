// File Version: v23
// Last Updated: 2025-06-27 (New version to attempt to fix SyntaxError)

// Increment the cache name to force the browser to re-install this new service worker.
const CACHE_NAME = 'asx-tracker-v23'; 

// Only precache external CDN assets.
// Local files (index.html, script.js, style.css) will be handled by the 'network-first' fetch strategy,
// which is more resilient to GitHub Pages sub-directory hosting.
const CACHED_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker v23: Installing...'); // Updated log for version
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v23: Cache opened'); // Updated log for version
                // Add all assets to the cache during install
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => {
                // Force the new service worker to activate immediately.
                // This will replace the old one without requiring a page refresh.
                self.skipWaiting();
                console.log('Service Worker v23: Installation complete and skipWaiting called.'); // Updated log
            })
            .catch((error) => {
                console.error('Service Worker v23: Cache addAll failed during install:', error); // Updated log
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker v23: Activating...'); // Updated log for version
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`Service Worker v23: Deleting old cache: ${cacheName}`); // Updated log
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Clients.claim() allows the service worker to take control of existing clients
            // (e.g., the current page) immediately upon activation.
            console.log('Service Worker v23: Old caches cleared, claiming clients.'); // Updated log
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests. POST requests (like Firebase auth) should not be cached.
    if (event.request.method === 'GET') {
        // Network First, then Cache strategy for ALL requests
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // If a cached response is found, fetch from network in background to update cache
                const fetchPromise = fetch(event.request).then(response => {
                    // Check if response is valid before caching (e.g., status 200)
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                }).catch(error => {
                    console.error(`Service Worker v23: Network fetch failed for ${event.request.url}.`, error); // Updated log
                    // If network fails and there's no cache, or if you want to provide a specific fallback
                    // return caches.match('/offline.html'); // Example fallback
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker v23: Cache match failed for ${event.request.url}.`, error); // Updated log
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
        console.log('Service Worker v23: Skip waiting message received, new SW activated.'); // Updated log
    }
});

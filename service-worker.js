// File Version: v48
// Last Updated: 2025-07-03 (Updated precache for new file versions)

// Increment the cache name to force the browser to re-install this new service worker.
const CACHE_NAME = 'asx-tracker-v48'; 

// Precache all essential application assets, including local files.
const CACHED_ASSETS = [
    './', // Caches the root (index.html)
    './index.html',
    './script.js', // Updated version
    './style.css', // Updated version
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker v48: Installing...'); // Updated log for version
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v48: Cache opened'); // Updated log
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => self.skipWaiting()) // Activate new service worker immediately
            .catch((error) => {
                console.error('Service Worker v48: Cache addAll failed:', error); // Updated log
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker v48: Activating...'); // Updated log for version
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker v48: Deleting old cache:', cacheName); // Updated log
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => self.clients.claim()) // Take control of all clients immediately
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests, ignore others (like POST, PUT, DELETE)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // If a cached response is found, return it
                if (cachedResponse) {
                    // console.log(`Service Worker v48: Serving from cache: ${event.request.url}`); // Updated log
                    return cachedResponse;
                }

                // Otherwise, fetch from the network
                // console.log(`Service Worker v48: Fetching from network: ${event.request.url}`); // Updated log
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // Check if we received a valid response
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        // IMPORTANT: Clone the response. A response is a stream
                        // and can only be consumed once. We must clone it so that
                        // the browser can consume one and we can consume the other.
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error(`Service Worker v48: Network fetch failed for ${event.request.url}.`, error); // Updated log
                    // If network fails, try to return a cached response as a fallback
                    return caches.match(event.request); // Try to get from cache again if network failed
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;

            }).catch(error => {
                console.error(`Service Worker v48: Cache match failed for ${event.request.url}.`, error); // Updated log
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
        console.log('Service Worker v48: Skip waiting message received, new SW activated.'); // Updated log
    }
});

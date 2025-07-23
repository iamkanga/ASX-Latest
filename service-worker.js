// Service Worker Version: 1.0.3 (Minor update for clarity on image paths)

// Cache name for the current version of the service worker
const CACHE_NAME = 'share-watchlist-v1.0.3'; // Version incremented for potential path fix

// List of essential application assets to precache
const CACHED_ASSETS = [
    './', // Caches the root (index.html)
    './index.html',
    './script.js',
    './style.css',
    './manifest.json',
    './favicn.jpg', // <<--- VERIFY THIS PATH AND FILENAME (e.g., Favicn.png vs favicn.jpg)
    './Kangaicon.jpg', // <<--- VERIFY THIS PATH AND FILENAME
    './asx_codes.csv', // Added for local CSV data
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    // Firebase SDKs are loaded as modules, and while generally cacheable,
    // they can sometimes cause issues with addAll if the CDN has specific headers.
    // If addAll continues to fail, consider temporarily removing these Firebase URLs
    // from CACHED_ASSETS to isolate the problem.
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
                // addAll is atomic; if any request fails, the entire operation fails.
                return cache.addAll(CACHED_ASSETS);
            })
            .catch((e) => {
                console.error('Service Worker: Failed to cache assets during install: ' + e.message, e);
                // Log which specific request failed if possible (though addAll doesn't easily expose this)
                // You might need to check the Network tab in dev tools during install to see which asset failed.
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
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => {
            // Ensure the service worker takes control of the page immediately
            console.log('Service Worker: Claiming clients.');
            return self.clients.claim();
        })
    );
});

// Fetch event: intercepts network requests
self.addEventListener('fetch', (event) => {
    // Only handle GET requests for caching strategy
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If not in cache, fetch from network
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Check if the response is valid to be put in cache
                    // A clone is needed because a response can only be consumed once.
                    const responseToCache = networkResponse.clone();

                    // Opaque responses (from cross-origin requests without CORS) cannot be inspected
                    // for status. We log a warning but still return the response.
                    if (networkResponse.type === 'opaque') {
                        // This warning is expected for external resources like Google Fonts or CDNs.
                        // It indicates the service worker cannot inspect the response, but it's still delivered.
                        console.warn(`Service Worker: Skipping caching for opaque response: ${event.request.url}`);
                        return networkResponse; // Return the original network response without caching
                    }

                    // Only cache successful (status 200) and 'basic' (same-origin) responses.
                    // This prevents caching 404s, redirects, or other non-cacheable responses.
                    if (networkResponse.status === 200 && networkResponse.type === 'basic') {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache)
                                .catch((e) => {
                                    console.error(`Service Worker: Failed to cache (put error) ${event.request.url}:`, e);
                                });
                        });
                    } else {
                        // Log if we're not caching for other reasons (e.g., not 200 OK, or not 'basic' type)
                        console.warn(`Service Worker: Not caching response due to status (${networkResponse.status}) or type (${networkResponse.type}): ${event.request.url}`);
                    }

                    return networkResponse; // Always return the original network response
                }).catch(error => {
                    console.error(`Service Worker: Network fetch failed for ${event.request.url}.`, error);
                    // If network fails, try to return a cached response as a fallback
                    // You might want to serve a custom offline page here.
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

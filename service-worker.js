// Service Worker Version: 1.0.14

// Unified App / Asset Version (bump this when deploying front-end changes to force fresh fetch of CSS/JS)
const APP_VERSION = '2.10.30';

// Cache name for the current version (auto-derived from APP_VERSION so we don't forget to bump both)
const CACHE_NAME = `share-watchlist-${APP_VERSION}`;

// List of essential application assets to precache
const CACHED_ASSETS = [
    './', // Caches the root (index.html)
    './index.html',
    `./script.js?v=${APP_VERSION}`,
    `./style.css?v=${APP_VERSION}`,
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    // Font Awesome served from CDN removed from precache because cross-origin fetches can time out.
    // Firebase SDKs are loaded as modules, so they might not be directly in the cache list
    // if not explicitly requested by the main app. However, if they are, it's good to list them.
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Install event: cache assets individually so one failure doesn't abort install
self.addEventListener('install', (event) => {
    console.log('[SW] Installing… version', APP_VERSION, 'cache', CACHE_NAME);
    event.waitUntil((async ()=>{
        const cache = await caches.open(CACHE_NAME);
        const results = await Promise.all(CACHED_ASSETS.map(async (url) => {
            const req = new Request(url, { cache: 'no-cache' });
            try {
                const res = await fetch(req);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                await cache.put(req, res.clone());
                console.log('[SW] Cached:', url);
                return { url, ok:true };
            } catch(err) {
                console.warn('[SW] Cache miss (skipped):', url, err.message || err);
                return { url, ok:false, err:err.message||String(err) };
            }
        }));
        const failed = results.filter(r=>!r.ok);
        if (failed.length) {
            console.warn('[SW] Some assets failed to cache (install continues):', failed.map(f=>f.url));
        } else {
            console.log('[SW] All listed assets cached.');
        }
        await self.skipWaiting();
    })());
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
        // Pre-compute whether this is a cross-origin request so we can avoid noisy logging for CDN failures
        let requestUrl;
        let isCrossOrigin = false;
        try { requestUrl = new URL(event.request.url); isCrossOrigin = requestUrl.origin !== self.location.origin; } catch(_) { /* ignore */ }
        // IMPORTANT: Do NOT cache Firestore API calls (or any dynamic API calls).
        // These are real-time data streams or dynamic queries and should always go to the network.
        if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('script.google.com/macros')) {
            // console.log(`Service Worker: Bypassing cache for dynamic API request: ${event.request.url}`);
            event.respondWith(fetch(event.request));
            return; // Exit early, don't try to cache this
        }

        // Network-first strategy for core versioned assets (CSS / JS) so updates propagate immediately
    try {
            const url = new URL(event.request.url);
            const isSameOrigin = url.origin === self.location.origin;
            const isCoreAsset = isSameOrigin && (url.pathname.endsWith('/style.css') || url.pathname.endsWith('/script.js'));
            if (isCoreAsset) {
                event.respondWith(
                    fetch(event.request)
                        .then(resp => {
                            // On success, update cache copy asynchronously
                            if (resp && resp.status === 200) {
                                const clone = resp.clone();
                                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
                            }
                            return resp;
                        })
                        .catch(() => safeMatchOrFallback(event.request)) // Fallback to cached or offline
                );
                return; // Prevent falling through to cache-first path
            }
        } catch(_e) { /* noop */ }

    // Helper to safely return a cached response or a harmless offline Response
    async function safeMatchOrFallback(request) {
        try {
            const match = await caches.match(request);
            if (match) return match;
            const root = await caches.match('./');
            if (root) return root;
        } catch (e) {
            // ignore
        }
        return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/plain' } });
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
                    // Only log as an error for same-origin/core app assets to avoid noisy CDN timeout logs
                    if (!isCrossOrigin) console.error(`Service Worker: Network fetch failed for ${event.request.url}. Returning offline fallback if available.`, error);
                    // If network fails, try to return a cached response as a fallback
                    return safeMatchOrFallback(event.request);
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

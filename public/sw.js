const CACHE_NAME = 'syrian-zone-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/assets/logo-darkmode.svg',
    '/assets/logo-lightmode.svg',
    '/assets/favicon.png',
];

// Install Event - Pre-cache minimal core shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network-first strategy with cache fallback
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept local GET requests, excluding API and admin routes
    if (
        event.request.method !== 'GET' ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/transit/api/') ||
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/transit/admin')
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Save clone of fresh response to cache
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(async () => {
                // Fallback to cache if network fails, or return error response
                const cachedResponse = await caches.match(event.request);
                return cachedResponse || Response.error();
            })
    );
});
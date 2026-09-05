const CACHE_NAME = 'syrian-zone-cache-v2';
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

// Fetch Event - Network-first for top-level document navigations only.
// Inertia XHR visits, API calls, and asset/subresource fetches are left alone:
// caching an Inertia JSON payload under a page URL would poison the cache and
// serve raw JSON on the next visit, and Response.error() fallbacks surface as
// "network error response" console errors for navigations like /transit/city/*.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle same-origin GET document navigations (not XHR/fetch/assets)
    if (
        event.request.method !== 'GET' ||
        event.request.mode !== 'navigate' ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/transit/api/') ||
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/transit/admin') ||
        url.pathname.startsWith('/build/') ||
        event.request.headers.get('X-Inertia') ||
        event.request.headers.get('X-Requested-With')
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
                // Offline: serve the cached page, falling back to the app shell.
                // Never return Response.error() — it surfaces as a FetchEvent
                // "network error response" for the navigation.
                return (await caches.match(event.request)) || (await caches.match('/')) || undefined;
            })
    );
});
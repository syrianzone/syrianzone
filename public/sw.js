const CACHE_NAME = 'syrian-zone-cache-v3';
const RUNTIME_CACHE = 'syrian-zone-runtime-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/muslim',
    '/assets/logo-darkmode.svg',
    '/assets/logo-lightmode.svg',
    '/assets/favicon.png',
    '/quran-data/hafs-16/manifest.json',
    '/quran-data/hafs-24/manifest.json',
];

// Install Event - Pre-cache minimal core shell (missing files never fail install)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                ASSETS_TO_CACHE.map((url) =>
                    cache.add(url).catch(() => undefined),
                ),
            );
        }),
    );
    self.skipWaiting();
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
                        return caches.delete(key);
                    }
                }),
            );
        }),
    );
    self.clients.claim();
});

// Runtime strategies for the Muslim Corner (offline-first reading):
// - same-origin /quran-data/* + /fonts/* : cache-first (immutable shards/fonts)
// - same-origin /api/prayer-times (GET) : stale-while-revalidate, 1 entry per
//   URL kept implicitly by Cache Storage (day-keyed upstream, tiny payloads)
// - cross-origin everyayah mp3 : cache-first on demand (current Page only;
//   the app never precaches audio)
function runtimeCacheFirst(request) {
    return caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then(
            (hit) =>
                hit ||
                fetch(request).then((response) => {
                    if (response && (response.status === 200 || response.type === 'opaque')) {
                        cache.put(request, response.clone()).catch(() => undefined);
                    }
                    return response;
                }),
        ),
    );
}

function runtimeStaleWhileRevalidate(request) {
    return caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((hit) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && (response.status === 200 || response.type === 'opaque')) {
                        cache.put(request, response.clone()).catch(() => undefined);
                    }
                    return response;
                })
                .catch(() => hit);
            return hit || network;
        }),
    );
}

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
        // Runtime-cache the same-origin GETs the navigation guard skips:
        // Quran shards, fonts and prayer-times stay readable offline.
        if (event.request.method === 'GET' && url.origin === self.location.origin) {
            if (url.pathname.startsWith('/quran-data/') || url.pathname.startsWith('/fonts/')) {
                event.respondWith(runtimeCacheFirst(event.request));
                return;
            }
            if (url.pathname === '/api/prayer-times' || url.pathname === '/api/v1/quran-bookmarks') {
                event.respondWith(runtimeStaleWhileRevalidate(event.request));
                return;
            }
        }
        // Cross-origin recitation audio, cached on demand.
        if (event.request.method === 'GET' && url.origin === 'https://everyayah.com') {
            event.respondWith(runtimeCacheFirst(event.request));
            return;
        }
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
                // /muslim is precached, so the reader shell survives offline;
                // its Juz shards + last timings come from the runtime cache.
                if (url.pathname.startsWith('/muslim')) {
                    return (
                        (await caches.match(event.request)) ||
                        (await caches.match('/muslim')) ||
                        (await caches.match('/')) ||
                        undefined
                    );
                }
                return (await caches.match(event.request)) || (await caches.match('/')) || undefined;
            })
    );
});

// The service worker's path lists are asserted by
// tests/Feature/Pwa/ServiceWorkerTest.php, which parses the literals below and
// fails if one stops matching a registered route (or a file in public/), or if a
// signed-in route is not covered by the no-cache list. Keep the path literals
// inside these constants so the test can read them.
const CACHE_NAME = 'syrian-zone-cache-v4';
const RUNTIME_CACHE = 'syrian-zone-runtime-v4';

// Public pages precached so an offline visit still opens the shell.
const PRECACHE_PAGES = [
    '/',
    '/muslim',
    '/transit',
    '/phonebook',
    '/crossings',
    '/games',
    '/roznama',
];

// Static files precached with them.
const PRECACHE_ASSETS = [
    '/assets/logo-darkmode.svg',
    '/assets/logo-lightmode.svg',
    '/assets/favicon.png',
    '/flag-replacer/1f1f8-1f1fe.svg',
    '/quran-data/hafs-16/manifest.json',
    '/quran-data/hafs-24/manifest.json',
];

const ASSETS_TO_CACHE = [...PRECACHE_PAGES, ...PRECACHE_ASSETS];

// Immutable static prefixes (content-hashed Vite assets, fonts, Quran shards, icons)
const IMMUTABLE_PATH_PREFIXES = [
    '/build/assets/',
    '/quran-data/',
    '/fonts/',
    '/assets/',
    '/icons/',
    '/syid-assets/',
    '/flag-replacer/',
    '/data/',
];

// Public GET API endpoints that should work offline with stale-while-revalidate
const OFFLINE_API_PATHS = [
    '/api/prayer-times',
    '/api/v1/quran-bookmarks',
    '/api/weather',
    '/api/events/today',
    '/api/recipe-of-the-day',
    '/api/feed',
    // what the web client actually requests (Board/_lib/sources.ts,
    // Transit/admin + Components/GlobalSearch), not only the canonical mounts
    '/api/v1/cities',
    '/api/v1/global-search',
    '/api/v1/places',
    '/api/v1/places/map',
    '/api/v1/hotels/map',
];

// Generated bundle files the client reads, cached the same way.
const OFFLINE_BUILD_PATHS = ['/build/manifest.json'];

// Transit city routes & GeoJSON map data (/api/v1/cities/{id}/routes | map-data)
const OFFLINE_API_PATTERNS = [/^\/api\/v1\/cities\/[^/]+\/(routes|map-data)$/];

// Signed-in and admin areas, never cached.
const NO_CACHE_PREFIXES = [
    '/admin',
    '/superadmin',
    '/transit/admin',
    '/api/v1/admin',
    '/auth/',
    '/user',
    '/mcp',
    '/dashboard',
];

// A section's landing page, served when an offline visit cannot reach the
// exact page it asked for.
const SECTION_SHELLS = [
    { prefix: '/muslim', shell: '/muslim' },
    { prefix: '/transit', shell: '/transit' },
    { prefix: '/games', shell: '/games' },
];

function isOfflineReadableApi(pathname) {
    if (OFFLINE_API_PATHS.includes(pathname) || OFFLINE_BUILD_PATHS.includes(pathname)) {
        return true;
    }

    return OFFLINE_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isSensitiveOrAdminPath(pathname) {
    return NO_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

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

function runtimeNetworkFirst(request, cacheName = RUNTIME_CACHE) {
    return caches.open(cacheName).then((cache) =>
        fetch(request)
            .then((response) => {
                if (response && response.status === 200) {
                    cache.put(request, response.clone()).catch(() => undefined);
                }
                return response;
            })
            .catch(() => cache.match(request)),
    );
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Cross-origin recitation audio, cached on demand.
    if (url.origin === 'https://everyayah.com') {
        event.respondWith(runtimeCacheFirst(event.request));
        return;
    }

    if (url.origin !== self.location.origin) return;
    if (isSensitiveOrAdminPath(url.pathname)) return;

    // 1. Immutable static assets & Vite hashed bundles: Cache-First
    if (IMMUTABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
        event.respondWith(runtimeCacheFirst(event.request));
        return;
    }

    // 2. Offline-readable GET APIs (Prayer times, Transit city routes/map, Places, Weather): Stale-While-Revalidate
    if (isOfflineReadableApi(url.pathname)) {
        event.respondWith(runtimeStaleWhileRevalidate(event.request));
        return;
    }

    // 3. Inertia XHR SPA navigations on public pages: Network-First with runtime cache fallback
    if (event.request.headers.get('X-Inertia')) {
        if (!url.pathname.startsWith('/api/')) {
            event.respondWith(runtimeNetworkFirst(event.request));
        }
        return;
    }

    // Skip other XHR/API fetches
    if (
        event.request.mode !== 'navigate' ||
        url.pathname.startsWith('/api/') ||
        event.request.headers.get('X-Requested-With')
    ) {
        return;
    }

    // 4. Document navigations: Network-First with section-aware shell fallback
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(async () => {
                const exact = await caches.match(event.request);
                if (exact) return exact;

                for (const { prefix, shell } of SECTION_SHELLS) {
                    if (url.pathname.startsWith(prefix)) {
                        return (await caches.match(shell)) || (await caches.match('/')) || undefined;
                    }
                }
                return (await caches.match('/')) || undefined;
            }),
    );
});

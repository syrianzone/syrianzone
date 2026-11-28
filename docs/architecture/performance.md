# Performance Architecture

Key build-time, delivery, and runtime optimizations that keep initial loads and long directories fast on mobile and low-bandwidth connections.

---

## 1. Vite 8 / Rolldown Chunk Splitting

`vite.config.js` configures Rolldown `codeSplitting.groups` for the client bundle (SSR builds externalize dependencies instead):

| Chunk | Packages | Priority | Purpose |
|---|---|---|---|
| `vendor-react` | `react`, `react-dom`, `scheduler` | 40 | Long-lived cache across app deploys |
| `vendor-inertia` | `@inertiajs/*`, `axios` | 35 | Shared navigation runtime |
| `vendor-maplibre` | `maplibre-gl` | 20 | Isolated heavy mapping engine (loaded only on map routes) |
| `vendor-leaflet` | `leaflet`, `react-leaflet` | 20 | Isolated Leaflet runtime (loaded only on Leaflet routes) |

Page modules are resolved through `resources/js/Lib/pages.ts`, keeping heavy feature bundles deferred until navigated to. Source maps are generated as `hidden` only in CI (`SENTRY_AUTH_TOKEN` present), uploaded to Sentry, and deleted from `public/build/**/*.map` before packaging.

---

## 2. Docker Brotli-11 & Gzip-9 Precompression

Static JS, CSS, and SVG bundles are precompressed at image build time so Nginx spends zero runtime CPU on compression:

- **Build step (`Dockerfile` Stage 1)**: after `bun run build`, `bun scripts/precompress-assets.mjs` compresses every `.js`, `.css`, and `.svg` file ≥ 1 KB in `public/build/assets/` into `.br` (Brotli quality 11, text mode) and `.gz` (Gzip level 9) sidecar files whenever the compressed output is smaller than raw.
- **Serving (`docker/server-opts.d/assets-compression.conf`)**: Nginx serves `.br` via internal rewrite locations when `Accept-Encoding` includes `br` and the `.br` sidecar exists, falling back to `gzip_static on` (`.gz`), and attaches `Cache-Control: public, max-age=31536000, immutable` + `Vary: Accept-Encoding`. Works behind Cloudflare and direct-to-origin.

---

## 3. Progressive List Rendering (`useProgressiveList`)

Large client-filtered directories (officials, ministries, phonebook, promises, wildlife, etc.) avoid rendering hundreds of DOM nodes on initial paint/SSR:

- `resources/js/Lib/useProgressiveList.ts` renders an initial slice (default `initial = 30`), keeps full-array filtering in memory, resets cleanly when `resetKey` (search/filter state) changes, and appends `step = 30` items automatically via `IntersectionObserver` (`rootMargin: '600px 0px'`).
- `resources/js/Components/directory/ProgressiveListFooter.tsx` pairs with the hook to render the sentinel and an accessible fallback "Show more" button for environments without `IntersectionObserver` or keyboard users.

---

## 4. Font Subsetting & CLS Prevention

- **Two weights + two subsets**: `IBM Plex Sans Arabic` ships only 400 and 700 weights (mapped to `400 500` and `600 700`), and both `IBM Plex Sans Arabic` and `Beiruti` split core Arabic/Latin ranges from extended symbols (`-ext.woff2`) via CSS `unicode-range`.
- **Preload & fallback metrics**: `Beiruti-VariableFont_wght.woff2` is preloaded in `resources/views/app.blade.php`, and `IBM Plex Sans Arabic Fallback` sets exact `ascent-override: 108.5%`, `descent-override: 41.5%`, `line-gap-override: 0%` so font swap causes zero vertical layout shift.

---

## 5. Media & Ramadan Thumbnails

- **Ramadan gallery thumbnails**: `Pages/Muslim/Ramadan/Index.tsx` renders lightweight thumbnails from `/images/ramadan/thumbs/` (derived from the manifest in `resources/data/ramadan-images.json`, populated by `scripts/fetch-ramadan-images.py`) in the grid, loading full-resolution images only on inspection/download.
- **User-uploaded photos (Mishwar)**: `PlaceImageService` encodes uploads to WebP (`400×400` thumb q75, `≤1600px` display q80) stored on Cloudflare R2 (`MEDIA_DISK=r2`).
- **SSR + OPcache**: PHP OPcache is enabled in production (`PHP_OPCACHE_ENABLE=1`), and the `inertia-ssr` s6 service renders initial HTML server-side so visitors see content immediately before hydration.

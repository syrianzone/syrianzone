# Muslim Corner (قُرّة)

The `/muslim` module provides an integrated suite of Islamic civic/lifestyle tools. It encompasses the **Roznama (Prayer Times / Hijri Calendar)** and the **Quran Reader / Audio Player**.

This module is completely statically built out for speed and entirely offline-capable via the PWA service worker.

---

## 1. Sub-Modules

### 1.1 Quran Reader (`/muslim?tab=quran`)
A hyper-optimized complete Quran reading and listening client.
- **Unified Payload Architecture**: The entire text structure (Ayahs, Suras, Parts, Page definitions) is heavily compressed into a single 290KB JSON payload (`public/quran-data/mushaf-unified.json`).
- **Main-Thread Yielding**: The JSON is dehydrated to CPU memory sequentially using `yieldToMain()` chunking, bypassing `requestIdleCallback` to guarantee immediate UI rendering while strictly avoiding main-thread freezes.
- **Audio Auto-Play / Auto-Flip**: Audio natively pre-fetches up to 10 incoming Ayahs via opaque network caching bounds, allowing gapless seamless playback while tracking the physical page numbers and auto-flipping the view instantly when it reaches page boundaries.
- **Uthmanic Display**: Native browser typography rendering via `quran-hafs.woff2`.

### 1.2 Roznama (`/muslim?tab=roznama`)
A consolidated daily dashboard combining timing and locale.
- **Prayer Times**: Location-based adhan calculation (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha).
- **Syrian Civic Calendar**: Native rendering using `syrian-date.ts`, blending Hijri and Syrian naming conventions seamlessly contextually.

---

## 2. API Endpoints
All functionality is heavily front-end and statically bundled; minimal dynamic backend required.

## 3. Storage Assets
- **Quran Payload**: `/public/quran-data/mushaf-unified.json`
- **Uthmanic Font**: `/public/fonts/quran/`

## 4. Data Sources & Credits
- **Quran text & Madina layout**: King Fahd Glorious Quran Printing Complex (KFGQPC), vendored under `public/quran-data/`.
- **Uthmanic font**: KFGQPC HAFS Uthmanic Script, vendored as `public/fonts/quran-hafs.woff2` for offline use.
- **Ayah marker ornament**: `quranpedia/ayah-markers` (`015-regular`, DigitalKhatt family) — see `AyahMarker` ATTRIBUTION.md for the upstream license caveat.
- **Recitation audio**: EveryAyah (`https://everyayah.com/data/{folder}/{SSSAAA}.mp3`), streamed per ayah (excluded from the offline cache).
- **Prayer times**: Aladhan timings API via the server proxy (`GET /api/prayer-times`), cached per day.
- **Weather**: Open-Meteo + OpenWeatherMap via the server proxy (`GET /api/weather`), cached 15 min.
- **Approximate geolocation**: `ipwho.is` (see `_lib/location.ts` for the GPS → IP → manual fallback order).

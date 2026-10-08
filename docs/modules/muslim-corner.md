# Muslim Corner (قُرّة)

The `/muslim` module provides an integrated suite of Islamic civic/lifestyle tools. It encompasses the **Roznama (Prayer Times / Hijri Calendar)** and the **Quran Reader / Audio Player**.

This module is completely statically built out for speed and entirely offline-capable via the PWA service worker.

---

## 1. Sub-Modules

### 1.1 Quran Reader (`/muslim?tab=quran`)
A hyper-optimized complete Quran reading and listening client.
- **Unified Payload Architecture**: The entire text structure (Ayahs, Surahs, Parts, Page definitions) is heavily compressed into a single 290KB JSON payload (`public/quran-data/mushaf-unified.json`).
- **Main-Thread Yielding**: The JSON is dehydrated to CPU memory sequentially using `yieldToMain()` chunking, bypassing `requestIdleCallback` to guarantee immediate UI rendering while strictly avoiding main-thread freezes.
- **Per-Surah Audio (MP3Quran v4)**: playback streams one file per surah and seeks to each Ayah's `start_ms` from the v4 ayah timings, so moving between Ayahs of one surah is a gapless in-file seek. Quality tiers are picked automatically (Opus → MP3-64 → source), the next surah is prefetched, and per-Ayah EveryAyah files remain as a fallback when a recitation/surah has no v4 timings.
- **Karaoke Highlight**: the word sounding now is highlighted (v4 word timings, aligned to the local Madina words by normalised matching), and the active word fills letter by letter from the v4 letter timings (`الحرف k/n`), with auto page-flip at the end of the visible Ayahs.
- **Reciter Catalogue (v4)**: recitations are selected by their permanent v4 code (`reciter/rN`); stored preferences are migrated from the old app ids/EveryAyah folders. The radio list is `/v4/radios`, filtered to the recitation categories.
- **Audio Auto-Play / Auto-Flip**: reaching the last Ayah on the page flips to the next page and continues playback.
- **Uthmanic Display**: Native browser typography rendering via `quran-hafs.woff2`.
- **Fixed 25px Font**: The Mushaf page is always rendered at 25px — the size that keeps the Madina layout proportions (line width, stretch factors) correct. No user font-size control.
- **Fill-Viewport Scaling**: `MushafPage` uniformly scales each page (up or down) until either the slot width or the viewport height limit is hit, on both mobile single-page and desktop double-page spreads. Fitting is done purely by the `scale()` transform (never by squeezing the fixed-width layout), and the page stays centered via a flex wrapper with `items-start` so height measurement is never corrupted.
- **Focus Mode**: `quranFocus` in the Muslim nav store (`_lib/nav.ts`) hides the navbar (`Navbar` returns `null` on `/muslim`) and all reader chrome, giving the reclaimed space to the viewport so the text enlarges. `Index.tsx` drops the navbar-height offset to `0` in focus mode.

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
- **ayah mark ornament**: `quranpedia/ayah-marks` (`015-regular`, DigitalKhatt family) — see `AyahMark` ATTRIBUTION.md for the upstream license caveat.
- **Recitation audio**: MP3Quran v4 (`https://api-staging.mp3quran.net/v4`, base set by `VITE_MP3QURAN_API`), streamed per surah from `cdn.mp3quran.net` with ayah/word/letter timings (excluded from the offline cache). EveryAyah per-Ayah files remain as a fallback.
- **Quran radio**: MP3Quran v4 `/v4/radios`, filtered to the `القراء` and `القراءات العشر` categories.
- **Prayer times**: Aladhan timings API via the server proxy (`GET /api/prayer-times`), cached per day.
- **Weather**: Open-Meteo + OpenWeatherMap via the server proxy (`GET /api/weather`), cached 15 min.
- **Approximate geolocation**: `ipwho.is` (see `_lib/location.ts` for the GPS → IP → manual fallback order).

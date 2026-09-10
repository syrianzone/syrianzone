# Settings Sync: Implementation Spec

## 1. THESIS

Preferences in this app live in two places: **device storage** (`localStorage`, works for guests and offline) and the **account** (`users.settings` JSON, plus the `quran_bookmarks` table). Guests accumulate device state; on login that state must reach the account without silently destroying either side.

Rules, in order:

1. **Server empty + device set → push device value silently.**
2. **Device empty + server set → pull server value silently.**
3. **Both set + equal → nothing.**
4. **Both set + differ → explicit-choice modal** (4 curated keys only, §3).
5. **Append-ish data merges silently, never modals** (§4).

The engine is `resources/js/Pages/Muslim/_lib/settingsSync.ts`. It runs once per session per user from `SettingsSync.tsx` (mounted once inside `MainLayout`'s `AuthProvider`), guarded by `sessionStorage['sz-sync-v1-<userId>']`. It never blocks rendering; every network call is best-effort.

## 2. KEY INVENTORY (normative)

Conflict-tracked scalars (modal on divergence):

| Key | Label (AR) | Device source | Account source |
|---|---|---|---|
| `governorate` | المدينة (الرئيسية والروزنامة) | `localStorage['governorate']` (fallback `sz-roznama-governorate`) | `settings.governorate` |
| `muslimCity` | مدينة المواقيت | `localStorage['sz-muslim-city']` | `settings.muslimCity` |
| `muslimMethod` | طريقة حساب المواقيت | `localStorage['sz-muslim-method']` | `settings.muslimMethod` |
| custom group | الإحداثيات المخصصة للمواقيت | `sz-muslim-use-custom` + `sz-muslim-lat/lon` | `settings.muslimUseCustomCoords/muslimLat/muslimLon` |

Silently merged (never modal):

| Data | Rule | Notes |
|---|---|---|
| `prayerLog` | OR-union per day per prayer, pruned to 31 days | Unchecking on one device can be resurrected by another device's `true`. Accepted: checkmarks are monotonic in practice. |
| `quranLastPage` | Newer `quranPageAt` timestamp wins | `sz-muslim-quran-at` (ms) vs `settings.quranPageAt` (unix seconds). Stamped on every page turn. |
| `quran_bookmarks` | Union push to server, leftovers stay on device | Guest list capped at 50 (`sz-muslim-quran-local`); server capped at 200. Sequential POSTs stay under the 60/min throttle. |

Deliberately device-local (never synced, never modal): GPS/IP `locMode` + resolved `geo` point — a phone and a laptop are rarely in one place.

Deliberately untouched by sync: `theme`, `fontFamily`, `language`, `clockFormat`, toggles, links. They keep their existing server-wins-on-mount behavior.

## 3. CONFLICT MODAL

`SettingsConflictModal.tsx`: one card per conflicting key, two options each — «هذا الجهاز: X» vs «الحساب: Y» with human-readable values (governorate Arabic names, method Arabic names). Apply requires an explicit choice per key (no defaults); winners are written to **both** sides plus one batched `POST /api/user/settings`, so the next login is quiet. Closing via X snoozes for the session without writing anything (asks again next session).

Stale/unknown values (city slugs or method IDs outside the allowlists) count as **absent**: the other side wins silently instead of surfacing a meaningless choice. Non-finite coordinates are dropped before any batch so one bad value can never fail the whole batch (the endpoint 422s the entire payload otherwise).

## 4. WRITE-THROUGH DISCIPLINE (load-bearing)

Mount-time code must **never overwrite an existing device key with the server value** for conflict-tracked keys — that would destroy the logged-out side before sync compares. Rule: set-if-absent only.

- `Home.tsx`: `governorate` is set-if-absent; all other keys keep server-wins.
- `Roznama/Index.tsx`: `governorate` + `sz-roznama-governorate` set-if-absent; user edits write both device keys immediately and `settings.governorate` debounced (600ms, logged-in only).
- `Muslim/_lib/prefs.ts`: device-first base, server overlaid in memory only; user edits write through (city fan-out to both legacy keys preserved).

## 5. LABELS FOLLOW THE EFFECTIVE LOCATION

`Roznama/Index.tsx` computes `placeLabel`: the resolved GPS/IP label while a device location is active (with a «موقع تلقائي» badge), else the governorate Arabic name. Weather badge and prayer header both render `placeLabel` — never a stale city while auto-location drives the numbers.

## 6. ENDPOINT CONTRACTS

- `POST /api/user/settings { settings: {...} }` — throttled `60,1`; whitelisted keys only (see `routes/web.php`); merges into `users.settings`; rejects >40KB merged and `prayerLog` >31 days. Covered by `tests/Feature/UserSettingsTest.php`.
- `GET/POST/DELETE /api/v1/quran-bookmarks` — session + CSRF, throttled `60,1`. Covered by `tests/Feature/QuranBookmarkTest.php`.

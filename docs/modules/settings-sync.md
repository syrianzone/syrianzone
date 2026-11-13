# Settings Sync: Implementation Spec

## 1. THESIS

Preferences in this app live in two places: **device storage** (`localStorage`, works for guests and offline) and the **account** (`users.settings` JSON, plus the `quran_bookmarks` table). Guests accumulate device state; on login that state must reach the account without silently destroying either side.

Rules, in order:

1. **Server empty + device set → push device value silently.**
2. **Device empty + server set → pull server value silently.**
3. **Both set + equal → nothing.**
4. **Both set + differ → explicit-choice modal** (4 curated keys only, §3).
5. **Append-ish data merges silently, never modals** (§4).

The engine is `resources/js/Domain/settings/settingsSync.ts`. It runs once per session per user from `Domain/settings/SettingsSync.tsx` (mounted once inside `MainLayout`'s `AuthProvider`), guarded by `sessionStorage['sz-sync-v1-<userId>']`. It never blocks rendering; every network call is best-effort.

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

Deliberately untouched by sync: `theme`, `fontFamily`, `clockFormat`, toggles, links, `eventsGovernorate` (homepage events city — server-wins on mount like the other display prefs). They keep their existing server-wins-on-mount behavior. The `settings.language` whitelist is vestigial (the bilingual pages are gone) and nothing reads it.

## 3. CONFLICT MODAL

`SettingsConflictModal.tsx`: one card per conflicting key, two options each — «هذا الجهاز: X» vs «الحساب: Y» with human-readable values (governorate Arabic names, method Arabic names). Apply requires an explicit choice per key (no defaults); winners are written to **both** sides plus one batched `POST /api/user/settings`, so the next login is quiet. Closing via X snoozes for the session without writing anything (asks again next session).

Stale/unknown values (city slugs or method IDs outside the allowlists) count as **absent**: the other side wins silently instead of surfacing a meaningless choice. Non-finite coordinates are dropped before any batch so one bad value can never fail the whole batch (the endpoint 422s the entire payload otherwise).

## 4. WRITE-THROUGH DISCIPLINE (load-bearing)

**`resources/js/Domain/location/preference.ts` is the only reader and writer of the
location keys.** Home (`governorate`, `useCustomCoords`, `customLat`, `customLon`),
Roznama, `/muslim` (`sz-muslim-city`, `sz-muslim-use-custom`, `sz-muslim-lat/lon`),
the board widgets and this sync engine all go through it; no surface keeps its own
copy of a key name or a write path.

- `readLocationPreference()` / `useLocationPreference()` — the reactive read. One
  store, so an edit on Home updates Roznama, `/muslim` and the board widgets
  without a reload (and after the sync pulls a value).
- `updateLocationPreference(patch)` — writes the device keys and notifies them.
- `adoptAccountLocation(...)` — the mount-time seed (rule below), implemented once
  and called from `runLoginSync` only.
- `readDeviceCity('prayer' | 'display')`, `writeDeviceCity(...)`,
  `readDeviceCustomCoords()`, `writeDeviceCustomCoords(...)` — the per-family
  accessors this engine compares and pulls with.

**Two key families hold the same fact.** The *prayer family*
(`sz-muslim-city`, `sz-muslim-use-custom`, `sz-muslim-lat`, `sz-muslim-lon`) is
canonical, because it is the conflict-tracked one (`muslimCity`, `customLoc`); the
*display family* (`governorate`, `sz-roznama-governorate`, `useCustomCoords`,
`customLat`, `customLon`) is the older mirror Home and Roznama used to read alone.
Read precedence, implemented and pinned by
`Domain/location/preference.test.ts`:

1. city: `sz-muslim-city` → `governorate` → `sz-roznama-governorate` → `damascus`;
2. custom group: `sz-muslim-use-custom/lat/lon` → `useCustomCoords/customLat/customLon`;
3. an unknown city slug counts as absent (the other side wins, §3).

Every write lands in both families, so the surfaces and this engine keep seeing
one value. Stored key names and value shapes are unchanged.

**Mount-time seeding never overwrites.** `adoptAccountLocation()` fills device keys
that do **not** exist from the account and leaves a present one alone — otherwise
it would destroy the logged-out side before §3 compares them. This applies to the
city and to the custom-coordinate group alike (Home used to overwrite the latter
unconditionally). `runLoginSync` (`Domain/settings/settingsSync.ts`) is its **only
caller**: the login sync is the one place that adopts the account location onto
the device. Home and Roznama no longer copy `props.auth.user.settings` on mount —
they read and write the shared preference store — so no page mount can race the
sync over the same keys.

Account writes are unchanged and still belong to the surfaces:
Home debounces `governorate/useCustomCoords/customLat/customLon` at 500 ms,
Roznama at 600 ms, and `Domain/settings/prefs.ts` posts
`muslimCity/muslimMethod/muslimUseCustomCoords/muslimLat/muslimLon` at 600 ms. The
three prayer-settings surfaces render one component
(`Domain/prayer/PrayerSettingsFields`) and mirror its `onLocationChange` patch to
their own account call.

## 5. LABELS FOLLOW THE EFFECTIVE LOCATION

`resolvePlaceLabel()` in `Domain/location/preference.ts` is the one rule: the
resolved GPS/IP label while a device location is active (Roznama adds a «موقع
تلقائي» badge), else «إحداثيات مخصصة» for manual coordinates, else the governorate
Arabic name. Weather badge and prayer header both render it — never a stale city
while auto-location drives the numbers.

## 6. ENDPOINT CONTRACTS

- `POST /api/user/settings { settings: {...} }` — throttled `60,1`; whitelisted keys only (see `routes/web.php`); merges into `users.settings`; rejects >40KB merged and `prayerLog` >31 days. Covered by `tests/Feature/UserSettingsTest.php`.
- `GET/POST/DELETE /api/v1/quran-bookmarks` — session + CSRF, throttled `60,1`. Covered by `tests/Feature/QuranBookmarkTest.php`.

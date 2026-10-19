# Syrian Zone — Central API Reference (`/api/v1`)

This document is the single canonical reference for all JSON API endpoints in **Syrian Zone** ([syrian.zone](https://syrian.zone)), covering public read/write APIs, search endpoints, authenticated user APIs, and capability-gated admin APIs.

---

## 1. Conventions, Headers, Rate Limiting & Error Contract

### Base URL & Versioning
- **Canonical Base URL**: `https://syrian.zone/api/v1`
- All canonical endpoints are versioned under `/api/v1/*` and have named Laravel routes (`api.v1.*`).
- Legacy unversioned (`/api/*`) and un-nested (`/api/v1/cities`, `/api/v1/search`, `/api/v1/global-search`, `/api/v1/geo/poi`, etc.) endpoints remain active as backwards-compatible aliases (see [§10 Legacy & Alias Map](#10-legacy--deprecated-endpoint-aliases)).

### Required Headers
Always send:
```http
Accept: application/json
Content-Type: application/json
```
> [!IMPORTANT]
> Sending `Accept: application/json` is mandatory for mobile and SPA clients. Without it, Laravel treats validation (`422`), authentication (`401`), or not-found (`404`) responses as web browser navigation and may return HTML or a `302` redirect.

### Authentication Modes
1. **Public (`api.php`)**: Stateless, no cookies or CSRF required. Rate-limited per IP.
2. **Authenticated Session (`web.php` + `/api/v1/*`)**: Uses first-party web session cookies + `X-XSRF-TOKEN` (or `X-CSRF-TOKEN`) header.
3. **Agent / MCP Bearer Token (`routes/ai.php` — `/mcp/admin`)**: Uses `Authorization: Bearer <token>` via Sanctum (`auth:sanctum` + `RequireApiToken`). Session cookies are rejected on `/mcp/admin`.

### Standard Error Response Envelope
Every JSON error response (`HTTP >= 400`) returns a standardized JSON object with a top-level `message` string and, on `422` validation failures, a field-keyed `errors` object:

```json
{
  "message": "The lat field is required. (and 1 more error)",
  "errors": {
    "lat": ["The lat field is required."],
    "lng": ["The lng field is required."]
  }
}
```

| HTTP Status | Meaning | Typical Causes |
|---|---|---|
| `400` | Bad Request | Domain rule refusal (e.g., fewer than 3 candidates ranked in a poll ballot, unsupported store in `/api/v1/app-icon`). |
| `401` | Unauthenticated | Missing or expired session / token (`{ "message": "Unauthenticated." }`). |
| `403` | Forbidden | Missing module capability (`polls.edit`, `transit.approve`, etc.), banned user, or protected core resource. |
| `404` | Not Found | Unknown resource ID, slug, or city ID (`{ "message": "City not found." }`). |
| `409` | Conflict | State collision (e.g., duplicate directory slug/ID or soft-deleted gov app ID collision). |
| `413` | Payload Too Large | Uploaded file or settings payload exceeds size cap. |
| `422` | Unprocessable Entity | Validation failure (`errors` bag present) or domain state constraint refusal. |
| `429` | Too Many Requests | Rate limit exceeded. Inspect `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers. |
| `500` / `502` | Server / Upstream Error | Unexpected server error or upstream data source failure. |

- **Backwards-compatible `error` key**: Endpoints that historically returned `{ "error": "..." }` return both `message` and `error` with identical text. Central exception rendering in `bootstrap/app.php` guarantees `message` is always present.
- **Web frontend helper**: Use `extractApiErrorMessage(err, fallback)` and `extractApiFieldErrors(err)` from [`resources/js/Lib/apiError.ts`](../../resources/js/Lib/apiError.ts).

---

## 2. Search & Discovery Endpoints

All search endpoints live under `/api/v1` and accept `q` as the primary search query parameter.

| Scope | Canonical Endpoint | Route Name | Legacy Alias | Query Params | Rate Limit |
|---|---|---|---|---|---|
| **Global Search** (Cross-Module) | `GET /api/v1/search/global` | `api.v1.search.global` | `GET /api/v1/global-search` | `q` (`2..80` chars, required) | `60/min` |
| **Transit Search** (Routes & Stops) | `GET /api/v1/transit/search` | `api.v1.transit.search` | `GET /api/v1/search` | `q` (string), `city_id` (optional) | `60/min` |
| **Transit POI Search** (Map POIs) | `GET /api/v1/transit/pois` | `api.v1.transit.pois.index` | `GET /api/v1/geo/poi` | `q` (`3..100` chars, required), `city_id` (optional) | `60/min` |
| **Places Search** (Mishwar) | `GET /api/v1/places` | `api.v1.places.index` | — | `q`, `gov`, `category`, `subcategory`, `tags`, `sort`, `page` | `60/min` |
| **Places Geocode** (Nominatim Proxy) | `GET /api/v1/places/geocode` | `api.v1.places.geocode` | — | `q` (`2..120` chars, required) | `60/min` |

### `GET /api/v1/search/global`
Cross-module search returning up to 5 matches per module across Transit routes, Mishwar places, Phonebook entries, SyOfficial entities, and GovApps.
```json
{
  "routes": [
    { "id": "mezzeh-bab-touma", "name_ar": "المزة - باب توما", "name_en": "Mezzeh - Bab Touma", "city_id": "damascus" }
  ],
  "places": [
    { "id": 42, "title_ar": "قصر العظم", "title_en": "Azm Palace", "governorate": "damascus", "category": "culture" }
  ],
  "phonebook": [
    { "id": "sarc-damascus", "name": "الهلال الأحمر العربي السوري", "phone": "133", "city": "دمشق", "category_id": "emergency" }
  ],
  "officials": [
    { "id": "ministry-of-communications", "name": "وزارة الاتصالات وتقانة المعلومات", "category_id": "ministries" }
  ],
  "govapps": [
    { "id": 1, "name": "وين", "description": "تطبيق البطاقة الذكية" }
  ]
}
```

---

## 3. Transit API (`/api/v1/transit/*`)

Public, unauthenticated read API over published transit data (cities, routes, stops, GeoJSON map layers, and POIs), plus community Transit Studio route draft submissions.

- **Combined Damascus metro network**: `damascus` and `rif-dimashq` are served as one unified network because transit lines cross the boundary. Requesting either ID returns both.
- **Unknown city ID**: Returns `404` `{ "message": "City not found." }` (never a cached empty `200`).
- **Map Vector Tiles**: The Transit map frontend uses MapLibre GL with `/styles/styles/dark-matter-vector.json` and `/styles/styles/light-vector.json`, which load vector tiles from `https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json` (`openmaptiles` schema).

### Transit Endpoints Summary

| Method & Canonical Path | Route Name | Legacy Alias | Auth | Rate Limit | Description |
|---|---|---|---|---|---|
| `GET /api/v1/transit/cities` | `api.v1.transit.cities.index` | `GET /api/v1/cities` | Public | `60/min` | All cities with published route counts, bounds, and SVG governorate icon |
| `GET /api/v1/transit/cities/{id}/routes` | `api.v1.transit.cities.routes.index` | `GET /api/v1/cities/{id}/routes` | Public | `60/min` | Published routes for a city (`stopsCount` is always an integer) |
| `GET /api/v1/transit/cities/{id}/map` | `api.v1.transit.cities.map` | `GET /api/v1/cities/{id}/map-data` | Public | `60/min` | Full GeoJSON `FeatureCollection`s for `routes` (`LineString`) and `stops` (`Point`) |
| `GET /api/v1/transit/cities/{id}/map-data` | `api.v1.transit.cities.map-data` | `GET /api/v1/cities/{id}/map-data` | Public | `60/min` | Alias of `/transit/cities/{id}/map` |
| `GET /api/v1/transit/stops/nearby` | `api.v1.transit.stops.nearby` | `GET /api/v1/stops/nearby` | Public | `60/min` | Stops within `radius` (`1..5000`m, default `500`) of `lat` & `lng` |
| `GET /api/v1/transit/search` | `api.v1.transit.search` | `GET /api/v1/search` | Public | `60/min` | Search routes and stops by `q` and optional `city_id` |
| `GET /api/v1/transit/pois` | `api.v1.transit.pois.index` | `GET /api/v1/geo/poi` | Public | `60/min` | Nearby points of interest (Photon OSM + Google Places fallback, 24h cache) |
| `POST /api/v1/transit/studio/routes` | `api.v1.transit.studio.routes.store` | `POST /api/v1/studio/routes` | Public / Auth | `studio-submit` (`5/min` guest, `60/min` auth) | Submit a new Transit Studio route draft |
| `GET /api/v1/transit/studio/routes/{id}` | `api.v1.transit.studio.routes.show` | `GET /api/v1/studio/routes/{id}` | Auth | `60/min` | Load an existing route draft for editing |
| `PUT\|PATCH /api/v1/transit/studio/routes/{id}` | `api.v1.transit.studio.routes.update` | `PUT /api/v1/studio/routes/{id}` | Auth | `60/min` | Update an existing route draft |
| `DELETE /api/v1/transit/studio/routes/{id}` | `api.v1.transit.studio.routes.destroy` | `DELETE /api/v1/studio/routes/{id}` | Auth | `10/min` | Delete a route draft |
| `GET /api/v1/transit/studio/routes/{id}/from-route` | `api.v1.transit.studio.routes.from-route` | `GET /api/v1/studio/routes/{id}/from-route` | Auth | `60/min` | Load a published route into Studio editor format |

### `GET /api/v1/transit/cities`
Cached for 1 hour (`transit:cities:api`). Coordinates use GeoJSON `[lng, lat]` order:
```json
[
  {
    "id": "damascus",
    "nameAr": "دمشق",
    "nameEn": "Damascus",
    "status": "active",
    "zoom": 12,
    "center": [36.2765, 33.5138],
    "bounds": [[35.8, 33.3], [36.8, 33.7]],
    "routeCount": 4,
    "icon": { "viewBox": "0 0 0.174653 0.124551", "path": "M0.160,0.058 L..." }
  }
]
```

### `GET /api/v1/transit/cities/{id}/routes`
Cached for 10 minutes. Returns published routes for `{id}`:
```json
[
  {
    "id": "mezzeh-bab-touma",
    "cityId": "damascus",
    "nameAr": "المزة - باب توما",
    "nameEn": "Mezzeh - Bab Touma",
    "colorIndex": 1,
    "priceOld": 2000,
    "priceNew": 3000,
    "stopsCount": 10
  }
]
```

### `GET /api/v1/transit/cities/{id}/map` (and `/map-data`)
Cached for 10 minutes (`Cache-Control: public, max-age=600`). Returns two GeoJSON `FeatureCollection` objects:
- `routes`: Each feature has `geometry.type = "LineString"` where `coordinates` is an array of `[lng, lat]` pairs (`[[lng1, lat1], [lng2, lat2], ...]`) tracing the bus/microbus path along the streets.
- `stops`: Each feature has `geometry.type = "Point"` where `coordinates` is a single `[lng, lat]` pair (`[lng, lat]`) marking a bus stop, with `properties.routeIds` listing the published routes serving that stop.

```json
{
  "routes": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": { "type": "LineString", "coordinates": [[36.24, 33.5], [36.25, 33.51]] },
        "properties": {
          "id": "mezzeh-bab-touma",
          "nameAr": "المزة - باب توما",
          "nameEn": "Mezzeh - Bab Touma",
          "colorIndex": 1,
          "color_index": 1,
          "priceOld": 2000,
          "priceNew": 3000
        }
      }
    ]
  },
  "stops": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [36.24, 33.5] },
        "properties": {
          "id": "stop-1",
          "nameAr": "المزة",
          "routeIds": ["mezzeh-bab-touma"]
        }
      }
    ]
  }
}
```

### `GET /api/v1/transit/stops/nearby`
Query parameters: `lat` (required, numeric), `lng` (required, numeric), `radius` (optional, `1..5000` meters, default `500`).
```json
[
  {
    "id": "stop-1",
    "nameAr": "المزة فيلات غربية",
    "cityId": "damascus",
    "coordinates": [36.24, 33.5],
    "routes": [{ "id": "mezzeh-bab-touma", "name_ar": "المزة - باب توما" }]
  }
]
```

### `GET /api/v1/transit/search`
Query parameters: `q` (search text), `city_id` (optional city filter). Empty `q` returns `{ "routes": [], "stops": [] }`.
```json
{
  "routes": [
    { "type": "route", "id": "mezzeh-bab-touma", "nameAr": "المزة - باب توما", "nameEn": "Mezzeh - Bab Touma", "cityId": "damascus" }
  ],
  "stops": [
    { "type": "stop", "id": "stop-1", "nameAr": "المزة", "cityId": "damascus", "coordinates": [36.24, 33.5] }
  ]
}
```

### `GET /api/v1/transit/pois`
Query parameters: `q` (`3..100` chars, required), `city_id` (optional, biases search to city bounds). Backed by Photon (OSM) with automatic Google Places fallback when results are thin; expands common Arabic POI category synonyms (`جامع`/`مسجد`, `مشفى`/`مستشفى`, `صيدلية`, etc.). Cached 24h (`Cache-Control: public, max-age=3600`). Never returns `500` on upstream failure.
```json
{
  "places": [
    {
      "name": "جامع خالد بن الوليد",
      "category": "place_of_worship",
      "lat": 34.7368,
      "lng": 36.7161,
      "district": "الخالدية",
      "city": "حمص",
      "source": "osm"
    }
  ]
}
```

---

## 4. Polls & Tier-List Voting API (`/api/v1/polls/*`)

Public REST API over tier-list polls, leaderboards, daily scores, anonymized ballots, and vote submission.

### Privacy Guarantees
Voter-identifying data is **never** returned by any endpoint:
- `ballots.voter_key`, `ballots.ip_hash`, and `ballots.user_agent` are never selected at the SQL query level.
- `polls.user_id` (poll owner) is never selected and is hidden on `Poll::$hidden`.
- Anonymized ballot reads return only the ballot UUID, `vote_day`, `created_at`, and tier item assignments (`candidate_id`, `tier`, `position`).

### Polls Endpoints Summary

| Method & Canonical Path | Route Name | Legacy Alias | Rate Limit | Description |
|---|---|---|---|---|
| `GET /api/v1/polls` | `api.v1.polls.index` | `GET /api/polls` | `public-api` (`120/min`) | List active polls (`id`, `title`, `slug`, `timezone`, `is_active`, `created_at`) |
| `GET /api/v1/polls/{idOrSlug}` | `api.v1.polls.show` | `GET /api/polls/{idOrSlug}` | `public-api` (`120/min`) | Poll metadata + `groups` + `candidates` |
| `GET /api/v1/polls/{idOrSlug}/candidates` | `api.v1.polls.candidates.index` | — | `public-api` (`120/min`) | Candidates filtered by `?status=active\|archived\|all` (default `all`) |
| `GET /api/v1/polls/{idOrSlug}/scores` | `api.v1.polls.scores.index` | — | `public-api` (`120/min`) | Paginated daily score rows (`?from=YYYY-MM-DD&to=YYYY-MM-DD&candidate_id=&per_page=100..1000`) |
| `GET /api/v1/polls/{idOrSlug}/ballots` | `api.v1.polls.ballots.index` | — | `public-api` (`120/min`) | Paginated anonymized ballots + tier items (`?from=YYYY-MM-DD&to=YYYY-MM-DD&per_page=100..1000`) |
| `GET /api/v1/polls/{idOrSlug}/leaderboard` | `api.v1.polls.leaderboard` | `GET /api/polls/{idOrSlug}/leaderboard` | `public-api` (`120/min`) | Cached (60s + ETag) leaderboard rankings + daily history (`?status=active\|former\|all`) |
| `POST /api/v1/polls/{idOrSlug}/ballots` | `api.v1.polls.ballots.store` | `POST /api/submit` | `voting` (`10/min`) | Submit a tier-list ballot for a poll (minimum 3 candidates ranked) |

The leaderboard payload carries `groups` as `{ id, name, key, rankingKey,
sortOrder, isDefault }`, and each published category's ranking rows live under
its `rankingKey` (e.g. the `minister` category ranks under `ministers`). Only
published categories are listed, so a client renders one tab per `groups` entry
and never has to hardcode category keys. Any change to a category drops the
cached payload for that poll, so a disabled category disappears immediately
rather than after the 60s TTL.

### Submitting a Ballot (`POST /api/v1/polls/{idOrSlug}/ballots`)
```json
{
  "deviceId": "client-generated-uuid-v4",
  "tiers": {
    "S": ["candidate-uuid-1"],
    "A": ["candidate-uuid-2", "candidate-uuid-3"],
    "B": [],
    "C": [],
    "D": [],
    "F": []
  }
}
```
- Note: When calling the legacy `POST /api/submit` or `POST /api/v1/polls/ballots` endpoint without `{idOrSlug}` in the URL, include `"pollSlug": "best-ministers"` in the JSON body.
- Returns `200 OK` `{ "ok": true }` on success, `400` `{ "message": "Minimum selection is 3", "error": "Minimum selection is 3" }` if fewer than 3 candidates are assigned across tiers, or `429` if rate-limited (`10/min` per IP+device).

---

## 5. Hidden Places ("Mishwar") & Hotels API (`/api/v1/places/*`, `/api/v1/hotels/*`)

### Public Read Endpoints (`throttle:60,1`)

| Method & Canonical Path | Route Name | Query / Path Parameters | Description |
|---|---|---|---|
| `GET /api/v1/places` | `api.v1.places.index` | `q`, `gov`, `category`, `subcategory`, `tags`, `sort` (`featured\|newest\|saves`), `page` | Paginated approved places directory |
| `GET /api/v1/places/map` | `api.v1.places.map` | `gov`, `category`, `subcategory`, `tags` | Lightweight pin coordinates & summary properties for the map |
| `GET /api/v1/places/nearby` | `api.v1.places.nearby` | `lat`, `lng`, `radius_km` (`0.5..100`, default `25`), `exclude`, `limit` | Approved places near a coordinate |
| `GET /api/v1/places/geocode` | `api.v1.places.geocode` | `q` (`2..120` chars, required) | Syria-bounded Nominatim geocoding proxy (24h cache) |
| `GET /api/v1/places/photos` | `api.v1.places.photos` | `gov`, `category`, `page` | Approved community photo stream |
| `GET /api/v1/places/{id}` | `api.v1.places.show` | `{id}` (numeric) | Single place details, photos, and save count |
| `GET /api/v1/guides` | `api.v1.guides.index` | `gov` | Curated governorate & thematic guides |
| `GET /api/v1/hotels` | `api.v1.hotels.index` | `city`, `stars`, `q`, `sort` | HalaSyria hotels directory (synced every 2 days) |
| `GET /api/v1/hotels/map` | `api.v1.hotels.map` | `city`, `stars` | Lightweight hotel markers for map view |
| `GET /api/v1/hotels/{id}` | `api.v1.hotels.show` | `{id}` (numeric) | Single hotel details, amenities, and room photos |

### Authenticated Place Owner & Save Endpoints (`auth`, Session + CSRF)

| Method & Canonical Path | Route Name | Rate Limit | Description |
|---|---|---|---|
| `POST /api/v1/places` | `api.v1.places.store` | `60/min` | Submit a new place for moderation (`multipart/form-data` with photos) |
| `GET /api/v1/my/places` | `api.v1.my.places.index` | `60/min` | List current user's submitted places |
| `PATCH /api/v1/my/places/{id}` | `api.v1.my.places.update` | `20/60min` | Update details of own place (re-enters moderation queue) |
| `PATCH /api/v1/my/places/{id}/location` | `api.v1.my.places.location.update` | `20/60min` | Move pin coordinates of own place (re-enters moderation queue) |
| `POST /api/v1/my/places/{id}/photos` | `api.v1.my.places.photos.store` | `20/60min` | Upload additional photo to own place (`max 8` photos per place) |
| `POST /api/v1/my/places/{id}/resubmit` | `api.v1.my.places.resubmit` | `20/60min` | Resubmit a rejected place for moderation |
| `DELETE /api/v1/my/places/{id}` | `api.v1.my.places.destroy` | `20/60min` | Delete own place submission |
| `DELETE /api/v1/my/place-photos/{id}` | `api.v1.my.place-photos.destroy` | `20/60min` | Delete a photo from own place (cannot delete last remaining photo) |
| `POST /api/v1/my/place-photos/{id}/rotate` | `api.v1.my.place-photos.rotate` | `20/60min` | Rotate own place photo (`direction: cw\|ccw`) |
| `GET /api/v1/my/saves` | `api.v1.my.saves.index` | `60/min` | List current user's saved places |
| `POST /api/v1/places/{id}/save` | `api.v1.places.save.store` | `60/min` | Save/bookmark a place |
| `DELETE /api/v1/places/{id}/save` | `api.v1.places.save.destroy` | `60/min` | Remove place from saved list |

---

## 6. Syrian Compass API (`/api/v1/compass/*`)

| Method & Canonical Path | Route Name | Legacy Alias | Auth | Rate Limit | Description |
|---|---|---|---|---|---|
| `GET /api/v1/compass/results` | `api.v1.compass.results.index` | — | Auth | `60/min` | List signed-in user's saved compass results |
| `POST /api/v1/compass/results` | `api.v1.compass.results.store` | — | Auth | `20/min` | Save a compass test result to user account |
| `DELETE /api/v1/compass/results` | `api.v1.compass.results.destroy-all` | — | Auth | `60/min` | Delete all saved compass results for current user |
| `DELETE /api/v1/compass/results/{id}` | `api.v1.compass.results.destroy` | — | Auth | `60/min` | Delete a specific saved compass result |
| `POST /api/v1/compass/shares` | `api.v1.compass.shares.store` | `POST /api/v1/compass/share` | Public | `30/min` | Create an account-independent shareable result card |
| `GET /api/v1/compass/shares/{shareId}` | `api.v1.compass.shares.show` | `GET /api/v1/compass/share/{shareId}` | Public | `30/min` | Fetch a shared compass result by `shareId` |
| `POST /api/v1/compass/stats` | `api.v1.compass.stats.store` | — | Public | `compass-stats` | Submit opt-in anonymous compass statistics |
| `DELETE /api/v1/compass/stats` | `api.v1.compass.stats.destroy` | — | Public | `30/min` | Withdraw anonymous stats entry by token |

---

## 7. Atlas, Contributors, Widgets & Utility Endpoints (`/api/v1/*`)

All endpoints below are public and throttled at `60/min` (except `/api/v1/metrics` at `10/min`).

| Method & Canonical Path | Route Name | Legacy Alias(es) | Description |
|---|---|---|---|
| `GET /api/v1/atlas` | `api.v1.atlas.index` | `GET /api/population/master`, `GET /api/v1/population/master` | Master Population & Rainfall Atlas dataset (1h cache) |
| `GET /api/v1/atlas/environment` | `api.v1.atlas.environment` | `GET /api/population/env-report`, `GET /api/v1/population/env-report` | Environmental, air quality, and drought risk report (1h cache) |
| `GET /api/v1/contributors` | `api.v1.contributors.index` | `GET /api/contributors` | Community contributors leaderboard |
| `GET /api/v1/contributors/{contributor}` | `api.v1.contributors.show` | `GET /api/contributors/{contributor}` | Single contributor profile & approved contributions |
| `GET /api/v1/weather` | `api.v1.weather.show` | `GET /api/weather` | Weather forecast for a governorate or custom `lat`/`lon` |
| `GET /api/v1/prayer-times` | `api.v1.prayer-times.show` | `GET /api/prayer-times` | Daily Islamic prayer times (`city`, `method`, or `lat`/`lon`) |
| `GET /api/v1/events/today` | `api.v1.events.today` | `GET /api/events/today` | Roznama events occurring today |
| `GET /api/v1/recipes/today` | `api.v1.recipes.today` | `GET /api/recipe-of-the-day`, `GET /api/v1/recipe-of-the-day` | Daily Syrian recipe from Syriana (deterministic by date) |
| `GET /api/v1/feed` | `api.v1.feed.show` | `GET /api/feed` | Aggregated news/community feed |
| `GET /api/v1/answers` | `api.v1.answers.index` | `GET /api/answers` | Quick answers / FAQ widget items |
| `GET /api/v1/metrics` | `api.v1.metrics.index` | `GET /api/metrics` | Public platform counters (`10/min`) |
| `GET /api/v1/app-icon` | `api.v1.app-icon.show` | `GET /api/app-icon` | Resolves mobile app icon from Apple App Store (`store=apple&id=`) or Google Play (`store=google&id=`) |

---

## 8. Authenticated User, Board, Muslim Corner & Guess Who APIs (`web.php`)

These endpoints run inside the `web` middleware group (Session + CSRF).

### Account, Settings, Board & Muslim Corner

| Method & Canonical Path | Route Name | Legacy Alias | Auth | Rate Limit | Description |
|---|---|---|---|---|---|
| `GET /api/v1/user` | `api.v1.user.show` | `GET /api/user`, `GET /user` | Auth | — | Current user profile + `effective_permissions` + `transit_governorates` |
| `PATCH\|PUT /api/v1/account` | `api.v1.account.update` | `POST /api/account/update` | Auth | — | Update account `name` and `email` |
| `POST /api/v1/account/avatar` | `api.v1.account.avatar.store` | `POST /api/account/avatar` | Auth | `10/min` | Upload profile avatar (`max 2MB`) |
| `DELETE /api/v1/account` | `api.v1.account.destroy` | `POST /api/account/delete` | Auth | — | Permanently delete user account |
| `PATCH\|PUT\|POST /api/v1/user/settings` | `api.v1.user.settings.update` | `POST /api/user/settings` | Auth | `60/min` | Merge whitelisted user preferences (`theme`, `language`, `governorate`, `customLinks`, etc.) |
| `POST /api/v1/user/radio-usage` | `api.v1.user.radio-usage.store` | `POST /api/user/radio-usage` | Auth | `60/min` | Add Quran radio streaming delta (`bytes`, `seconds`) under row lock |
| `DELETE /api/v1/user/radio-usage` | `api.v1.user.radio-usage.destroy` | `POST /api/user/radio-usage/clear` | Auth | `10/min` | Reset Quran radio usage counters |
| `GET /api/v1/board` | `api.v1.board.show` | — | Auth | `60/min` | Fetch user's synced `/board` widget layout |
| `PUT /api/v1/board` | `api.v1.board.update` | — | Auth | `60/min` | Save user's `/board` widget layout |
| `GET /api/v1/quran-bookmarks` | `api.v1.quran-bookmarks.index` | — | Auth | `60/min` | List user's Quran ayah bookmarks |
| `POST /api/v1/quran-bookmarks` | `api.v1.quran-bookmarks.store` | — | Auth | `60/min` | Create/update a Quran ayah bookmark |
| `DELETE /api/v1/quran-bookmarks/{surah}/{ayah}` | `api.v1.quran-bookmarks.destroy` | — | Auth | `60/min` | Remove a Quran ayah bookmark |

### Multiplayer Guess Who Game (`web.php`)

| Method & Canonical Path | Route Name | Legacy Alias | Rate Limit | Description |
|---|---|---|---|---|
| `POST /api/v1/guesswho/rooms` | `api.v1.guesswho.rooms.store` | `POST /guesswho/rooms` | `10/min` | Create a multiplayer room |
| `POST /api/v1/guesswho/rooms/{roomCode}/join` | `api.v1.guesswho.rooms.join` | `POST /guesswho/room/{roomCode}/join` | `30/min` | Join an existing room |
| `POST /api/v1/guesswho/rooms/{roomCode}/actions` | `api.v1.guesswho.rooms.actions.store` | `POST /guesswho/room/{roomCode}/action` | `120/min` | Submit a game turn action (relayed via Reverb) |
| `GET /api/v1/guesswho/rooms/{roomCode}/state` | `api.v1.guesswho.rooms.state` | `GET /guesswho/room/{roomCode}/state` | `60/min` | Poll/resync room state |
| `POST /api/v1/guesswho/broadcasting/auth` | `api.v1.guesswho.broadcasting.auth` | `POST /guesswho/broadcasting/auth` | `30/min` | Authenticate Reverb presence channel |

---

## 9. Admin & Moderation APIs (`/api/v1/admin/*`)

Every admin endpoint is protected by `auth` and a per-route capability middleware (`<module>_admin:<capability>`) enforced by `ModuleCapabilityGuard` and verified at test time by `ModuleCapabilityRoutesTest`. Only `superadmin` bypasses individual capability checks.

### 9.1 Polls Admin (`polls_admin`)
| Method & Canonical Path | Legacy Alias | Required Capability |
|---|---|---|
| `POST /api/v1/admin/polls` | `POST /api/polls` | `polls.create` |
| `PUT\|PATCH /api/v1/admin/polls/{id}` | `PUT /api/polls/{id}` | `polls.edit` |
| `DELETE /api/v1/admin/polls/{id}` | `DELETE /api/polls/{id}` | `polls.delete` |
| `GET /api/v1/admin/candidate-groups` | `GET /api/candidate-groups` | `any` (`polls.*`) |
| `GET /api/v1/admin/candidate-groups/{id}` | `GET /api/candidate-groups/{id}` | `any` (`polls.*`) |
| `POST /api/v1/admin/candidate-groups` | `POST /api/candidate-groups` | `polls.create` |
| `PUT\|PATCH /api/v1/admin/candidate-groups/{id}` | `PUT\|PATCH /api/candidate-groups/{id}` | `polls.edit` |
| `DELETE /api/v1/admin/candidate-groups/{id}` | `DELETE /api/candidate-groups/{id}` | `polls.delete` |
| `POST /api/v1/admin/candidate-groups/reorder` | `POST /api/candidate-groups/reorder` | `polls.edit` |
| `POST /api/v1/admin/candidate-groups/{id}/default` | `POST /api/candidate-groups/{id}/default` | `polls.edit` |
| `POST /api/v1/admin/candidates` | `POST /api/candidates` | `polls.create` |
| `PUT\|PATCH /api/v1/admin/candidates/{id}` | `PUT\|PATCH /api/candidates/{id}` | `polls.edit` |
| `DELETE /api/v1/admin/candidates/{id}` | `DELETE /api/candidates/{id}` | `polls.delete` |
| `PATCH /api/v1/admin/candidates/{id}/archive` | `PATCH /api/candidates/{id}/archive` | `polls.edit` |
| `PATCH /api/v1/admin/candidates/{id}/restore` | `PATCH /api/candidates/{id}/restore` | `polls.edit` |

`PUT|PATCH /candidate-groups/{id}` also accepts `is_active` (boolean). Setting it
to `false` disables the category without deleting it: the row, its candidates,
images and scores stay, but the category leaves `/tierlist` and `/polls/{slug}`,
its ranks and history drop out of the leaderboard and its X snapshots, and
`/api/submit` rejects ballots naming its candidates. Disabling the default
category clears `is_default`, and a disabled category cannot be set as the
default. `GET /api/polls/{idOrSlug}` returns the full roster (disabled
categories included) only to callers holding `polls.edit` — that is how the
dashboard editor finds a disabled category again; guests get the published
subset. The read-only data API (`/api/v1/polls/*`) stays raw and lists every
group and candidate, including disabled and archived ones.

### 9.2 Places (Mishwar) Admin (`places_admin`)
| Method & Canonical Path | Required Capability |
|---|---|
| `GET /api/v1/admin/places` | `places.review` |
| `POST /api/v1/admin/places/{id}/approve` | `places.approve` |
| `POST /api/v1/admin/places/{id}/reject` | `places.approve` |
| `PATCH /api/v1/admin/places/{id}` | `places.edit` |
| `DELETE /api/v1/admin/places/{id}` | `places.delete` |
| `POST /api/v1/admin/places/{id}/photos` | `places.edit` |
| `POST /api/v1/admin/place-photos/{id}/rotate` | `places.moderate_photos` |
| `POST /api/v1/admin/place-photos/{id}/replace` | `places.moderate_photos` |
| `DELETE /api/v1/admin/place-photos/{id}` | `places.moderate_photos` |

### 9.3 Transit Admin (`transit_admin`, Governorate-Scoped)
| Method & Canonical Path | Legacy Alias | Required Capability |
|---|---|---|
| `GET /api/v1/admin/transit/route-drafts` | `GET /api/v1/admin/route-drafts` | `transit.review_drafts` |
| `POST /api/v1/admin/transit/route-drafts/{id}/approve` | `POST /api/v1/admin/route-drafts/{id}/approve` | `transit.approve` |
| `POST /api/v1/admin/transit/route-drafts/{id}/reject` | `POST /api/v1/admin/route-drafts/{id}/reject` | `transit.reject` |
| `GET /api/v1/admin/transit/routes` | `GET /api/v1/admin/routes` | `transit.review_drafts` |
| `GET /api/v1/admin/transit/routes/logs` | `GET /api/v1/admin/routes/logs` | `transit.review_drafts` |
| `GET /api/v1/admin/transit/routes/{id}/geojson` | `GET /api/v1/admin/routes/{id}/geojson` | `transit.review_drafts` |
| `GET /api/v1/admin/transit/routes/{id}/stops` | `GET /api/v1/admin/routes/{id}/stops` | `transit.review_drafts` |
| `PATCH\|POST /api/v1/admin/transit/routes/{id}/status` | `POST /api/v1/admin/routes/{id}/status` | `transit.edit_routes` |
| `PUT /api/v1/admin/transit/routes/{id}` | `PUT /api/v1/admin/routes/{id}` | `transit.edit_routes` |
| `DELETE /api/v1/admin/transit/routes/{id}` | `DELETE /api/v1/admin/routes/{id}` | `transit.delete_routes` |
| `POST /api/v1/admin/transit/routes/{id}/move` | `POST /api/v1/admin/routes/{id}/move` | `transit.edit_routes` |
| `POST /api/v1/admin/transit/routes/combine` | `POST /api/v1/admin/routes/combine` | `transit.edit_routes` |
| `POST /api/v1/admin/transit/routes/split` | `POST /api/v1/admin/routes/split` | `transit.edit_routes` |
| `POST /api/v1/admin/transit/routes/import-preview` | `POST /api/v1/admin/routes/import-preview` | `transit.review_drafts` (`30/min`) |
| `POST /api/v1/admin/transit/routes/import-publish` | `POST /api/v1/admin/routes/import-publish` | `transit.edit_routes` (`30/min`) |

### 9.4 Directory & Module Admin Panels
- **SyOfficial (`syofficial_admin`, `/api/v1/admin/syofficial/*`)**:
  - `POST /categories` (`syofficial.create`), `PUT /categories/{id}` (`syofficial.edit`), `DELETE /categories/{id}` (`syofficial.delete`), `POST /categories/reorder` (`syofficial.reorder`, alias `/reorder/categories`).
  - `POST /entities` (`syofficial.create`), `PUT|POST /entities/{id}` (`syofficial.edit`), `DELETE /entities/{id}` (`syofficial.delete`), `POST /entities/reorder` (`syofficial.reorder`, alias `/reorder/entities`).
- **GovApps (`govapps_admin`, `/api/v1/admin/govapps/*`)**:
  - `POST /` (`govapps.create`), `PUT|POST /{id}` (`govapps.edit`), `DELETE /{id}` (`govapps.delete`), `POST /reorder` (`govapps.reorder`).
- **Phonebook (`phonebook_admin`, `/api/v1/admin/phonebook/*`)**:
  - `POST /categories` (`phonebook.create`), `PUT /categories/{id}` (`phonebook.edit`), `DELETE /categories/{id}` (`phonebook.delete`), `POST /categories/reorder` (`phonebook.reorder`, alias `/reorder/categories`).
  - `POST /entries` (`phonebook.create`), `PUT|POST /entries/{id}` (`phonebook.edit`), `PATCH|POST /entries/{id}/toggle` (`phonebook.toggle`), `DELETE /entries/{id}` (`phonebook.delete`), `POST /entries/reorder` (`phonebook.reorder`, alias `/reorder/entries`).
- **Compass (`compass_admin`, `/api/v1/admin/compass/*`)**:
  - Figures (`compass.figures`): `GET /figures`, `POST /figures`, `POST /figures/upload-image`, `PUT /figures/{id}`, `DELETE /figures/{id}`, `PATCH|POST /figures/{id}/toggle`.
  - Personas (`compass.personas`): `GET /personas`, `POST /personas`, `PUT /personas/{id}`, `DELETE /personas/{id}`, `PATCH|POST /personas/{id}/toggle`.
- **User Moderation (`users_admin`)**:
  - `PATCH /api/v1/admin/users/{id}/ban` (legacy alias `POST /api/v1/admin/users/{id}/toggle-ban`) — requires `users.ban`.
- **Superadmin (`superadmin`)**:
  - Staff & permissions: `GET|POST /api/v1/admin/admins`, `DELETE /api/v1/admin/admins/{id}` (legacy `/api/admins*`).
  - Asset Storage (Cloudflare R2): `GET /api/v1/admin/assets`, `GET /api/v1/admin/assets/manifest`, `POST /api/v1/admin/assets`, `DELETE /api/v1/admin/assets` (legacy `/api/v1/admin/assets/list|upload|delete`).
  - Site Popup: `GET|PUT /api/v1/admin/site-popup`.
  - Guess Who Roster: `POST|PUT|DELETE /api/v1/admin/guesswho/categories[/{id}]`, `POST|PUT|DELETE /api/v1/admin/guesswho/characters[/{id}]`.
  - Agent API Tokens: `POST /api/v1/admin/api-tokens`, `DELETE /api/v1/admin/api-tokens/{id}`, `DELETE /api/v1/admin/users/{userId}/api-tokens` (legacy `POST /api/v1/admin/api-tokens/revoke-all/{userId}`).

---

## 10. Legacy & Deprecated Endpoint Aliases

All legacy endpoints below remain **100% functional** and invoke the exact same controller logic as their canonical `/api/v1/*` counterparts. New features, mobile clients, and documentation should use the canonical paths.

| Legacy Path | Canonical `/api/v1/*` Path |
|---|---|
| `GET /api/v1/global-search` | `GET /api/v1/search/global` |
| `GET /api/v1/cities` | `GET /api/v1/transit/cities` |
| `GET /api/v1/cities/{id}/routes` | `GET /api/v1/transit/cities/{id}/routes` |
| `GET /api/v1/cities/{id}/map-data` | `GET /api/v1/transit/cities/{id}/map` (or `/map-data`) |
| `GET /api/v1/stops/nearby` | `GET /api/v1/transit/stops/nearby` |
| `GET /api/v1/search` | `GET /api/v1/transit/search` |
| `GET /api/v1/geo/poi` | `GET /api/v1/transit/pois` |
| `POST /api/v1/studio/routes` | `POST /api/v1/transit/studio/routes` |
| `GET\|PUT\|DELETE /api/v1/studio/routes/{id}` | `GET\|PUT\|PATCH\|DELETE /api/v1/transit/studio/routes/{id}` |
| `GET /api/v1/studio/routes/{id}/from-route` | `GET /api/v1/transit/studio/routes/{id}/from-route` |
| `POST /api/v1/compass/share` | `POST /api/v1/compass/shares` |
| `GET /api/v1/compass/share/{shareId}` | `GET /api/v1/compass/shares/{shareId}` |
| `GET /api/polls` | `GET /api/v1/polls` |
| `GET /api/polls/{idOrSlug}` | `GET /api/v1/polls/{idOrSlug}` |
| `GET /api/polls/{idOrSlug}/leaderboard` | `GET /api/v1/polls/{idOrSlug}/leaderboard` |
| `POST /api/submit` | `POST /api/v1/polls/{idOrSlug}/ballots` |
| `GET /api/contributors` | `GET /api/v1/contributors` |
| `GET /api/contributors/{contributor}` | `GET /api/v1/contributors/{contributor}` |
| `GET /api/population/master` | `GET /api/v1/atlas` |
| `GET /api/population/env-report` | `GET /api/v1/atlas/environment` |
| `GET /api/weather` | `GET /api/v1/weather` |
| `GET /api/prayer-times` | `GET /api/v1/prayer-times` |
| `GET /api/events/today` | `GET /api/v1/events/today` |
| `GET /api/recipe-of-the-day` | `GET /api/v1/recipes/today` |
| `GET /api/feed` | `GET /api/v1/feed` |
| `GET /api/answers` | `GET /api/v1/answers` |
| `GET /api/metrics` | `GET /api/v1/metrics` |
| `GET /api/app-icon` | `GET /api/v1/app-icon` |
| `GET /api/user` | `GET /api/v1/user` |
| `POST /api/account/update` | `PATCH /api/v1/account` |
| `POST /api/account/avatar` | `POST /api/v1/account/avatar` |
| `POST /api/account/delete` | `DELETE /api/v1/account` |
| `POST /api/user/settings` | `PATCH /api/v1/user/settings` |
| `POST /api/user/radio-usage` | `POST /api/v1/user/radio-usage` |
| `POST /api/user/radio-usage/clear` | `DELETE /api/v1/user/radio-usage` |
| `POST\|PUT\|DELETE /api/polls*` | `POST\|PUT\|PATCH\|DELETE /api/v1/admin/polls*` |
| `GET\|POST\|PUT\|PATCH\|DELETE /api/candidate-groups*` | `GET\|POST\|PUT\|PATCH\|DELETE /api/v1/admin/candidate-groups*` |
| `POST\|PUT\|PATCH\|DELETE /api/candidates*` | `POST\|PUT\|PATCH\|DELETE /api/v1/admin/candidates*` |
| `GET\|POST\|DELETE /api/admins*` | `GET\|POST\|DELETE /api/v1/admin/admins*` |
| `GET\|POST\|DELETE /api/v1/admin/assets/(list\|upload\|delete)` | `GET\|POST\|DELETE /api/v1/admin/assets` |
| `POST /api/v1/admin/api-tokens/revoke-all/{userId}` | `DELETE /api/v1/admin/users/{userId}/api-tokens` |
| `POST /api/v1/admin/users/{id}/toggle-ban` | `PATCH /api/v1/admin/users/{id}/ban` |
| `GET\|POST\|PUT\|DELETE /api/v1/admin/route(s\|-drafts)*` | `GET\|POST\|PUT\|PATCH\|DELETE /api/v1/admin/transit/route(s\|-drafts)*` |

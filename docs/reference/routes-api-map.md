# Routes & API Map

Generated from `routes/web.php` and `routes/api.php`. Grouped by feature area, matching the module docs.

## Public web pages (`web.php`)

### Core / meta
| Method | Path | Handler |
|---|---|---|
| GET | `/` | HomeController@index — customizable links portal |
| GET | `/healthcheck` | closure → "OK" |
| GET | `/sitemap.xml` | SitemapController@index (DB-driven, 1h cache) |
| GET | `/up` | Laravel health endpoint |

### Polls / Tier list
- `GET /polls`, `GET /polls/{slug}`, `GET /polls/{slug}/leaderboard`
- `GET /tierlist`, `GET /tierlist/leaderboard`

### Directories & data pages
- `GET /syofficial`, `/phonebook`, `/govapps`, `/atlas` (canonical; `/population` 301-redirects to `/atlas`)
- Inertia closures: `/compass`, `/priorities`, `/roznama`, `/shawarma`, `/justice`, `/crossings`, `/about`, `/stats`, `/privacy`, `/terms`
- ExternalDataController: `/syid`, `/syrian-contributors`, `/sites`, `/party`, `/house`, `/alignment`

### Guess Who
- `GET /guesswho` · `POST /guesswho/rooms` (throttle 10/min) · `GET /guesswho/room/{roomCode}` · `POST .../join` (throttle 30/min) · `POST .../signal` · `POST /guesswho/broadcasting/auth`

### Transit
- `GET /transit` (closure; cached cities with `ST_AsGeoJSON`)
- `GET /transit/city/{id}` → `Transit/city/[id]/Index`
- Old map URLs 301-redirect · `GET /transit/studio` · `GET /transit/admin` (transit_admin)

### Mishwar (hidden places)
- `GET /mishwar` (old `/places` → 301)
- `GET /board` → Board dashboard (guest mode via localStorage)

### Auth & dashboard
- `GET /user`, `GET /auth/google` + callback, `POST /logout`
- `POST /api/user/settings`
- `GET /dev/impersonate/{role}` (dev only)

## Authenticated (`web.php`, session+CSRF)

- Dashboard: `GET /dashboard`; `POST /api/account/update|avatar|delete` (avatar throttled 10/min)
- Board sync: `GET|PUT /api/v1/board` (throttle 60/min)
- Superadmin: users CRUD `/api/admins[/{id}]`; asset explorer `/admin/assets` + `/api/v1/admin/assets/(list|upload|delete)` (50MB cap); homepage popup `/admin/site-popup` + `GET|PUT /api/v1/admin/site-popup` (superadmin only, version-bump on update, shared as `sitePopup` prop)

### Mishwar owner endpoints (`auth`)
- `POST /places` (submit), `GET /my/places`, `PATCH /my/places/{id}`, `PATCH .../location`, `POST .../photos`, `POST .../resubmit`, `DELETE /my/places/{id}`
- Photo ops: `DELETE|POST /my/place-photos/{id}(/rotate)`
- Saves: `GET /my/saves`, `POST|DELETE /places/{id}/save`

### Admin moderation panels (role-gated)

| Area | Pages | API |
|---|---|---|
| Polls | `/dashboard` polls tab (inline create + edit; legacy `/admin/polls*` 301-redirects to dashboard) | `POST|PUT|DELETE /api/polls*` under `polls_admin`; candidate-groups apiResource (+reorder, setDefault); candidates apiResource (+archive/restore) |
| Places | `/admin/places` (`places_admin`) | approve/reject/update/delete + photo add/rotate/replace/delete under `/api/v1/admin/place(s|-photos)` |
| Transit | `/transit/admin` (`transit_admin`, per-action `transit.review_drafts|approve|reject|edit_routes` on mutating endpoints) | draft approve/reject; published-route CRUD incl. geojson, stops, logs, move, combine, split, status; `POST /api/admin/users/{id}/toggle-ban` |
| Guess Who | `/admin/guesswho` (`admin`; dashboard "من هو" link) | categories/characters CRUD under `/api/v1/admin/guesswho/*` |
| Site popup | `/admin/site-popup` (`superadmin`) | `GET|PUT /api/v1/admin/site-popup` |
| SyOfficial | Admin page | categories/entities CRUD + reorder under `/api/v1/admin/syofficial/*` |
| Gov apps | Admin page | CRUD + reorder under `/api/v1/admin/govapps` |
| Phonebook | Admin page | categories/entries CRUD, toggle active, reorder under `/api/v1/admin/phonebook` |

## JSON API (`api.php`)

### Legacy polls
- `GET /polls`, `/polls/{idOrSlug}`, `/polls/{idOrSlug}/leaderboard`
- `POST /submit` (throttle `voting` = 10/min)

### Contributors & atlas
- `GET /contributors`, `/contributors/{contributor}` (throttle 60/min)
- `GET /population/master`, `/population/env-report` (page itself lives at `/atlas`)

### Widget APIs (throttle 60/min)
`/weather` · `/answers` · `/recipe-of-the-day` · `/events/today` · `/feed` · `/prayer-times` · `/metrics`

### Utilities
- `GET /app-icon` — proxies Apple iTunes Lookup & Google Play scraping (24h cache, throttle 60/min)

### `v1/` group

**Transit** (`Api\V1\TransitController`, reads throttle 60/min):
- `GET /cities`, `/cities/{id}/routes`, `/cities/{id}/map-data`
- `GET /stops/nearby`, `GET /search`
- Transit Studio: `POST /studio/routes` (5/min); auth'd `GET|PUT /studio/routes/{id}`, `GET .../from-route`

**Places**: `GET /places/map|nearby|geocode|photos|{id}` · `GET /guides`

**Hotels**: `GET /hotels/map`, `/hotels`, `/hotels/{id}`

**Public voting data** (`Api\V1\VotingDataController`, throttle `public-api`): see [modules/polls-public-api.md](../modules/polls-public-api.md).

## Broadcasting channels (`channels.php`)
Private/presence channels for Guess Who room signaling.

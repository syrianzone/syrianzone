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
- `GET /syofficial`, `/phonebook`, `/govapps`, `/population`
- Inertia closures: `/compass`, `/priorities`, `/roznama`, `/shawarma`, `/justice`, `/crossings`, `/about`, `/stats`, `/privacy`, `/terms`
- ExternalDataController: `/syid`, `/syrian-contributors`, `/sites`, `/party`, `/house`, `/alignment`

### Guess Who
- `GET /guesswho` · `POST /guesswho/rooms` · `GET /guesswho/room/{roomCode}` · `POST .../join` · `POST .../signal` · `POST /guesswho/broadcasting/auth`

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
- Superadmin: users CRUD `/api/admins[/{id}]`; asset explorer `/admin/assets` + `/api/v1/admin/assets/(list|upload|delete)` (50MB cap)

### Mishwar owner endpoints (`auth`)
- `POST /places` (submit), `GET /my/places`, `PATCH /my/places/{id}`, `PATCH .../location`, `POST .../photos`, `POST .../resubmit`, `DELETE /my/places/{id}`
- Photo ops: `DELETE|POST /my/place-photos/{id}(/rotate)`
- Saves: `GET /my/saves`, `POST|DELETE /places/{id}/save`

### Admin moderation panels (role-gated)

| Area | Pages | API |
|---|---|---|
| Polls | `/admin/polls(/create|/{id}/edit)` | `POST|PUT|DELETE /api/polls*`; candidate-groups apiResource (+reorder, setDefault); candidates apiResource (+archive/restore) |
| Places | `/admin/places` | approve/reject/update/delete + photo add/rotate/replace/delete under `/api/v1/admin/place(s|-photos)` |
| Transit | `/transit/admin` | draft approve/reject; published-route CRUD incl. geojson, stops, logs, move, combine, split, status; `POST /api/admin/users/{id}/toggle-ban` |
| SyOfficial | Admin page | categories/entities CRUD + reorder under `/api/v1/admin/syofficial/*` |
| Gov apps | Admin page | CRUD + reorder under `/api/v1/admin/govapps` |
| Phonebook | Admin page | categories/entries CRUD, toggle active, reorder under `/api/v1/admin/phonebook` |

## JSON API (`api.php`)

### Legacy polls
- `GET /polls`, `/polls/{idOrSlug}`, `/polls/{idOrSlug}/leaderboard`
- `POST /submit` (throttle `voting` = 10/min)

### Contributors & atlas
- `GET /contributors`, `/contributors/{contributor}`
- `GET /population/master`, `/population/env-report`

### Widget APIs (throttle 60/min)
`/weather` · `/answers` · `/recipe-of-the-day` · `/events/today` · `/feed` · `/prayer-times` · `/metrics`

### Utilities
- `GET /app-icon` — proxies Apple iTunes Lookup & Google Play scraping (24h cache)

### `v1/` group

**Transit** (`Api\V1\TransitController`):
- `GET /cities`, `/cities/{id}/routes`, `/cities/{id}/map-data`
- `GET /stops/nearby`, `GET /search`
- Transit Studio: `POST /studio/routes` (5/min); auth'd `GET|PUT /studio/routes/{id}`, `GET .../from-route`

**Places**: `GET /places/map|nearby|geocode|photos|{id}` · `GET /guides`

**Hotels**: `GET /hotels/map`, `/hotels`, `/hotels/{id}`

**Public voting data** (`Api\V1\VotingDataController`, throttle `public-api`): see [modules/polls-public-api.md](../modules/polls-public-api.md).

## Broadcasting channels (`channels.php`)
Private/presence channels for Guess Who room signaling.

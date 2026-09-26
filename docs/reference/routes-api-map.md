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

Every panel below is gated by a single per-route capability, not by module
membership. `ModuleCapabilityGuard` (in `app/Http/Middleware/`) denies any
route inside these groups that does not name a capability, so a capability such
as `phonebook.reorder` no longer implies `phonebook.delete`. Page shells and
read-only indexes are tagged `any`, meaning "any one capability in this module".
Adding a route to one of these groups therefore requires choosing its capability;
`ModuleCapabilityRoutesTest` fails the build if one is missing, is not a real
capability, is used on the wrong module's middleware, or if `any` appears on a
mutating route.

Superadmin, the general `admin` role, and the per-module admin roles
(`syofficial_admin`, `transit_admin`, `govapps_admin`, `phonebook_admin`,
`places_admin`) bypass all of this via `User::hasPermission()`. Note that
`polls` has no `polls_admin` role — only the middleware alias.

| Area | Pages | API |
|---|---|---|
| Polls | `/dashboard` polls tab (inline create + edit; legacy `/admin/polls*` 301-redirects to dashboard) | `POST /api/polls` (create), `PUT /api/polls/{id}` (edit), `DELETE` (delete); candidate-groups read (`any`) + create/update/destroy + reorder/setDefault; candidates create/update/destroy + archive/restore |
| Places | `/admin/places` (`places_admin:any`) | index (review), approve/reject (approve), update + addPhoto (edit), delete (delete), photo rotate/replace/delete (moderate_photos) under `/api/v1/admin/place(s|-photos)` |
| Transit | `/transit/admin` (`transit_admin:any`; denial redirects to `/dashboard`) | draft approve/reject; published-route CRUD incl. geojson, stops, logs, move, combine, split, status; My Maps import `POST /api/v1/admin/routes/import-preview` (review_drafts, 10/min) + `POST /api/v1/admin/routes/import-publish` (edit_routes, 30/min, `mode: draft\|direct`). Governorate scoping is a second check, applied in `TransitAdminController` via `ChecksTransitScope` |
| Guess Who | `/admin/guesswho` (`admin`; dashboard "من هو" link) | categories/characters CRUD under `/api/v1/admin/guesswho/*` |
| Site popup | `/admin/site-popup` (`superadmin`) | `GET|PUT /api/v1/admin/site-popup` |
| SyOfficial | `/admin/syofficial` (`syofficial_admin:any`) | categories/entities create (create), update (edit), delete (delete), reorder (reorder) under `/api/v1/admin/syofficial/*`. Deleting a category cascades to its entities |
| Gov apps | `/admin/govapps` (`govapps_admin:any`) | create (create), update (edit), destroy (delete, soft), reorder (reorder) under `/api/v1/admin/govapps` |
| Phonebook | `/admin/phonebook` (`phonebook_admin:any`) | categories/entries create (create), update (edit), toggle active (toggle), destroy (delete, hard), reorder (reorder) under `/api/v1/admin/phonebook` |
| User ban | dashboard user list | `POST /api/admin/users/{id}/toggle-ban` — authorised by a role check inside `DashboardController::toggleBan`, not by a capability. It was previously misfiled inside the `transit_admin` group |

### Agent / MCP surface (`routes/ai.php`, bearer token — no session, no CSRF)

| Route | Auth | Notes |
|---|---|---|
| `POST|GET|DELETE /mcp/admin` | `auth:sanctum` + `RequireApiToken` + `throttle:mcp` | Only registered when `MCP_ENABLED=true`; session cookies are refused. Effective permission = user's live permission AND token abilities. Tools: places moderation, the SyOfficial directory, government apps, and transit governance (37 tools; combine/split stay dashboard-only). Tokens minted at `/admin/api-tokens` (dashboard sidebar, superadmin). See [modules/agent-mcp.md](../modules/agent-mcp.md) |

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

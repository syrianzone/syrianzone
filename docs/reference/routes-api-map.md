# Routes & API Map

Generated from `routes/web.php` and `routes/api.php`. Grouped by feature area, matching the module docs.

> [!TIP]
> For detailed request/response schemas, query parameters, rate limits, error envelopes, and the full canonical-to-legacy alias map, see the **[Central API Reference (`docs/reference/api.md`)](api.md)**.

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
- Inertia closures: `/priorities`, `/roznama`, `/shawarma`, `/justice`, `/crossings`, `/stats`, `/privacy`, `/terms`
- CompassController: `/compass`, `/compass/stats` (public anonymous aggregate), `/compass/s/{shareId}` (shared result card)
- AboutController: `/about` (fetches the repo's GitHub contributors, bots excluded, cached 1h)
- ExternalDataController: `/syid`, `/syrian-contributors`, `/sites`, `/party`, `/house`, `/alignment`

### Guess Who
- Pages: `GET /guesswho` · `GET /guesswho/room/{roomCode}`
- Canonical JSON API (`/api/v1/guesswho/*`): `POST /rooms` (10/min) · `POST /rooms/{roomCode}/join` (30/min) · `POST /rooms/{roomCode}/actions` (120/min) · `GET /rooms/{roomCode}/state` (60/min) · `POST /broadcasting/auth` (30/min)
- Legacy JSON aliases (`/guesswho/*`): `POST /guesswho/rooms`, `POST /guesswho/room/{roomCode}/join`, `POST /guesswho/room/{roomCode}/action`, `GET /guesswho/room/{roomCode}/state`, `POST /guesswho/broadcasting/auth`

### Games
- `GET /games` · `GET /games/2048` · `GET /games/solitare` · `GET /games/tarneeb` · `GET /games/trix` (Inertia closures; records are device-local, no API)

### Muslim Corner
- `GET /muslim` (hub) · `GET /muslim/prayer` · `GET /muslim/quran` · `GET /muslim/radio` (Inertia closures; old `/muslim?tab=` links 301 to the matching sub-page)
- Quran bookmarks API: `GET`/`POST /api/v1/quran-bookmarks`, `DELETE /api/v1/quran-bookmarks/{surah}/{ayah}` (auth)
- Radio data usage: canonical `POST /api/v1/user/radio-usage`, `DELETE /api/v1/user/radio-usage` (legacy `POST /api/user/radio-usage`, `POST /api/user/radio-usage/clear`)

### Transit
- `GET /transit` (closure; cached cities with `ST_AsGeoJSON`)
- `GET /transit/city/{id}` → `Transit/city/[id]/Index`
- Old map URLs 301-redirect · `GET /transit/studio` · `GET /transit/admin` (transit_admin)

### Mishwar (hidden places)
- `GET /mishwar` (old `/places` → 301)
- `GET /board` → Board dashboard (guest mode via localStorage)

### Auth & dashboard
- Web OAuth & session: `GET /user`, `GET /auth/google` + `GET /auth/google/callback`, `POST /logout`
- Cross-platform mobile token OAuth (`api.php`): `POST /api/v1/auth/google/token` (alias `POST /api/v1/auth/google`), `GET /api/v1/auth/user`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-devices`
- User settings: canonical `PATCH|PUT|POST /api/v1/user/settings` (legacy `POST /api/user/settings`)
- `GET /dev/impersonate/{role}` (dev only)

## Authenticated (`web.php`, session+CSRF or Sanctum Bearer token)

- Dashboard: `GET /dashboard`
- Account: canonical `GET /api/v1/user`, `PATCH|PUT /api/v1/account`, `POST /api/v1/account/avatar` (10/min), `DELETE /api/v1/account` (legacy `/api/user`, `POST /api/account/update|avatar|delete`)
- Board sync: `GET|PUT /api/v1/board` (throttle 60/min)
- Superadmin:
  - Staff CRUD: canonical `GET|POST /api/v1/admin/admins`, `DELETE /api/v1/admin/admins/{id}` (legacy `/api/admins[/{id}]`)
  - Asset explorer: `/admin/assets` + canonical `GET|POST|DELETE /api/v1/admin/assets` & `GET /api/v1/admin/assets/manifest` (legacy `/api/v1/admin/assets/(list|upload|delete)`)
  - Site navigation & icon catalog: `/admin/navigation` + `GET|PUT /api/v1/admin/navigation`
  - Homepage popup: `/admin/site-popup` + `GET|PUT /api/v1/admin/site-popup`
  - Agent API tokens: `/admin/api-tokens` + `POST /api/v1/admin/api-tokens`, `DELETE /api/v1/admin/api-tokens/{id}`, `DELETE /api/v1/admin/users/{userId}/api-tokens` (legacy `POST /api/v1/admin/api-tokens/revoke-all/{userId}`)

### Mishwar owner endpoints (`auth:web,sanctum`, `/api/v1/*`)
- `POST /places` (submit), `GET /my/places`, `PATCH /my/places/{id}`, `PATCH .../location`, `POST .../photos`, `POST .../resubmit`, `DELETE /my/places/{id}`
- Photo ops: `DELETE|POST /my/place-photos/{id}(/rotate)`
- Saves: `GET /my/saves`, `POST|DELETE /places/{id}/save`

### Admin moderation panels (capability-gated)

Every panel below is gated by a single per-route capability, not by module membership. `ModuleCapabilityGuard` (in `app/Http/Middleware/`) denies any route inside these groups that does not name a capability, so a capability such as `phonebook.reorder` no longer implies `phonebook.delete`. Page shells and read-only indexes are tagged `any`, meaning "any one capability in this module". Adding a route to one of these groups therefore requires choosing its capability; `ModuleCapabilityRoutesTest` fails the build if one is missing, is not a real capability, is used on the wrong module's middleware, or if `any` appears on a mutating route.

| Area | Pages | Canonical API (`/api/v1/admin/*`) |
|---|---|---|
| Polls | `/dashboard` polls tab (legacy `/admin/polls*` 301-redirects) | `/api/v1/admin/polls*`, `/api/v1/admin/candidate-groups*`, `/api/v1/admin/candidates*` (legacy `/api/polls*`, `/api/candidate-groups*`, `/api/candidates*`) |
| Places | `/admin/places` (`places_admin:any`) | `/api/v1/admin/places*` and `/api/v1/admin/place-photos*` |
| Transit | `/transit/admin` (`transit_admin:any`) | `/api/v1/admin/transit/route-drafts*`, `/api/v1/admin/transit/routes*` (legacy `/api/v1/admin/route-drafts*`, `/api/v1/admin/routes*`) |
| Guess Who | `/admin/guesswho` (`superadmin`) | `/api/v1/admin/guesswho/categories*`, `/api/v1/admin/guesswho/characters*` |
| Site navigation | `/admin/navigation` (`superadmin`) | `GET\|PUT /api/v1/admin/navigation` |
| Site popup | `/admin/site-popup` (`superadmin`) | `GET\|PUT /api/v1/admin/site-popup` |
| SyOfficial | `/admin/syofficial` (`syofficial_admin:any`) | `/api/v1/admin/syofficial/categories*`, `/api/v1/admin/syofficial/entities*` |
| Gov apps | `/admin/govapps` (`govapps_admin:any`) | `/api/v1/admin/govapps*` |
| Phonebook | `/admin/phonebook` (`phonebook_admin:any`) | `/api/v1/admin/phonebook/categories*`, `/api/v1/admin/phonebook/entries*` |
| Compass | `/admin/compass*` (`compass_admin:compass.*`) | `/api/v1/admin/compass/figures*`, `/api/v1/admin/compass/personas*` |
| User ban | dashboard user list | `PATCH /api/v1/admin/users/{id}/ban` (legacy `POST /api/v1/admin/users/{id}/toggle-ban`) — `users_admin:users.ban` |

### Agent / MCP surface (`routes/ai.php`, bearer token — no session, no CSRF)

| Route | Auth | Notes |
|---|---|---|
| `POST\|GET\|DELETE /mcp/admin` | `auth:sanctum` + `RequireApiToken` + `throttle:mcp` | Only registered when `MCP_ENABLED=true`; session cookies and mobile user tokens (`abilities: ["mobile"]`) are refused. Effective permission = user's live permission AND token abilities. See [modules/agent-mcp.md](../modules/agent-mcp.md) |

## JSON API (`api.php` — Canonical `/api/v1/*` + Legacy Aliases)

See **[docs/reference/api.md](api.md)** for full payload schemas and parameter tables.

- **Auth (`/api/v1/auth/*`)**:
  - `POST /api/v1/auth/google/token` (alias `POST /api/v1/auth/google`)
  - `GET /api/v1/auth/user`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-devices`
- **Navigation & Icon Catalog (`/api/v1/navigation`)**:
  - `GET /api/v1/navigation` (optional `?surface=home|navbar|mobile_menubar` & `?include_disabled=1`)
- **Search**:
  - `GET /api/v1/search/global` (legacy `GET /api/v1/global-search`)
  - `GET /api/v1/transit/search` (legacy `GET /api/v1/search`)
  - `GET /api/v1/transit/pois` (legacy `GET /api/v1/geo/poi`)
  - `GET /api/v1/places`, `GET /api/v1/places/geocode`
- **Transit (`/api/v1/transit/*`)**:
  - `GET /api/v1/transit/cities` (legacy `/api/v1/cities`)
  - `GET /api/v1/transit/cities/{id}/routes` (legacy `/api/v1/cities/{id}/routes`)
  - `GET /api/v1/transit/cities/{id}/map` & `/map-data` (legacy `/api/v1/cities/{id}/map-data`)
  - `GET /api/v1/transit/stops/nearby` (legacy `/api/v1/stops/nearby`)
  - `GET /api/v1/transit/search` (legacy `/api/v1/search`)
  - `GET /api/v1/transit/pois` (legacy `/api/v1/geo/poi`)
  - Transit Studio: `GET|POST /api/v1/transit/studio/routes`, `GET|PUT|PATCH|DELETE /api/v1/transit/studio/routes/{id}`, `GET .../from-route` (legacy `/api/v1/studio/routes*`)
- **Polls & Voting (`/api/v1/polls/*`)**:
  - `GET /api/v1/polls`, `GET /api/v1/polls/{idOrSlug}`, `GET .../candidates`, `GET .../scores`, `GET .../ballots`, `GET .../leaderboard`
  - `POST /api/v1/polls/{idOrSlug}/ballots` & `POST /api/v1/polls/ballots` (legacy `POST /api/submit`, `GET /api/polls*`)
- **Places & Hotels (`/api/v1/places/*`, `/api/v1/hotels/*`)**:
  - `GET /api/v1/places`, `/places/map`, `/places/nearby`, `/places/geocode`, `/places/photos`, `/places/{id}`, `/guides`
  - `GET /api/v1/hotels`, `/hotels/map`, `/hotels/{id}`
- **Compass (`/api/v1/compass/*`)**:
  - `GET|POST|DELETE /api/v1/compass/results[/{id}]`, `POST|GET /api/v1/compass/shares[/{shareId}]` (legacy `/share`), `POST|DELETE /api/v1/compass/stats`
- **Atlas, Contributors, Widgets & Utilities (`/api/v1/*` + legacy `/api/*`)**:
  - `GET /api/v1/atlas`, `GET /api/v1/atlas/environment` (legacy `/api/population/master`, `/api/population/env-report`)
  - `GET /api/v1/contributors[/{contributor}]` (legacy `/api/contributors*`)
  - `GET /api/v1/weather`, `/prayer-times`, `/events/today`, `/recipes/today` (legacy `/recipe-of-the-day`), `/feed`, `/answers`, `/metrics`, `/app-icon`

## Broadcasting channels (`channels.php`)
Private/presence channels for Guess Who room state.

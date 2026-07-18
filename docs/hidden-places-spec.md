# Hidden Places: Implementation Spec

## 1. THESIS

"Mishwar" (مشوار) is a map-first community feature at `/mishwar` (legacy `/places` 301-redirects there) where logged-in users pin hidden Syrian locations with photos, submissions pass admin moderation before appearing on a clustered MapLibre map, and visitors browse, search, save, and share approved places.

This document is the single contract for the feature as implemented. Every name, path, prop, and JSON key below is normative. Do not invent alternatives.

## 2. HOUSE CONVENTIONS (follow exactly, do not re-derive from the codebase)

- 2-space indentation everywhere (PHP, TS, JSON). Terse code. Comments explain why, not what, and are sparse. No em or en dashes anywhere; use colons, commas, or parentheses.
- Arabic-only UI strings hardcoded in JSX. RTL via `dir="rtl"` on containers, not on `<html>`. Coordinates and numbers render inside `dir="ltr"` spans when shown as text so RTL does not reverse them.
- Page skeleton:

```tsx
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

export default function Index() {
  return (
    <MainLayout>
      <Head>
        <title>مشوار</title>
        <meta name="description" content="خريطة تفاعلية لأماكن تستحق المشوار في سوريا" />
      </Head>
      <main dir="rtl">...</main>
    </MainLayout>
  );
}
```

- Auth in React: `const { user, isAdmin } = useAuth()` from `@/Contexts/AuthContext` (available under MainLayout). Login prompt is a plain link: `<a href="/auth/google">تسجيل الدخول عبر جوجل</a>`. No login page exists.
- HTTP client: the shared instance `import axios from '@/lib/axios'` (withCredentials + XSRF already configured). Never use raw fetch for API calls. All Places components call the typed client in `resources/js/Pages/Places/_lib/api.ts`, never axios directly (exceptions: the api.ts module itself, and the Lightbox photo downloads, which fetch static `/storage/...` files, not API endpoints).
- UI components: import from `@/Components/ui/*` (button, card, dialog, sheet, input, textarea, select, badge, avatar, alert, separator, scroll-area, label). Do NOT import from `Components/sycn`. No toast library: feedback uses `<Alert variant="default|destructive">` inline or a transient icon/label swap.
- Icons: lucide-react. Theme: rely on tokens (`bg-background`, `text-foreground`, `text-primary`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-accent/50`, `destructive`). Never hardcode colors; dark mode is automatic via `data-theme`.
- Map style: `'/styles/styles/dark-matter.json'` (local, no API key). MapLibre v5 is already a dependency.
- Backend validation: inline `$request->validate(['field' => 'required|string|max:255'])` pipe-string rules in controllers. No FormRequest classes, no Policies, no API Resources: match the codebase. Guard checks return early JSON: `return response()->json(['message' => '...'], 403);`.
- Response codes: 201 create, 204 delete (`response()->json(null, 204)`), 400 invalid transition, 403 forbidden, 404 missing, 422 validation (automatic), 429 throttled. Error key is `message`.
- Models: explicit `$fillable`, sparse `$casts`, one-line relation methods, `HasFactory`.
- Migrations: anonymous class, `up()`/`down()`, `foreignId(...)->constrained()->cascadeOnDelete()`, `enum` for status columns, `timestamps()`. SQLite AND MySQL portable: no spatial functions, no SQLite-only SQL, no generated columns. Shipped migrations are never edited; schema removals happen through new drop migrations.
- Tests: Pest closures in `tests/Feature/`, `RefreshDatabase` is global via `tests/Pest.php`. Style: `test('can list approved places', function () { ... });`, `$this->getJson()/postJson()`, `assertOk/assertCreated/assertJsonPath/assertJsonCount/assertDatabaseHas`, `actingAs(User::factory()->create(['role' => 'user']))`. WARNING: `UserFactory` defaults `role` to `'admin'`; every test that means a regular user MUST pass `['role' => 'user']` explicitly or admin-gating tests silently pass for the wrong reason. Rate-limit tests loop N+1 requests and assert 429.
- Routing split: public reads live in `routes/api.php` (no session needed, but `statefulApi()` means `$request->user()` still resolves when a session cookie is present). All writes (user and admin) live in `routes/web.php` under the existing `Route::middleware('auth')->group()` so they get session + CSRF.
- GeoJSON coordinates are `[lng, lat]`. Database columns and all non-GeoJSON API JSON use explicit `lat` and `lng` keys.

## 3. DATA MODEL

### 3.1 Schema

Live tables: `places`, `place_photos`, `place_saves`.

Likes, comments, and reports were removed from the product. The original create migrations (prefix `2026_07_15_1000NN_`) remain in the tree because production ran them; the `2026_07_16_2000NN_` drop migrations remove `place_likes`, `place_comments`, and `place_reports`, and drop the `likes_count` and `comments_count` counter columns from `places`. Their `down()` methods recreate the originals exactly.

**`places`** (after `2026_07_16_200004_drop_place_counters_from_places_table.php`)

```php
$table->id();
$table->foreignId('user_id')->constrained()->cascadeOnDelete();
$table->string('name', 160);
$table->string('category', 32)->index();
$table->text('description');
$table->decimal('lat', 10, 7);
$table->decimal('lng', 10, 7);
$table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
$table->text('rejection_reason')->nullable();
$table->unsignedInteger('saves_count')->default(0);
$table->timestamp('approved_at')->nullable();
$table->timestamps();
$table->index(['lat', 'lng']);
$table->index(['status', 'category']);
```

**`place_photos`**

```php
$table->id();
$table->foreignId('place_id')->constrained()->cascadeOnDelete();
$table->string('original_path');
$table->string('display_path');
$table->string('thumb_path');
$table->unsignedSmallInteger('sort')->default(0);
$table->timestamps();
```

**`place_saves`**

```php
$table->id();
$table->foreignId('place_id')->constrained()->cascadeOnDelete();
$table->foreignId('user_id')->constrained()->cascadeOnDelete();
$table->timestamps();
$table->unique(['place_id', 'user_id']);
```

### 3.2 Models (`app/Models/`)

**`Place.php`**

```php
class Place extends Model {
  use HasFactory;
  protected $fillable = ['user_id', 'name', 'category', 'description', 'lat', 'lng', 'status', 'rejection_reason', 'approved_at'];
  protected $casts = ['lat' => 'float', 'lng' => 'float', 'approved_at' => 'datetime'];
  public function user() { return $this->belongsTo(User::class)->withTrashed(); }
  public function photos() { return $this->hasMany(PlacePhoto::class)->orderBy('sort'); }
  public function saves() { return $this->hasMany(PlaceSave::class); }
}
```

**`PlacePhoto.php`**: fillable `['place_id', 'original_path', 'display_path', 'thumb_path', 'sort']`, relation `place()`. No accessors and no appends: controllers build URLs inline with `Storage::url($photo->thumb_path)` / `Storage::url($photo->display_path)`.

**`PlaceSave.php`**: fillable `['place_id', 'user_id']`, relations `place()`, `user()`.

The `saves_count` counter cache is maintained by controllers with `increment()`/`decrement()` on write, never recomputed on read.

### 3.3 Factories (`database/factories/`)

`PlaceFactory.php` (name: fake city word, category random key from section 11, description: sentence, lat between 32.5 and 37.0, lng between 35.8 and 42.0, status `'pending'`, `user_id => User::factory()`), `PlacePhotoFactory.php`. Factory states on PlaceFactory: `approved()` (status approved + approved_at now), `rejected()`.

## 4. IMAGE PIPELINE

- Library: `intervention/image` v3 with GD driver.
- Disk: resolved from `config('filesystems.media_disk')` (env `MEDIA_DISK`, default `public`). Local dev/tests use `public` (`storage/app/public`, URLs `/storage/...`, `php artisan storage:link` must have run). Production sets `MEDIA_DISK=r2`: the `r2` disk (S3 driver against Cloudflare R2, `R2_*` env vars) stores media off-box so files survive container replacement, with URLs served from `R2_URL`. `MEDIA_DISK=r2` rollout requirement: the host behind `R2_URL` MUST send `Access-Control-Allow-Origin` for the app origin (R2 bucket CORS policy or CDN rule allowing GET/HEAD). The lightbox download buttons `fetch()` `display_url`, which is cross-origin under r2; without that header every download fails with a CORS TypeError even though `<img>` rendering works.
- Paths (all under `places/{place_id}/`): original `places/{id}/{uuid}.{ext}` (ext = original extension, stored untouched for future reprocessing), display `places/{id}/{uuid}_display.webp`, thumb `places/{id}/{uuid}_thumb.webp`.
- Sizes: thumb = 400x400 cover crop, webp quality 75. Display = scaled down so the longest side is at most 1600px (never upscaled), webp quality 80. Use `ImageManager::withDriver(\Intervention\Image\Drivers\Gd\Driver::class)`, `cover(400, 400)` and `scaleDown(width: 1600, height: 1600)`, `toWebp(quality)`.
- Validation (in controller, exact rules): `'photos' => 'required|array|min:1|max:10'`, `'photos.*' => 'required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000'`. Laravel's `image`/`mimes` rules sniff content via fileinfo, not extension: this is the required mime check. The max dimensions cap decompression bombs before GD allocates the bitmap.
- Ops prerequisite for the 10-photo, 12 MB caps: a full submit needs `upload_max_filesize >= 12M`, `post_max_size >= 125M`, and nginx `client_max_body_size >= 125M`. The 6000x6000 dimension cap stays (real memory bound).
- Service class: `app/Services/PlaceImageService.php`

```php
namespace App\Services;

use App\Models\PlacePhoto;
use Illuminate\Http\UploadedFile;

class PlaceImageService {
  // Stores original + display webp + thumb webp on the media disk and creates the PlacePhoto row.
  public function store(UploadedFile $file, int $placeId, int $sort): PlacePhoto;

  // Deletes the three files for a photo from the media disk (row deletion is the caller's job).
  public function deleteFiles(PlacePhoto $photo): void;
}
```

Wrap GD processing in try/catch; on failure delete any files already written and rethrow so the controller's DB transaction rolls back.

## 5. API CONTRACT

All JSON keys are snake_case. `PLACE_LIST_ITEM`, `PLACE_DETAIL`, `MY_PLACE`, `ADMIN_PLACE` denote the shapes defined at the end of this section.

### 5.1 Public reads (routes/api.php, nested group inside the existing v1 group with `throttle:60,1` applied to these routes only; never add middleware to the whole v1 group, that would change the existing transit endpoints)

Register `/places/map` and `/places/nearby` BEFORE `/places/{id}`, and constrain every `{id}` route with `->whereNumber('id')` so literal segments never match the show route.

**`GET /api/v1/places/map`** -> `PlaceController@mapData`. No params. Returns ALL approved places as GeoJSON (client filters by category/text; this keeps the endpoint cacheable). Server caches with `Cache::remember('places:map', 300, ...)` and sends `Cache-Control: public, max-age=60`. Response 200:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [36.2913000, 33.5104000] },
      "properties": { "id": 12, "name": "مقهى النوفرة", "category": "cultural", "thumb_url": "/storage/places/12/abc_thumb.webp" }
    }
  ]
}
```

`thumb_url` is the first photo's thumb or `null`. Coordinates are `[lng, lat]`.

**`GET /api/v1/places`** -> `PlaceController@index`. Validate: `'category' => 'sometimes|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other'`, `'q' => 'sometimes|string|max:100'` (matches `name LIKE %q% OR description LIKE %q%`), `'sort' => 'sometimes|in:newest,popular'` (`newest` default, `popular` = saves_count desc, newest as tiebreaker), plus `page`. Approved only, `->paginate(20)`, standard Laravel paginator JSON (`data`, `current_page`, `last_page`, `total`, ...), each `data` item is `PLACE_LIST_ITEM`.

**`GET /api/v1/places/nearby`** -> `PlaceController@nearby`. Params: `lat` required numeric -90..90, `lng` required numeric -180..180, `radius_km` optional numeric 0.05..25 default 2, `include_pending` optional boolean default false (when true, the requester's OWN pending places are included: used by the duplicate check so users see their own not-yet-approved submissions). `include_pending` is honored ONLY when `$request->user()` is non-null and never exposes other users' pending places; for guests it is silently ignored (approved only). Without this scoping, any self-registered account could enumerate unmoderated submissions that `show` deliberately 404s. Implementation is portable: bounding-box SQL prefilter then haversine in PHP:

```php
$latDelta = $radiusKm / 111.045;
$lngDelta = $radiusKm / (111.045 * max(cos(deg2rad($lat)), 0.01));
// whereBetween lat/lng, then filter+sort by haversine in PHP, take 20
```

Haversine (meters): `6371000 * 2 * asin(sqrt(sin²(Δlat/2) + cos(lat1)cos(lat2)sin²(Δlng/2)))`. Response 200: `{ "places": [ PLACE_LIST_ITEM + "distance_m": 154 ] }`, sorted nearest first, max 20.

**`GET /api/v1/places/{id}`** -> `PlaceController@show`. `id` numeric. 200 with `PLACE_DETAIL` if approved; the owner gets their own pending/rejected place, users with role admin/superadmin get any place regardless of status; everyone else gets 404. `saved_by_me` computed from `$request->user()` (false when guest).

**`GET /api/v1/places/photos`** -> `PlaceDiscoveryController@photos`. Photo grid feed: photos of approved places only, newest photo first, `paginate(24)`. Each entry: `{ "id", "thumb_url", "display_url", "place": { "id", "name", "category", "lat", "lng" } }` (lat/lng included so the grid can fly to the place without a second fetch). `Cache-Control: public, max-age=60`. Registered before `/places/{id}`.

**`GET /api/v1/guides`** -> `PlaceDiscoveryController@guides`. Local guides leaderboard. `'sort' => 'sometimes|in:submissions,saves,recent'` (default `submissions`). Single aggregate over approved places joined to non-banned, non-deleted users; top 20; cached per sort with `Cache::remember("places:guides:{$sort}", 300, ...)` (no forget hooks, 5-minute staleness is accepted). Response: `{ "sort", "guides": [ { "rank", "user_id", "name", "avatar_url", "approved_count", "saves_total", "recent_count" } ] }` (rank 1-based). `Cache-Control: public, max-age=60`.

Future guide-ranking criteria (documented only, deliberately NOT built): category specialists (top contributor per category), governorate coverage (distinct governorates contributed to, needs a governorate resolver), streaks (consecutive weeks with an approved place).

### 5.2 Authenticated writes (routes/web.php, inside the existing `Route::middleware('auth')->group()`)

**`POST /api/v1/places`** -> `PlaceController@store`. Middleware `throttle:20,60` (coarse abuse shield only; the real quota is 5 created places per hour counted in the controller, so failed validation attempts don't lock users out). Multipart form. Guard: `if ($request->user()->is_banned) return response()->json(['message' => 'تم حظر حسابك من المساهمة'], 403);`. Validation:

```php
$request->validate([
  'name' => 'required|string|max:160',
  'category' => 'required|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
  'description' => 'required|string|min:20|max:1000',
  'lat' => 'required|numeric|between:32.0,37.5',
  'lng' => 'required|numeric|between:35.5,42.5',
  'photos' => 'required|array|min:1|max:10',
  'photos.*' => 'required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
]);
```

(lat/lng bounds roughly box Syria; duplicate suggestion is a client-side step, the server does not block duplicates.) Creates place with `status => 'pending'` and photos via `PlaceImageService` inside `DB::transaction`. Response 201: `{ "id": 12, "status": "pending" }`.

**`GET /api/v1/my/places`** -> `PlaceController@mine`. Middleware `throttle:60,1`. Own places, newest first, `->paginate(20)`, `data` items are `MY_PLACE` (includes `status` and `rejection_reason`).

**Owner management** (all `throttle:20,60`, all `whereNumber('id')`). Scoping: `Place::where('user_id', $user->id)->findOrFail($id)` and `PlacePhoto::whereHas('place', ...)->findOrFail($id)`, so strangers and unknown ids both get 404 (no existence leak). Every content mutation EXCEPT rotate and place delete sends the place back to moderation: `status => 'pending'`, `rejection_reason => null`, `approved_at => null`, plus `Cache::forget('places:map')` (the `backToPending` helper in `PlaceController`).

- **`PATCH /api/v1/my/places/{id}`** -> `updateDetails`. Fields `name`/`category`/`description`, each `sometimes|required` with the same rules and Arabic messages as store. Empty validated payload: 422 `{ "message": "لا توجد تعديلات" }`. 200: `{ "id", "name", "category", "description", "status": "pending" }`.
- **`PATCH /api/v1/my/places/{id}/location`** -> `updateLocation`. Coords only, Syria box, back to pending. 200: `{ "id", "lat", "lng", "status": "pending" }`.
- **`POST /api/v1/my/places/{id}/photos`** -> `addPhoto`. Field `photo`, same rule set as admin addPhoto (`max:12288`, Arabic messages). Count guard `>= 10` under a row lock: 422 `{ "message": "لا يمكن إضافة أكثر من 10 صور" }`. Pending-reset happens inside the same transaction. 201: `{ "id", "thumb_url", "display_url", "sort", "place_status": "pending" }`.
- **`DELETE /api/v1/my/place-photos/{id}`** -> `deletePhoto`. Min-1 guard under the same lock: 422 `{ "message": "لا يمكن حذف الصورة الأخيرة" }`. Files deleted after commit. 200: `{ "id", "place_status": "pending" }` (not 204: the client needs the status flip).
- **`POST /api/v1/my/place-photos/{id}/rotate`** -> `rotatePhoto`. Delegates to `PlaceImageService::rotateClockwise`; missing file: 422 `{ "message": "ملف الصورة مفقود على الخادم" }`. Approval status is KEPT (pixels only); the map cache is still forgotten because it embeds versioned thumb urls. 200: `{ "id", "thumb_url", "display_url" }`.
- **`DELETE /api/v1/my/places/{id}`** -> `destroy`. Immediate, no approval: photo files then the row. 204.
- **`POST /api/v1/my/places/{id}/resubmit`** -> `resubmit`. Only from `rejected`, else 400 `{ "message": "لا يمكن إعادة إرسال هذا المكان" }`. Pending-reset only, no file or field changes. 200: `{ "id", "status": "pending" }`.

**`GET /api/v1/my/saves`** -> `PlaceEngagementController@mySaves`. Middleware `throttle:60,1`. Approved places the user saved, ordered by save time (newest save first, via a join on `place_saves.created_at`, not by place age), `->paginate(20)`, `data` items are `PLACE_LIST_ITEM`.

**`POST /api/v1/places/{id}/save`** / **`DELETE /api/v1/places/{id}/save`** -> `PlaceEngagementController@save` / `@unsave`. Middleware `throttle:60,1`. `firstOrCreate` on the unique pair; increment `saves_count` only when newly created, decrement only when the delete actually removed a row (guard against double-unsave driving the counter negative). 200: `{ "saved": true|false, "saves_count": n }`. Save targets must be approved places, else 404.

There are no like, comment, or report endpoints. `POST/DELETE /api/v1/places/{id}/like`, `GET/POST /api/v1/places/{id}/comments`, `DELETE /api/v1/place-comments/{id}`, and `POST /api/v1/places/{id}/report` were removed and now 404.

### 5.3 Admin moderation (routes/web.php, inside `auth` group, nested `Route::middleware('admin')`, group throttle `60,1`)

**`GET /api/v1/admin/places?status=pending|approved|rejected|all`** -> `PlaceAdminController@index`. Validate `'status' => 'sometimes|in:pending,approved,rejected,all'`, default `pending`. Newest first, `->paginate(20)`, `data` items are `ADMIN_PLACE`.

**`POST /api/v1/admin/places/{id}/approve`** -> `PlaceAdminController@approve`. Guard: `if ($place->status !== 'pending') return response()->json(['message' => "Place is already {$place->status}"], 400);`. Sets `status => 'approved'`, `approved_at => now()`, `Cache::forget('places:map')`. 200: `{ "id": 12, "status": "approved" }`.

**`POST /api/v1/admin/places/{id}/reject`** -> `PlaceAdminController@reject`. Same pending-only guard. Validation `'reason' => 'nullable|string|max:1000'`. Sets `status => 'rejected'`, `rejection_reason`. 200: `{ "id": 12, "status": "rejected" }`.

**`DELETE /api/v1/admin/places/{id}`** -> `PlaceAdminController@destroy`. Takedown of any place: deletes photo files via `PlaceImageService::deleteFiles`, deletes row (cascades), `Cache::forget('places:map')`. 204.

**Moderation edit endpoints**: `PATCH /api/v1/admin/places/{id}` (partial field update), `POST /api/v1/admin/places/{id}/photos` (add, count guard `>= 10` -> 422 `لا يمكن إضافة أكثر من 10 صور`), `POST /api/v1/admin/place-photos/{id}/replace`, `POST /api/v1/admin/place-photos/{id}/rotate`, `DELETE /api/v1/admin/place-photos/{id}` (min-1 guard). Photo rule everywhere: `required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000` with the same Arabic messages as the owner endpoints.

`GET /api/v1/admin/place-reports` and `POST /api/v1/admin/place-reports/{id}/resolve` were removed and now 404.

### 5.4 Inertia pages (routes/web.php)

- `GET /mishwar` -> `PlaceController@renderIndex` (`GET /places` 301-redirects here, query preserved) -> `Inertia::render('Places/Index')`. Public. The route ignores query params; the client reads `?place={id}` on load (section 6.2, deep link).
- `GET /admin/places` -> `PlaceAdminController@renderIndex` -> `Inertia::render('Admin/Places/Index')`. Inside `auth` + `admin` group.

### 5.5 JSON shapes (normative)

```jsonc
// PLACE_LIST_ITEM
{ "id": 12, "name": "مقهى النوفرة", "category": "cultural", "description": "...",
  "lat": 33.5104, "lng": 36.2913, "thumb_url": "/storage/places/12/abc_thumb.webp",
  "saves_count": 2 }

// PLACE_DETAIL = PLACE_LIST_ITEM plus:
{ "status": "approved",
  "user": { "id": 3, "name": "أحمد", "avatar_url": "https://..." },
  "photos": [ { "id": 1, "thumb_url": "/storage/...", "display_url": "/storage/...", "sort": 0 } ],
  "saved_by_me": false, "created_at": "2026-07-15T10:00:00.000000Z" }

// MY_PLACE = PLACE_LIST_ITEM plus:
{ "status": "rejected", "rejection_reason": "صور غير واضحة", "created_at": "..." }

// ADMIN_PLACE = PLACE_DETAIL plus:
{ "rejection_reason": null }
```

Shaping is done inline with `->map(fn($p) => [...])` in controllers (no API Resources). `thumb_url`/`display_url` are built with `Storage::url()`.

## 6. FRONTEND

Stack: MapLibre GL (imperative init, Transit "Pattern B"), style `'/styles/styles/dark-matter.json'`, built-in GeoJSON clustering (`cluster: true`). No TanStack Query for this feature: plain typed api client + useState/useEffect (matches most Pages). Zustand not needed; `Index.tsx` owns state and passes props.

### 6.1 Shared modules (every component imports from these, exactly these)

**`resources/js/Pages/Places/_lib/types.ts`** exports:

```ts
export type PlaceCategory = 'historical' | 'natural' | 'cultural' | 'religious' | 'abandoned' | 'viewpoint' | 'market' | 'food' | 'other';
export type PlaceStatus = 'pending' | 'approved' | 'rejected';
export interface LatLng { lat: number; lng: number; }
export interface PlaceUser { id: number; name: string; avatar_url: string | null; }
export interface PlacePhoto { id: number; thumb_url: string; display_url: string; sort: number; }
export interface PlaceListItem {
  id: number; name: string; category: PlaceCategory; description: string;
  lat: number; lng: number; thumb_url: string | null;
  saves_count: number;
}
export interface NearbyPlace extends PlaceListItem { distance_m: number; }
export interface PlaceDetail extends PlaceListItem {
  status: PlaceStatus; user: PlaceUser; photos: PlacePhoto[];
  saved_by_me: boolean; created_at: string;
}
export interface MyPlace extends PlaceListItem { status: PlaceStatus; rejection_reason: string | null; created_at: string; }
export interface AdminPlace extends PlaceDetail { rejection_reason: string | null; }
export interface PlaceFeatureProps { id: number; name: string; category: PlaceCategory; thumb_url: string | null; }
export interface PlaceFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: PlaceFeatureProps;
}
export interface PlaceFeatureCollection { type: 'FeatureCollection'; features: PlaceFeature[]; }
export interface Paginated<T> { data: T[]; current_page: number; last_page: number; total: number; }
```

**`resources/js/Pages/Places/_lib/categories.ts`** exports:

```ts
import type { PlaceCategory } from './types';
export const CATEGORIES: { key: PlaceCategory; label: string }[] = [ /* section 11 list, in order */ ];
export const CATEGORY_LABELS: Record<PlaceCategory, string>; // derived map
```

**`resources/js/Pages/Places/_lib/api.ts`** (uses `@/lib/axios`) exports exactly:

```ts
export const api = {
  mapData(): Promise<PlaceFeatureCollection>,
  listPlaces(params: { category?: PlaceCategory; q?: string; sort?: 'newest' | 'popular'; page?: number }): Promise<Paginated<PlaceListItem>>,
  nearby(params: { lat: number; lng: number; radius_km?: number; include_pending?: boolean }): Promise<{ places: NearbyPlace[] }>,
  getPlace(id: number): Promise<PlaceDetail>,
  submitPlace(data: { name: string; category: PlaceCategory; description: string; lat: number; lng: number; photos: File[] }): Promise<{ id: number; status: 'pending' }>, // builds FormData, photos appended as photos[]
  myPlaces(page?: number): Promise<Paginated<MyPlace>>,
  mySaves(page?: number): Promise<Paginated<PlaceListItem>>,
  save(id: number): Promise<{ saved: boolean; saves_count: number }>,
  unsave(id: number): Promise<{ saved: boolean; saves_count: number }>,
  adminListPlaces(status: 'pending' | 'approved' | 'rejected' | 'all', page?: number): Promise<Paginated<AdminPlace>>,
  adminApprove(id: number): Promise<{ id: number; status: string }>,
  adminReject(id: number, reason: string | null): Promise<{ id: number; status: string }>,
  adminDeletePlace(id: number): Promise<void>,
};
export function extractError(e: unknown): string; // error.response?.data.message ?? error.response?.data.error ?? 'حدث خطأ، حاول مجدداً'
```

### 6.2 Component tree and prop contracts

```
Pages/Places/Index.tsx                                route GET /mishwar
├─ PlacesMap            _components/PlacesMap.tsx
├─ FilterBar            _components/FilterBar.tsx
├─ PlacesPanel          _components/PlacesPanel.tsx
│  ├─ PlaceCard         _components/PlaceCard.tsx
│  └─ PlaceDetailView   _components/PlaceDetailView.tsx
│     ├─ PhotoGallery   _components/PhotoGallery.tsx
│     │  └─ Lightbox    _components/Lightbox.tsx
│     └─ EngagementBar  _components/EngagementBar.tsx
└─ SubmitSheet          _components/SubmitSheet.tsx
   ├─ DuplicateSuggestions _components/DuplicateSuggestions.tsx
   └─ PhotoPicker       _components/PhotoPicker.tsx

Pages/Admin/Places/Index.tsx                          route GET /admin/places
├─ PlaceReviewCard      Pages/Admin/Places/PlaceReviewCard.tsx
└─ RejectDialog         Pages/Admin/Places/RejectDialog.tsx
```

All `_components/` files live in `resources/js/Pages/Places/_components/`. Every component below is a NAMED export matching its file name (e.g. `export function PlacesMap(...)`), except the two page `Index.tsx` files which are default exports.

**Layout (Index.tsx)**: full-viewport map (`h-[calc(100dvh-4rem)]` under the Navbar, `relative`), FilterBar floating at top center (`absolute top-3 inset-x-3 z-10 max-w-xl mx-auto`), PlacesPanel as a side panel on desktop (`absolute top-0 right-0 h-full w-96` since RTL puts the panel on the right) and a bottom sheet on mobile (fixed bottom, drag-free, two snap states via a `expanded` boolean).

**Index.tsx state ownership**: `features: PlaceFeatureCollection | null` (from `api.mapData()` on mount), `category: PlaceCategory | null`, `query: string`, `selectedId: number | null`, `addMode: boolean`, `focus: { lng: number; lat: number; zoom?: number; key: number } | null`, `highlight: LatLng | null`, `submitPoint: LatLng | null`, `submitOpen: boolean`, `listPlaces: Paginated<PlaceListItem> | null` (from `api.listPlaces`, refetched on filter change with 300ms debounce). Filtered features (category + query on `properties.name`) are computed client-side and passed to PlacesMap. After a successful submission (`onSubmitted`), show an inline `<Alert>` "تم إرسال المكان وسيظهر بعد الموافقة".

**Add-mode (explicit submission entry, replaces bare-click submit)**:
- A FAB floats over the map (primary Button, `absolute z-10`, clear of the panel, the bottom-left map controls, and the collapsed mobile sheet). Idle label: أضف مكاناً with a Plus icon. While active: إلغاء الإضافة with an X icon; pressing again cancels.
- While active, a hint chip near the top bar reads: انقر على الخريطة لتحديد الموقع. Escape cancels add-mode (window keydown listener registered only while addMode is true).
- Map clicks while addMode is false only close an open detail (`setSelectedId(null)`); they NEVER open the submit sheet. While addMode is true, a click is checked against the Syria bounds (notice النقطة خارج حدود سوريا on failure, staying in add-mode); on success `setSubmitPoint(point)`, `setSubmitOpen(true)`, `setAddMode(false)`. Pin clicks keep opening the detail and drop add-mode when it was active.
- PlacesMap shows a crosshair cursor while addMode is true, including while hovering pins.

**Deep link (`?place={id}`)**: on mount, Index parses `new URLSearchParams(window.location.search).get('place')`; if it is a positive integer: `setSelectedId(id)`, `setExpanded(true)` (opens PlaceDetailView, which does its own fetch), AND calls `api.getPlace(id)` for lat/lng, then flies the map to that point at zoom 15 once the map is ready. On 404/error: show the extractError notice and clear the selection. No URL rewriting or history syncing while users browse; the param is read once on load. The canonical producer of these URLs is the share button (EngagementBar).

**`PlacesMap`**:

```ts
export function PlacesMap(props: {
  features: PlaceFeatureCollection;         // already filtered by the parent
  selectedId: number | null;                // highlight this pin
  addMode: boolean;                         // crosshair cursor while true
  focus: { lng: number; lat: number; zoom?: number; key: number } | null; // flyTo on key change
  highlight: LatLng | null;                 // temporary marker (coordinate jump)
  onPinClick: (id: number) => void;
  onMapClick: (point: LatLng) => void;      // clicks NOT on a pin or cluster
  className?: string;
}): JSX.Element;
```

Init (mirror Transit admin Index): `useRef` container + map guard, `new maplibregl.Map({ container, style: '/styles/styles/dark-matter.json', center: [38.0, 35.0], zoom: 6.2, attributionControl: false })`, add `AttributionControl({ compact: true })` + `NavigationControl` + `GeolocateControl` bottom-left (RTL page, keep controls off the panel side). On `'load'`: `map.addSource('places', { type: 'geojson', data, cluster: true, clusterRadius: 50, clusterMaxZoom: 14 })` then three layers: `clusters` (circle, paint `circle-color` step by `point_count`: `hsl(105 15% 36%)` base, larger radius steps 15/20/25 at counts 10/30), `cluster-count` (symbol, `text-field: '{point_count_abbreviated}'`, glyphs come with the style), `place-pin` (circle, filter `['!', ['has', 'point_count']]`, `circle-radius` 7 (10 when `['==', ['get', 'id'], selectedId]` via `setPaintProperty` on selection change), `circle-color '#7d8a5c'`, `circle-stroke-width 2`, `circle-stroke-color '#ffffff'`). Cluster click: `getClusterExpansionZoom` + `easeTo`. Pin click: `onPinClick(feature.properties.id)`. Plain map click (use `queryRenderedFeatures` on the three layers; empty result means background): `onMapClick({ lng, lat })`. Feature updates via `(map.getSource('places') as maplibregl.GeoJSONSource).setData(...)`. Cleanup with guarded removeLayer/removeSource in try/catch, `map.remove()` on unmount.

Cursor: `addMode` is mirrored into a ref; an effect sets `map.getCanvas().style.cursor = addMode ? 'crosshair' : ''`. The pin mouseenter/mouseleave pointer handlers consult the ref so leaving a pin restores `'crosshair'` (not `''`) and hovering a pin during add-mode keeps `'crosshair'`.

Focus: an effect keyed on `focus.key` runs `map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 15 })`, queued until the map is ready. Highlight: a single `new maplibregl.Marker({ color: '#7d8a5c' })` at the point, removed when the prop becomes null or on unmount.

**`FilterBar`** (dual search: one input handles coordinate parsing OR db search):

```ts
export function FilterBar(props: {
  category: PlaceCategory | null;
  onCategoryChange: (c: PlaceCategory | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: PlaceListItem[];                 // db results for the dropdown (parent-fed)
  resultsLoading: boolean;
  coordCandidate: LatLng | null;            // parsed coords, null when query is not coords
  onSelectResult: (place: PlaceListItem) => void;
  onGoToCoord: (point: LatLng) => void;
  className?: string;
}): JSX.Element;

export function parseLatLng(q: string): LatLng | null;  // exported from FilterBar.tsx
```

Card-styled bar: search `Input` + horizontally scrollable category `Badge` chips from `CATEGORIES` plus a "الكل" chip for null.

- `parseLatLng` accepts 'LAT, LNG' or 'LAT LNG' (comma and/or whitespace separated, optional surrounding whitespace, decimals optional, leading minus allowed): regex `/^\s*(-?\d{1,3}(?:\.\d+)?)[\s,]+(-?\d{1,3}(?:\.\d+)?)\s*$/` then range-check lat in [-90,90], lng in [-180,180]; null otherwise.
- When `coordCandidate` is non-null the dropdown shows one action row الانتقال إلى النقطة (MapPin icon, coords echoed in a `dir="ltr"` span); activating it calls `onGoToCoord`.
- Otherwise, when the query is non-empty the dropdown (absolute under the input, z above the map, Card style, aligned to the input width) lists up to 8 results: thumb-less rows with name + category Badge (`CATEGORY_LABELS`). Click calls `onSelectResult(place)`. Empty state لا توجد نتائج, spinner row while `resultsLoading`.
- Keyboard: ArrowDown/ArrowUp move the active row (visual ring/bg-accent), Enter activates it, Escape closes the dropdown and blurs. `role="listbox"`/`role="option"` + `aria-activedescendant`. RTL correct: rows `text-right`.
- Index feeds `results` from the existing debounced `api.listPlaces` fetch (`slice(0, 8)` of `listPlaces.data` when the query is non-empty), `resultsLoading` = the list loading flag, `coordCandidate = parseLatLng(query)`.
- `onSelectResult`: `setSelectedId(place.id)`, `setExpanded(true)`, `setFocus({ lng, lat, zoom: 15, key: ++n })`; FilterBar closes its own dropdown on select. `onGoToCoord`: `setFocus({ lng, lat, zoom: 15, key: ++n })` and `setHighlight(point)`; the highlight clears after ~6s (timeout, cleared on the next jump).

**`PlacesPanel`**:

```ts
export function PlacesPanel(props: {
  places: PlaceListItem[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;  // null closes the detail
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
}): JSX.Element;
```

When `selectedId` is null: scrollable PlaceCard list + "عرض المزيد" button. When set: renders `PlaceDetailView` with a back button calling `onSelect(null)`.

For logged-in users (`useAuth()`), the panel header shows `Tabs`: الأماكن (the props-driven list above), محفوظاتي (self-contained, fetches `api.mySaves`, rows are PlaceCard), مساهماتي (self-contained, fetches `api.myPlaces`, rows are PlaceCard plus a status `Badge` and, when rejected, the `rejection_reason` text). Guests see only the main list, no tabs.

**`PlaceCard`**: `export function PlaceCard(props: { place: PlaceListItem; onClick: (id: number) => void }): JSX.Element;` Thumb `<img loading="lazy">` (fallback to a category icon block on error/null), name, category label badge, a single Bookmark + `saves_count` counter.

**`PlaceDetailView`**: `export function PlaceDetailView(props: { placeId: number; onClose: () => void }): JSX.Element;` Self-contained: fetches `api.getPlace(placeId)` on mount/id change, loading skeleton, then PhotoGallery, name + category badge, description, contributor row (`Avatar` with `avatar_url`, name), EngagementBar (only when `place.status === 'approved'`, remounted via `key={place.id}`). Coordinates shown as `<span dir="ltr">{lat.toFixed(5)}, {lng.toFixed(5)}</span>` with a copy button (transient icon swap on success).

**`PhotoGallery`**: `export function PhotoGallery(props: { photos: PlacePhoto[]; name: string }): JSX.Element;` Main image shows `display_url` of the active photo (`loading="lazy"`, `decoding="async"`), thumb strip uses `thumb_url` (`loading="lazy"`), active thumb ring `ring-2 ring-primary`. Clicking the main image opens the `Lightbox` with `index` = the active thumb.

**`Lightbox`**:

```ts
import type { PlacePhoto } from '../_lib/types';

export function Lightbox(props: {
  photos: PlacePhoto[];      // ordered as in PlaceDetail.photos
  name: string;              // place name, used for alt text and download filenames
  index: number;             // photo to show when opened
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element;
```

- Full screen: Dialog from the ui kit with a DialogContent stretched to the viewport (e.g. `max-w-none h-dvh w-screen bg-background/95 p-0 border-0`), `dir="rtl"`, DialogTitle sr-only. ESC closes (Dialog default). Current image: `display_url`, object-contain, max dimensions inside the viewport, `loading="eager" decoding="async"`, wrapped so pinch/scroll zoom on mobile does not break layout (`touch-action: pinch-zoom` on the image container, overflow hidden on the shell).
- Prev/next buttons, RTL-aware: the on-screen RIGHT button goes to the PREVIOUS photo (aria-label الصورة السابقة, ChevronRight icon) and the LEFT button to the NEXT photo (aria-label الصورة التالية, ChevronLeft icon). Keyboard: ArrowRight = previous, ArrowLeft = next (matches RTL reading direction). No wraparound; disabled at the ends. Hidden when `photos.length === 1`.
- Counter centered, `dir="ltr"`, format `${current + 1}/${photos.length}` (e.g. 3/5).
- Download current: Button with Download icon, label تحميل. `fetch(display_url)` -> blob -> `URL.createObjectURL` -> temp `<a download={`${name}-${current + 1}.webp`}>` click -> revokeObjectURL.
- Bulk: Button label تحميل الكل, sequential await of the same routine over all photos (no zip), disabled + Loader2 spinner + label جارٍ التحميل while running; inline destructive text تعذر تحميل الصورة if any fetch fails (continue with the rest).
- Internal current-photo state initialized from `props.index` on each open.

**`EngagementBar`**: three actions in one RTL row.

```ts
export function EngagementBar(props: {
  placeId: number;
  placeName: string;
  lat: number;
  lng: number;
  initialSaved: boolean;
  initialSaves: number;
}): JSX.Element;
```

1. Save toggle: optimistic save/unsave (Bookmark icon + `dir="ltr"` count). Guests get the inline link تسجيل الدخول للتفاعل -> `/auth/google`. Saving is the only auth-gated action; share and Google Maps are not.
2. Share button (outline sm, Share2 icon, label مشاركة). onClick builds the canonical share URL `` `${window.location.origin}/mishwar?place=${placeId}` ``. If `navigator.share` exists: `navigator.share({ title: placeName, url })`, swallowing AbortError. Else `navigator.clipboard.writeText(url)` with transient (1.5s) inline feedback swapping the label/icon to Check + تم نسخ الرابط; on clipboard failure show تعذر نسخ الرابط (destructive text, transient).
3. Google Maps: an anchor styled as an outline sm button, ExternalLink icon, label افتح في خرائط جوجل, `href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}`, `target="_blank" rel="noopener noreferrer"`.

PlaceDetailView passes: `placeId=place.id`, `placeName=place.name`, `lat=place.lat`, `lng=place.lng`, `initialSaved=place.saved_by_me`, `initialSaves=place.saves_count`.

**`SubmitSheet`**:

```ts
export function SubmitSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: LatLng | null;                 // the point picked in add-mode; null renders nothing
  onSubmitted: (id: number) => void;
  onSelectExisting: (id: number) => void; // user picked a duplicate suggestion; parent opens its detail
}): JSX.Element;
```

Uses `Sheet` with `side="bottom"` on mobile and `side="left"` on desktop (panel is on the right), `dir="rtl"`. Internal step state: `'auth' | 'duplicates' | 'form' | 'done'`. Step auth: if `!user` (from `useAuth()`), show the Google login link and stop. Step duplicates: on open, call `api.nearby({ lat, lng, radius_km: 0.25, include_pending: true })`; if any results render `DuplicateSuggestions`, else skip to form. Step form: name Input, category Select from `CATEGORIES`, description Textarea (counter, min 20 max 1000), read-only coordinates line (`dir="ltr"`), `PhotoPicker`. Client validation before `api.submitPlace`; errors via `extractError` in a destructive `Alert`. Step done: success message + close button. Calls `onSubmitted(id)` then `onOpenChange(false)` on close.

**`DuplicateSuggestions`**:

```ts
export function DuplicateSuggestions(props: {
  places: NearbyPlace[];
  onSelectExisting: (id: number) => void;
  onContinue: () => void;               // "my place is different"
}): JSX.Element;
```

Title: يوجد أماكن قريبة من النقطة المحددة. Rows: thumb, name, `<span dir="ltr">` distance in meters. Buttons: هذا هو المكان (per row, onSelectExisting) and مكاني مختلف، متابعة (onContinue).

**`PhotoPicker`**:

```ts
export function PhotoPicker(props: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;                          // default 10
}): JSX.Element;
```

Hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`, preview grid via `URL.createObjectURL` (revoke on cleanup), per-file remove button, client-side rejects files over 12MB or beyond max with an inline destructive Alert.

### 6.3 Admin page

`Pages/Admin/Places/Index.tsx` (default export): MainLayout, status filter `Select`, paginated review list via `api.adminListPlaces` as the page body (no tabs). Renders `PlaceReviewCard` per place. Follows the Transit admin pattern: refetch after each action, counts row at top (client-side from `total`).

```ts
// Pages/Admin/Places/PlaceReviewCard.tsx
export function PlaceReviewCard(props: {
  place: AdminPlace;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;   // opens RejectDialog in the parent
  onDelete: (id: number) => void;
}): JSX.Element;
// Shows photos (thumb strip with lightbox-free <img>), name, category, description,
// contributor, coordinates (dir="ltr") with an OpenStreetMap link
// https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=17/{lat}/{lng},
// status badge, rejection_reason when rejected.

// Pages/Admin/Places/RejectDialog.tsx
export function RejectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string | null) => void; // trimmed, empty -> null
}): JSX.Element;
```

## 7. MODERATION

Imitates the Transit RouteDraft lifecycle exactly: statuses are plain strings, only creatable state is `pending`, transitions `pending -> approved` and `pending -> rejected` are terminal, both guarded with a 400 "Place is already {status}". Rejection reason is nullable text shown to admins AND to the submitter via `GET /api/v1/my/places`. Approve/delete bust the `places:map` cache. Spam defenses: throttles per section 5, `is_banned` guard on submit, server-side validation on everything, the unique constraint makes save idempotent. Existing `POST /api/admin/users/{id}/toggle-ban` covers banning abusers; do not rebuild it (it sits under the `transit_admin` middleware, which also passes roles admin and superadmin, so place moderators can use it).

## 8. FILE MANIFEST

Backend:
- `database/migrations/2026_07_15_1000NN_*` (six creates, immutable history) and `database/migrations/2026_07_16_2000NN_*` (four drops: place_likes, place_comments, place_reports, and the likes_count/comments_count columns)
- `app/Models/Place.php`, `app/Models/PlacePhoto.php`, `app/Models/PlaceSave.php`
- `database/factories/PlaceFactory.php`, `database/factories/PlacePhotoFactory.php`
- `app/Services/PlaceImageService.php`
- `app/Http/Controllers/PlaceController.php` (renderIndex, mapData, index, nearby, show, store, mine)
- `app/Http/Controllers/PlaceEngagementController.php` (save, unsave, mySaves)
- `app/Http/Controllers/PlaceAdminController.php` (renderIndex, index, approve, reject, destroy)
- Routes: the places block in `routes/api.php` (public reads) and `routes/web.php` (page routes, authed writes, admin moderation)

Frontend:
- `resources/js/Pages/Places/_lib/types.ts`, `_lib/categories.ts`, `_lib/api.ts`
- `resources/js/Pages/Places/Index.tsx`
- `resources/js/Pages/Places/_components/`: PlacesMap, FilterBar, PlacesPanel, PlaceCard, PlaceDetailView, PhotoGallery, Lightbox, EngagementBar, SubmitSheet, DuplicateSuggestions, PhotoPicker
- `resources/js/Pages/Admin/Places/`: Index.tsx, PlaceReviewCard.tsx, RejectDialog.tsx

Tests:
- `tests/Feature/PlacesTest.php` (map geojson shape, list + filters + search + popular-by-saves sort + pagination, removed-counter leak guards, nearby distance ordering + include_pending, show visibility rules, submit happy path + validation + quota, my/places, `/mishwar?place=` page renders)
- `tests/Feature/PlacesEngagementTest.php` (save/unsave idempotency + counts, approved-only targets, guest 401s, my saves content + save-time ordering, removed endpoints 404)
- `tests/Feature/PlacesAdminTest.php` (non-admin 403, pending list, approve, reject with reason, double-approve 400, delete removes files and rows, cache bust assertions)

## 9. URL + NAMING

- Public URL: `/mishwar` (legacy `/places` redirects). Share/deep-link URL: `/mishwar?place={id}`. Admin URL: `/admin/places`. API namespace: `/api/v1/places`, `/api/v1/my/*`, `/api/v1/admin/places`.
- Arabic section title: أماكن خفية. Page `<title>`: أماكن خفية (template appends "- Syrian Zone").
- Page dirs: `resources/js/Pages/Places/`, `resources/js/Pages/Admin/Places/`.
- Controllers: `PlaceController`, `PlaceEngagementController`, `PlaceAdminController`. Models: `Place`, `PlacePhoto`, `PlaceSave`. Service: `PlaceImageService`.
- Cache key: `places:map`. Storage dir: `places/{place_id}/`.

## 10. NON-GOALS (do not build these)

- No likes, comments, or reports: removed from the product entirely (endpoints 404, tables dropped).
- No draft saving. Owners edit via the `/api/v1/my/*` management endpoints above; every content edit re-enters moderation.
- No follower or social features, no guide profile pages (leaderboard rows are not links), no guide sorts beyond submissions/saves/recent.
- No photo captions.
- No email/push notifications on rejection or approval (my/places stays the pull-based feedback channel).
- No coordinate-uniqueness constraints; the duplicate step in SubmitSheet is advisory only.
- No transit map changes beyond metadata notes in the shared style files.
- No EXIF GPS extraction, no external geocoder or address search; coordinate parsing is the only non-db search.
- No URL/history syncing while browsing beyond the initial `?place=` read and the `?view=grid` toggle (written with `history.replaceState`, read once on load).
- No zip bundling for تحميل الكل; sequential downloads are fine.
- No offline/PWA-specific behavior, no service worker changes.
- No English i18n, no i18n library.
- No user profile pages or follower systems (the guides leaderboard is the only ranking surface).
- No admin map view, no bulk moderation, no audit log.
- No uploadthing or bespoke upload services: media goes to the `MEDIA_DISK` filesystem disk (`public` locally, `r2` on Cloudflare R2 in production via the S3 driver).
- No spatial DB features, no Scout search indexing (LIKE is enough at this scale).
- No changes to `public/sw.js`, `bootstrap/app.php`, or middleware aliases.

## 11. CATEGORIES (fixed, ordered; keys are stable ascii, stored verbatim in `places.category`)

| key | Arabic label |
|---|---|
| historical | تاريخي |
| natural | طبيعي |
| cultural | ثقافي |
| religious | ديني |
| abandoned | مهجور |
| viewpoint | إطلالة |
| market | سوق |
| food | مأكولات |
| other | آخر |

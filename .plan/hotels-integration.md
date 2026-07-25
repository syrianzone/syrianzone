# HalaSyria Hotels Integration in /mishwar

## Overview

Integrate HalaSyria hotel data into the existing /mishwar places section. Hotels appear alongside regular places on the map but with a distinct color, and open a dedicated hotel detail view showing price, images, star rating, and a link back to the source site. Data is cached locally for 2 days to avoid repeated external API calls.

---

## 1. Database

### New migration: `hotels` table

```
hotels
──────
id                  bigint PK (auto-increment)
hala_syria_id       uuid (unique, indexed) — the remote ID from HalaSyria
name                varchar(255)
name_ar             varchar(255)
city                varchar(100) (indexed)
city_ar             varchar(100)
city_slug           varchar(100)
slug                varchar(255) (unique, indexed)
lat                 decimal(10,7)
lng                 decimal(10,7)
star_rating         tinyint (nullable)
rating              decimal(3,1) (nullable)
review_count        int (default 0)
now_show_rate       decimal(10,2) (nullable) — nightly USD price
currency            varchar(5) (default 'USD')
address             varchar(500) (nullable)
address_ar          varchar(500) (nullable)
phone               varchar(50) (nullable)
email               varchar(255) (nullable)
description         text (nullable)
description_ar      text (nullable)
images              json — array of image URLs from HalaSyria
has_restaurant      boolean (default false)
has_swimming_pool   boolean (default false)
has_spa             boolean (default false)
has_fitness_center  boolean (default false)
has_parking         boolean (default false)
has_airport_shuttle boolean (default false)
has_bar             boolean (default false)
has_room_service    boolean (default false)
source_url          varchar(1000) — computed: https://halasyria.com/hotel/{slug}
last_synced_at      timestamp (nullable) — when we last fetched from HalaSyria
created_at          timestamp
updated_at          timestamp
```

**Indexes:** `[lat, lng]`, `city`, `slug`, `hala_syria_id` (unique)

### Why cache in DB instead of Laravel Cache?

- 2-day TTL in DB cache means the data survives cache clears, deploys, reboots
- DB is the source of truth; we can query hotels alongside places in a unified way
- We can track `last_synced_at` per hotel for incremental refresh
- Laravel `Cache::` is used for the merged map GeoJSON (short TTL, 5 min) — same pattern as places

---

## 2. Backend

### Model: `App\Models\Hotel`

- Eloquent model for `hotels` table
- Cast `images` to `array`, `now_show_rate` to `float`
- Accessor `source_url` that returns `https://halasyria.com/hotels/{city_slug}/{slug}`

### Service: `App\Services\HalaSyriaService`

Responsibilities:
1. `fetchAll()` — fetches all visible hotels from the HalaSyria Supabase REST API
2. `sync()` — upserts fetched hotels into local `hotels` table, sets `last_synced_at`
3. `needsSync()` — checks if `last_synced_at` is older than 2 days (or null)

Key implementation details:
- Uses `Http::withHeaders()` with the API key from `config('services.halasyria.api_key')`
- Base URL: `https://cfooumftuesvlmphgyhb.supabase.co/rest/v1/hotels`
- Query param: `select=*&visible=eq.true`
- Paginates if needed (the API supports limit/offset, but the dataset is ~73 hotels so one request suffices)
- Maps HalaSyria fields to our local columns
- Computes `source_url` as `https://halasyria.com/hotels/{city_slug}/{slug}`

### Artisan Command: `App\Console\Commands\SyncHalaSyriaHotels`

- `php artisan hotels:sync` — manually triggers a sync
- Used by the scheduler and can be run manually

### Scheduler: `Console\Kernel`

```php
$schedule->command('hotels:sync')->dailyAt('03:00');
```

Or since we want ~2 day cache:
```php
$schedule->command('hotels:sync')->everyTwoDays()->at('03:00');
```

### Config

Add to `config/services.php`:
```php
'halasyria' => [
    'api_key' => env('HALASYRIA_API'),
    'base_url' => 'https://cfooumftuesvlmphgyhb.supabase.co/rest/v1',
],
```

---

## 3. API Endpoints

### `GET /api/v1/hotels/map` — GeoJSON for the map

Returns a GeoJSON FeatureCollection, same shape as places but with extra properties:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [36.28, 33.51] },
      "properties": {
        "id": 42,
        "name": "Four Seasons Hotel Damascus",
        "name_ar": "فور سيزونز دمشق",
        "type": "hotel",
        "star_rating": 5,
        "now_show_rate": 150.00,
        "city": "Damascus",
        "city_ar": "دمشق",
        "thumb_url": "https://...",
        "slug": "four-seasons-hotel"
      }
    }
  ]
}
```

The `type: "hotel"` property distinguishes hotels from places (`type: "place"`).

Cached in Laravel Cache for 5 minutes (same as places), with `Cache-Control: public, max-age=60`.

**Approach:** Merge hotels into the existing `places:map` cache OR create a separate `hotels:map` cache key. I recommend **separate** — cleaner, independent refresh cycles. The frontend fetches both and merges client-side.

### `GET /api/v1/hotels` — Paginated list

Query params: `city`, `q`, `min_stars`, `max_price`, `page`

### `GET /api/v1/hotels/{id}` — Full hotel detail

Returns all fields + photos, source_url, etc.

---

## 4. Frontend

### Types (`resources/js/Pages/Places/_lib/types.ts`)

Add:
```typescript
export interface HotelListItem {
  id: number;
  name: string;
  name_ar: string;
  city: string;
  city_ar: string;
  slug: string;
  lat: number;
  lng: number;
  star_rating: number | null;
  now_show_rate: number | null;
  currency: string;
  thumb_url: string | null;
  source_url: string;
}

export interface HotelDetail extends HotelListItem {
  description: string | null;
  description_ar: string | null;
  address: string | null;
  address_ar: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  review_count: number;
  images: string[];
  has_restaurant: boolean;
  has_swimming_pool: boolean;
  has_spa: boolean;
  has_fitness_center: boolean;
  has_parking: boolean;
  has_airport_shuttle: boolean;
  has_bar: boolean;
  has_room_service: boolean;
  source_url: string;
}

export interface HotelFeatureProps {
  id: number;
  name: string;
  name_ar: string;
  type: 'hotel';
  star_rating: number | null;
  now_show_rate: number | null;
  city: string;
  city_ar: string;
  thumb_url: string | null;
  slug: string;
}

export interface HotelFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: HotelFeatureProps;
}
```

### API Client (`resources/js/Pages/Places/_lib/api.ts`)

Add:
```typescript
async hotelMapData(): Promise<PlaceFeatureCollection> {
  const { data } = await axios.get(`${base}/hotels/map`);
  return data;
},

async getHotel(id: number): Promise<HotelDetail> {
  const { data } = await axios.get(`${base}/hotels/${id}`);
  return data;
},
```

### Map (`PlacesMap.tsx`)

Add a **second GeoJSON source** for hotels with a separate layer:

- Source ID: `hotels`
- Layer: `hotel-pin` — circle layer, color `#c05621` (ember) with white stroke
- Selected hotel pin: larger radius (9 vs 6), same as places
- Same clustering config as places

The map component accepts both `features` (places) and `hotelFeatures` (hotels) as props.

**Pin color rationale:** Ember (`#c05621`) is warm and distinct from the olive green (`#7d8a5c`) of regular places. Visible on both light and dark basemaps. Evokes warmth/hospitality without clashing with the existing palette.

### Index Page (`Index.tsx`)

- Fetch hotel map data alongside place map data on mount
- Merge both FeatureCollections into one for filtering, or keep separate and render both sources
- Pass `hotelFeatures` to `PlacesMap`
- When a hotel pin is clicked, open the hotel detail view (not the place detail view)

### Hotel Detail View (`HotelDetailView.tsx`)

New component, similar structure to `PlaceDetailView` but with:

- **Image carousel** at the top (using images from the hotel data)
- **Hotel name** (Arabic primary, English secondary)
- **Star rating** shown as stars
- **Price** displayed prominently (e.g., "$150 / ليلة")
- **City/location** with coordinates
- **Amenities** as badges (pool, restaurant, spa, etc.)
- **Description** text
- **"Visit on HalaSyria"** button — links to `source_url` with credit text: "بيانات من HalaSyria"
- **Mini map** showing the hotel location (reuse MapLibre, read-only, no interaction)

### Hotel Card (`HotelCard.tsx`)

For the panel list view, a card similar to `PlaceCard` but showing:
- Hotel thumbnail
- Hotel name
- Star rating (stars icon)
- Price (if available)
- City name

### Panel Integration

Hotels appear **only** in a dedicated "الفنادق" tab in `PlacesPanel`. The tab grid becomes 3 columns (or 5 if user is logged in): الأماكن | الفنادق | (محفوظاتي) | (مساهماتي) | مرشدون.

The Hotels tab shows:
- A city filter dropdown at the top (optional, to filter by city)
- Paginated list of `HotelCard` components
- Clicking a card opens the `HotelDetailView` in the side panel (same slot as `PlaceDetailView`)

---

## 5. File Changes Summary

| File | Action |
|------|--------|
| `database/migrations/XXXX_create_hotels_table.php` | **Create** — migration |
| `app/Models/Hotel.php` | **Create** — Eloquent model |
| `app/Services/HalaSyriaService.php` | **Create** — fetch + sync service |
| `app/Console/Commands/SyncHalaSyriaHotels.php` | **Create** — artisan command |
| `app/Console/Kernel.php` | **Edit** — add schedule |
| `config/services.php` | **Edit** — add halasyria config |
| `app/Http/Controllers/HotelController.php` | **Create** — API endpoints |
| `routes/api.php` | **Edit** — add hotel routes |
| `.env` / `.env.example` | **Edit** — add `HALASYRIA_API` |
| `resources/js/Pages/Places/_lib/types.ts` | **Edit** — add hotel types |
| `resources/js/Pages/Places/_lib/api.ts` | **Edit** — add hotel API methods |
| `resources/js/Pages/Places/_components/PlacesMap.tsx` | **Edit** — add hotel pins layer |
| `resources/js/Pages/Places/_components/HotelDetailView.tsx` | **Create** — hotel detail view |
| `resources/js/Pages/Places/_components/HotelCard.tsx` | **Create** — hotel list card |
| `resources/js/Pages/Places/_components/PlacesPanel.tsx` | **Edit** — add hotels tab/toggle |
| `resources/js/Pages/Places/Index.tsx` | **Edit** — fetch hotels, wire up hotel selection |

---

## 6. Data Flow

```
HalaSyria API ──► SyncHalaSyriaHotels ──► hotels table (2-day cache)
                                              │
                                              ▼
                                         HotelController::mapData()
                                              │
                                              ▼
                                         Cache::remember('hotels:map', 300)
                                              │
                                              ▼
                                         GET /api/v1/hotels/map
                                              │
                                              ▼
                                         PlacesMap (hotel-pin layer, ember)
                                              │
                                              ▼
                                         HotelDetailView (price, images, link)
```

---

## 7. Edge Cases

- **HalaSyria API down:** Last cached data remains in DB, map shows stale hotels with a note
- **Hotel removed from HalaSyria:** Soft-delete or mark as `visible=false` during sync
- **Missing images:** Fall back to a generic hotel placeholder icon
- **Null price:** Show "السعر غير متوفر" (Price unavailable)
- **City name inconsistencies:** Normalize during sync (trim, consistent casing)
- **Rate limiting:** HalaSyria API has 500 req/month on free tier — caching for 2 days = ~15 calls/month, well within limits

---

## 8. Resolved Decisions

- **Source URL:** `https://halasyria.com/hotels/{city_slug}/{slug}`
- **Pin color:** Ember (`#c05621`)
- **Detail view:** Side panel (same slot as place detail)
- **Panel integration:** Dedicated "الفنادق" tab only, not mixed with places

## 9. Implementation Order

1. Migration + Model + Config + .env
2. HalaSyriaService + Artisan Command + Scheduler
3. HotelController + API routes
4. Frontend types + API client
5. PlacesMap hotel layer (gold pins)
6. HotelCard + HotelDetailView
7. PlacesPanel integration (hotels tab)
8. Index.tsx wiring (fetch hotels, selection state)
9. Test end-to-end

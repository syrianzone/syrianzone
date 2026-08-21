# Directory Modules — SyOfficial, Phonebook, Gov Apps, Hotels

Four read-mostly directory modules sharing the same pattern: string-ID keyset tables with bilingual labels, `order_column` manual reordering, `is_active` toggles, and a role-gated Inertia admin page backed by `/api/v1/admin/*` CRUD endpoints.

## SyOfficial (الحسابات الرسمية السورية)

Route `/syofficial` · Pages/SyOfficial · Controllers: `SyOfficialController`, `SyOfficialAdminController`

- **official_categories** — string id (`governorates`, …), label_ar/en, icon, order_column, is_active
- **official_entities** — string id (`gov-damascus`, …), category_id FK, name/name_ar, descriptions, image, socials JSON, order_column, is_active
- Entity images hosted on R2 under `syofficial/entities/` (see [reference/asset-storage.md](../reference/asset-storage.md))
- Kurdish translation of the page contributed by haiueida
- Admin: categories/entities CRUD + reorder under `/api/v1/admin/syofficial/*`; admin role alias `syofficial_admin`

## Phonebook

Route `/phonebook` · Pages/Phonebook · Controllers: `PhonebookController`, `PhonebookAdminController`

- **phonebook_categories** — id key (`emergency`, `embassies`, …), label_ar/en, icon, order_column, is_active
- **phonebook_entries** — category_id, name_ar/en, number, is_whatsapp flag, source_url citation, order_column, is_active
- Admin: CRUD + toggle active + reorder under `/api/v1/admin/phonebook/*`; role alias `phonebook_admin`
- Every entry carries a `source_url` so numbers remain verifiable

## Gov Apps

Route `/govapps` · Pages/GovApps · Controllers: `GovAppController`, `GovAppsAdminController`

- **gov_apps** — string id, name/name_ar, descriptions, icon, images JSON, links JSON (multi-platform store links), order_column, is_active, soft deletes
- Catalog inspired by f3alia.com; icons proxied via `GET /api/app-icon` (iTunes Lookup / Play Store scraping, 24h cache)
- Admin: CRUD + reorder under `/api/v1/admin/govapps`; role alias `GovAppsAdmin`

## Hotels (HalaSyria)

API-only module consumed inside the Mishwar map (Pages/Places hotel layer). Controller: `HotelController` + `App\Services\HalaSyriaService`.

- **hotels** — hala_syria_id UUID unique, names/city bilingual, slug, lat/lng indexed, star_rating, rating, review_count, now_show_rate, currency, address, phone/email, descriptions, images JSON, amenity booleans (restaurant/pool/spa/fitness/parking/shuttle/bar/room_service), source_url, last_synced_at
- Synced from halasyria.com every 2 days via scheduled command; read endpoints: `GET /api/v1/hotels/map`, `/hotels`, `/hotels/{id}`

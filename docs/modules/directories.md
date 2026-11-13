# Directory Modules — SyOfficial, Phonebook, Gov Apps, Hotels

Four read-mostly directory modules sharing the same pattern: string-ID keyset tables with bilingual labels, `order_column` manual reordering, `is_active` toggles, and a capability-gated Inertia admin page backed by `/api/v1/admin/*` write routes.

The three admin panels above are Inertia pages, so their write routes answer one way: validate, write, `redirect()->back()` with an Arabic `success` flash. A validation failure is the standard `422` envelope, which the Inertia form renders on its field.

All three validate in the controller and delegate to a transport-free service
(`SyOfficialDirectoryService`, `PhonebookDirectoryService`, `GovAppService`)
that owns ids, per-category ordering, cache invalidation and the
`{orders: [{id, order_column}]}` reorder payload the shared `SortableList`
posts — the same rule cannot diverge between the dashboard and the agent tools.

## SyOfficial (الحسابات الرسمية السورية)

Route `/syofficial` · Pages/SyOfficial · Controllers: `SyOfficialController`, `SyOfficialAdminController`

- **official_categories** — string id (`governorates`, …), label_ar/en, icon, order_column, is_active
- **official_entities** — string id (`gov-damascus`, …), category_id FK, name/name_ar, descriptions, image, order_column, is_active
- `socials` is a **platform-keyed map** (`{"facebook": "https://…", "telegram_secondary": "…"}`), never a list: the public tile resolves the icon and label from the key, and the admin form reads it back by key. The vocabulary is `resources/data/social-platforms.json` (`Facts::socialPlatforms()` / `Domain/syofficial/social.ts`); a list-shaped payload is refused, and `php artisan syofficial:repair-socials` rewrites rows an older write path flattened.
- Entity images hosted on R2 under `syofficial/entities/` (see [reference/asset-storage.md](../reference/asset-storage.md))
- Kurdish translation of the page contributed by haiueida
- Admin: categories/entities CRUD + reorder under `/api/v1/admin/syofficial/*`; capability middleware alias `syofficial_admin`

## Phonebook

Route `/phonebook` · Pages/Phonebook · Controllers: `PhonebookController`, `PhonebookAdminController`

- **phonebook_categories** — id key (`emergency`, `embassies`, …), label_ar/en, icon, order_column, is_active
- **phonebook_entries** — category_id, name_ar/en, number, is_whatsapp flag, source_url citation, order_column, is_active
- Admin: CRUD + toggle active + reorder under `/api/v1/admin/phonebook/*`; capability middleware alias `phonebook_admin`
- Every entry carries a `source_url` so numbers remain verifiable

## Gov Apps

Route `/govapps` · Pages/GovApps · Controllers: `GovAppController`, `GovAppsAdminController`

- **gov_apps** — string id, name/name_ar, descriptions, icon, images JSON, links JSON (multi-platform store links), order_column, is_active, soft deletes
- Catalog inspired by f3alia.com; icons proxied via `GET /api/app-icon` (iTunes Lookup / Play Store scraping, 24h cache)
- Admin: CRUD + reorder under `/api/v1/admin/govapps`; capability middleware alias `govapps_admin`

## Hotels (HalaSyria)

API-only module consumed inside the Mishwar map (Pages/Places hotel layer). Controller: `HotelController` + `App\Services\HalaSyriaService`.

- **hotels** — hala_syria_id UUID unique, names/city bilingual, slug, lat/lng indexed, star_rating, rating, review_count, now_show_rate, currency, address, phone/email, descriptions, images JSON, amenity booleans (restaurant/pool/spa/fitness/parking/shuttle/bar/room_service), source_url, last_synced_at
- Synced from halasyria.com every 2 days via scheduled command; read endpoints: `GET /api/v1/hotels/map`, `/hotels`, `/hotels/{id}`

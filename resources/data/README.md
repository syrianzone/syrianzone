# `resources/data` — the shared facts

One machine-readable file per fact about the domain. **Edit a value here, and
nowhere else.** Both languages read these files:

- PHP: `App\Support\Facts` (`app/Support/Facts.php`) reads
  `resource_path('data/<name>.json')`.
- TypeScript: the thin modules under `resources/js/Domain/**` import the JSON
  and export typed values and lookups (`Domain/geography/governorates.ts`,
  `Domain/places/categories.ts`, …). Import the module, never the JSON. Facts the
  app shell needs (the site-module catalogue, the icon drawings) live in
  `resources/js/Lib` for the same reason: `Lib/siteModules.ts`,
  `Lib/projectIcons.tsx`.

The files are copied into the production image by `Dockerfile` (`COPY . .`), so
`resource_path()` resolves them there exactly as it does in development.

| File | What it is | Read by |
|---|---|---|
| `governorates.json` | The fourteen Syrian governorates: id, Arabic/English name, spelling aliases, centre coordinates, pcode, ordering, and the per-consumer ids (F3alia province, transit SVG basename). | `App\Support\Facts`, `App\Support\Governorates`, `PrayerController`, `WeatherController`, `EventsController`, `GovernorateIconService`; `Domain/geography/governorates.ts` |
| `syria.json` | Country-level constants: the bounding box every place coordinate must fall inside, the ISO country code, the national timezone. | `App\Services\Places\PlaceRules` (via `Facts`), `PoiSearchController`, `PrayerController`, `Promise`; `Domain/geography/syria.ts` |
| `places.json` | Mishwar place categories (key, Arabic label, card glyph), moderation statuses, and the nearby-search radius default/bounds. | `PlaceRules`, `PlacePreview`; `Domain/places/categories.ts` |
| `promises.json` | Promise statuses and the display metadata per state (label, card glyph, card tone, badge variant, text tone). | `Promise`, `PromisePreview`; `Domain/promises/status.ts` (`types.ts` holds the compile-time key list that is checked against it) |
| `polls.json` | The core ("best ministers") poll slug, the default timezone new polls get, and `min_selections` — the fewest ranked candidates a ballot may name. | `Poll`, `PollPreview`, `SitemapBuilder`, `PollController`, `VotingService` (via `Facts::polls()`), `config/services.php`; `Domain/polls/core.ts` (`MIN_SELECTIONS`) |
| `prayer.json` | The AlAdhan calculation methods: `default_method`, the twelve `methods` the pickers offer in display order (id, Arabic/English name, degree detail), and `unlisted_method_ids` — ids the timings endpoint also accepts so an account that stored one is not silently reset. | `App\Support\Facts::prayer()`, `PrayerController`; `Domain/prayer/methods.ts` |
| `transit.json` | Transit constants: the `color_index` ceiling and the nearby-stops radius (metres). | `TransitAdminController`, `TransitImportController`, `TransitStudioController`, `Api\V1\TransitController`; `Domain/transit/limits.ts` |
| `games.json` | The game hub registry: slug, title, link overrides and flags. Icons stay in `Domain/games/games.ts` because a React component cannot live in JSON. | `Domain/games/games.ts`; `SitemapBuilder` |
| `social-platforms.json` | The social-link vocabulary of official entities (key, Arabic/English label), in display order. | `Domain/syofficial/social.ts` |
| `seo.json` | The public page table: one record per path (title, description, share card, og:type, JSON-LD type, breadcrumb parent, sitemap `priority`/`changefreq` with `"sitemap": false` as the opt-out) and the `non_pages` route list. | `App\Support\Seo\Pages` (also the sitemap through `sitemapPages()`), `SeoMeta`, `Og\StaticCards`; `scripts/og` |
| `site.json` | The canonical site host used for sitemaps, share links and post footers. | `SitemapWriter`, `TierlistPostText`, `config/seo.php` |
| `media.json` | The public base URL of the media store (Cloudflare R2) that stored file names are served from. A deployment overrides it with `R2_PUBLIC_URL` / `R2_URL`. | `Facts::media()` (`SyOfficialPresenter`, `geojson:upload-to-r2`); `Domain/govapps/media.ts` |
| `site-popup.json` | The homepage "unblock Syria" popup defaults (copy, link, version). The stored DB row overrides them. | `SiteSetting::defaults()`, `Domain/settings/popup.ts` |
| `site-modules.json` | The site-module catalogue: every navigation entry (id, title, subtitle, href, target, icon key, sub-entries), its search copy, the layout flags (`fullBleedPrefixes`, `navbarSticky`), and the dashboard's admin cards with their capability gate. The stored `site_navigation` row is an override of the navigation half. | `SiteSetting::defaultNavigationItems()`, `SiteNavigationAdminController`; `Lib/siteModules.ts` (through `Lib/siteLinks.ts`, `Lib/routes.ts`, `Navbar`, `GlobalSearch`, `Dashboard`) |
| `project-icons.json` | One drawing per icon key (`viewBox` + SVG body, or an `alias` of another key). Paint is the Tailwind class string the icon was drawn with; the Blade component resolves it to attributes because the Filament panel does not scan the app stylesheet. | `Facts::projectIcons()` (`<x-project-icon>`), `Lib/projectIcons.tsx` (`Components/Icons/ProjectIcons.tsx`) |
| `crossings.json` | The border crossings and ports: name, category, neighbouring country, coordinates, working windows and contact number. The page and the share preview must read the same rows, so it lives here rather than under the page folder. | `Domain/crossings/crossings.ts`, `Support/Seo/Preview/Resolvers/CrossingPreview` (through `Facts::json('crossings')`) |
| `governorate-icons.json` | The fourteen governorate outlines the server can draw, keyed by the `transit_svg` basename in `governorates.json`: `viewBox` plus the first path's `d`. Derived from the SVG files under `resources/js/Pages/Transit/_data/governorates/`, which stay the authoring source because the browser loads them directly. | `Facts::governorateIcon()` / `Facts::governorateIcons()` (transit API, mobile); `tests/Feature/GovernorateIconFactsTest.php` asserts it matches the SVGs |
| `resources/js/Domain/transit/cities.json` | The city **seed** list: the columns a `cities` row is created with (`id`, names, status, centre, bounds, zoom). It sits with the transit module rather than here because the browser reads it synchronously, and it is not a copy of the table — it must never gain a derived column such as `routeCount`, whose live answer is the API's. | `Components/GlobalSearch.tsx` (static city-name index) and `Pages/Errors/NotFound.tsx`; `tests/Feature/TransitCitySeedTest.php` asserts every row against `GET /api/v1/cities`. The staging seeder must keep using these real ids, because `cities.id` is public |

## Field notes

`governorates.json` is an array in **select-list order** (the order the home,
Roznama and settings surfaces show). Three more orders are carried as fields
because consumers rely on their current one: `option_order` (the promise
forms), `picker_order` (the Muslim prayer picker and the board widgets) and
`sort_order` (the population atlas).
`aliases` are accepted spellings, matched after normalisation
(`Facts::normalizeName()` / `normalizeGovernorateName()`); `dataset_name_en` is
the English spelling the population atlas's external datasets key on, which is
not always the display name.

A value that two consumers disagreed about is kept as two fields rather than
one picked winner — do not collapse them without checking both consumers.

`themes.json` and `capabilities.json` live here under the same rule; they are
documented by the changes that introduced them.

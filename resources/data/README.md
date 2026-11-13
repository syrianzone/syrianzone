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
| `promises.json` | The promise tracker's vocabularies: the editorial statuses, the display metadata per state (label, card glyph, card tone, badge variant, text tone), and the `{key, label}` lists of where a statement was made, the kinds of source, the review verdicts and the origins. | `Promise`/`PromiseSource` (keys through `Facts::promiseVenues()` etc.; their model constants are pinned to this file by `tests/Feature/PromiseVocabularyTest.php`), `PromisePreview`; `Domain/promises/status.ts` (`types.ts` holds the compile-time key lists that are checked against it) |
| `promises-admin-sections.json` | The promises admin's four sections: the page each nav entry links to and the capability that page's route requires. | `Pages/Admin/Promises/_lib/sections.ts` (`AdminNav`); `tests/Feature/PromisesAdminSectionsTest.php` asserts every page and sector route is tagged with its section's capability |
| `polls.json` | The core ("best ministers") poll slug, the default timezone new polls get, and `min_selections` — the fewest ranked candidates a ballot may name. | `Poll`, `PollPreview`, `SitemapBuilder`, `PollController`, `VotingService` (via `Facts::polls()`), `config/services.php`; `Domain/polls/core.ts` (`MIN_SELECTIONS`) |
| `prayer.json` | The AlAdhan calculation methods: `default_method`, the twelve `methods` the pickers offer in display order (id, Arabic/English name, degree detail), and `unlisted_method_ids` — ids the timings endpoint also accepts so an account that stored one is not silently reset. `Facts::prayerMethodIds()` is the accepted set both validators use. | `App\Support\Facts::prayer()` / `prayerMethodIds()`, `PrayerController`, `UserSettingsController`; `Domain/prayer/methods.ts` |
| `transit.json` | Transit constants: the `color_index` ceiling and the nearby-stops radius (metres). | `Services/Transit/TransitRules` (the admin, studio and import controllers validate through it), `Api\V1\TransitController`; `Domain/transit/limits.ts` |
| `games.json` | The game hub registry: slug, title, link overrides and flags. Icons stay in `Domain/games/games.ts` because a React component cannot live in JSON. Browser-only: the sitemap lists `/games/*` from `seo.json`, so no PHP reader exists. | `Domain/games/games.ts` |
| `social-platforms.json` | The social-link vocabulary of official entities (key, Arabic/English label, form label, input name, placeholder), in display order. `official_entities.socials` is a map keyed by these keys. | `Domain/syofficial/social.ts`; `Facts::socialPlatforms()` (`create/update-syofficial-entity` schemas, `syofficial:repair-socials`) |
| `seo.json` | The public page table: one record per path (title, description, share card, og:type, JSON-LD type, breadcrumb parent, sitemap `priority`/`changefreq` with `"sitemap": false` as the opt-out) and the `non_pages` route list. | `App\Support\Seo\Pages` (also the sitemap through `sitemapPages()`), `SeoMeta`, `Og\StaticCards`; `scripts/og` |
| `site.json` | The canonical site host used for sitemaps, share links and post footers. | `SitemapWriter`, `TierlistPostText`, `config/seo.php` |
| `media.json` | The public base URL of the media store (Cloudflare R2) that stored file names are served from. A deployment overrides it with `R2_PUBLIC_URL` / `R2_URL`. | `Facts::media()` (`SyOfficialPresenter`, `geojson:upload-to-r2`); `Domain/govapps/media.ts` |
| `site-popup.json` | The homepage "unblock Syria" popup defaults (copy, link, version). The stored DB row overrides them. | `SiteSetting::defaults()`, `Domain/settings/popup.ts` |
| `site-modules.json` | The site-module catalogue: every navigation entry (id, title, subtitle, href, target, icon key, sub-entries), its search copy, the layout flags (`fullBleedPrefixes`, `navbarSticky`), and the dashboard's admin cards with their capability gate. The stored `site_navigation` row is an override of the navigation half. | `SiteSetting::defaultNavigationItems()`, `SiteNavigationAdminController`; `Lib/siteModules.ts` (through `Lib/siteLinks.ts`, `Lib/routes.ts`, `Navbar`, `GlobalSearch`, `Dashboard`) |
| `project-icons.json` | One drawing per icon key (`viewBox` + SVG body, or an `alias` of another key). Paint is the Tailwind class string the icon was drawn with; the Blade component resolves it to attributes because the Filament panel does not scan the app stylesheet. | `Facts::projectIcons()` (`<x-project-icon>`), `Lib/projectIcons.tsx` (`Components/Icons/ProjectIcons.tsx`) |
| `crossings.json` | The border crossings and ports: name, category, neighbouring country, coordinates, working windows and contact number. The page and the share preview must read the same rows, so it lives here rather than under the page folder. | `Domain/crossings/crossings.ts`, `Support/Seo/Preview/Resolvers/CrossingPreview` (through `Facts::json('crossings')`) |
| `weather.json` | The weather vocabulary: the WMO code table (`code`, the English wording `SyriaClimateService` stores, the Arabic `label` for a conditions line and the `short` label for a forecast chip) and the OpenWeather wordings `/api/weather` sends, which have no code. | `Facts::weatherCodes()` (`SyriaClimateService`), `Domain/weather/weather.ts` (`weatherDescriptionAr`, `weatherCodeAr`), `scripts/syria_environmental_data_aggregator.py` |
| `governorate-icons.json` | The fourteen governorate outlines the server can draw, keyed by the `transit_svg` basename in `governorates.json`: `viewBox` plus the first path's `d`. Derived from the SVG files under `resources/js/Pages/Transit/_data/governorates/`, which stay the authoring source because the browser loads them directly. | `Facts::governorateIcon()` / `Facts::governorateIcons()` (transit API, mobile); `tests/Feature/SharedFactsTest.php` asserts it matches the SVGs |
| `search-fold.json` | The Arabic search fold as a case table: input → the one spelling it folds to (hamza alefs, ta marbuta, alef maqsura, waw/yaa hamza, diacritics, tatweel, runs of spaces, Latin transliteration and its apostrophes/dashes). The fold itself is `App\Support\ArabicSearch::fold()` on the server and `Lib/arabic.ts normalizeArabic()` in the browser; both language tests assert this file, so the two sides match the same rows. | `tests/Unit/ArabicSearchTest.php`, `resources/js/Lib/arabic.test.ts` |

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

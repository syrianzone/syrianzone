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
| `polls.json` | The core ("best ministers") poll slug and the default timezone new polls get. | `Poll`, `PollPreview`, `SitemapBuilder`, `PollController`, `config/services.php`; `Domain/polls/core.ts` |
| `transit.json` | Transit constants: the `color_index` ceiling and the nearby-stops radius (metres). | `TransitAdminController`, `TransitImportController`, `TransitStudioController`, `Api\V1\TransitController`; `Domain/transit/limits.ts` |
| `games.json` | The game hub registry: slug, title, link overrides and flags. Icons stay in `Domain/games/games.ts` because a React component cannot live in JSON. | `Domain/games/games.ts`; `SitemapBuilder` |
| `social-platforms.json` | The social-link vocabulary of official entities (key, Arabic/English label), in display order. | `Domain/syofficial/social.ts` |
| `seo.json` | The public page table: one record per path (title, description, share card, og:type, JSON-LD type, breadcrumb parent) and the `non_pages` route list. | `App\Support\Seo\Pages`, `SeoMeta`, `Og\StaticCards`; `scripts/og` |
| `site.json` | The canonical site host used for sitemaps, share links and post footers. | `SitemapWriter`, `TierlistPostText`, `config/seo.php` |
| `site-popup.json` | The homepage "unblock Syria" popup defaults (copy, link, version). The stored DB row overrides them. | `SiteSetting::defaults()`, `Components/UnblockSyriaNotification` |
| `site-modules.json` | The site-module catalogue: every navigation entry (id, title, subtitle, href, target, icon key, sub-entries), its search copy, the layout flags (`fullBleedPrefixes`, `navbarSticky`), and the dashboard's admin cards with their capability gate. The stored `site_navigation` row is an override of the navigation half. | `SiteSetting::defaultNavigationItems()`, `SiteNavigationAdminController`; `Lib/siteModules.ts` (through `Lib/siteLinks.ts`, `Lib/routes.ts`, `Navbar`, `GlobalSearch`, `Dashboard`) |
| `project-icons.json` | One drawing per icon key (`viewBox` + SVG body, or an `alias` of another key). Paint is the Tailwind class string the icon was drawn with; the Blade component resolves it to attributes because the Filament panel does not scan the app stylesheet. | `Facts::projectIcons()` (`<x-project-icon>`), `Lib/projectIcons.tsx` (`Components/Icons/ProjectIcons.tsx`) |

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

# SEO and share previews

How page metadata, link-preview cards, structured data and `sitemap.xml` work
across Syrian Zone, and what to touch when adding or changing a page.

## The rules

1. **The server prints the tags.** `resources/views/app.blade.php` prints the
   title, description, canonical, robots, Open Graph, Twitter and JSON-LD tags on
   every response. They never depend on the React tree or on the SSR process.
2. **One place decides them.** `App\Support\Seo\SeoMeta` resolves the metadata
   once per request. Fixed pages are listed in `SeoMeta::PAGES`; each kind of
   database-backed page has one `PreviewResolver` class.
3. **Every shareable URL has its own card.** Fixed pages have a committed card;
   records get one drawn on demand. Both come from the same renderer and
   templates.
4. **A card request always answers with an image.** A missing record or a
   failed drawing falls back to the section's card with a short cache.
5. **Card URLs are versioned** with `?v=`, so a changed card is fetched again.
6. **Tests enforce the above.** A public page without an entry or a card, a
   committed card older than its sources, and card copy that does not fit all
   fail the suite.

## Request flow

```text
Request ─► SeoMeta::resolve()
             1. Previews::resolve()   a PreviewResolver claims the request
                                      (/promises/7, /mishwar?place=12, ...)
             2. SeoMeta::PAGES        a fixed page (/promises, /about, ...)
             3. site defaults         anything else
           ─► app.blade.php           prints the tags on every response
           ─► `seo` Inertia prop  ─►  <SeoHead> keeps them current during
                                      client-side navigation only

og:image ─► /og/<slug>.png?v=<hash>                 fixed page, committed file
         └► /og/r/<type>/<key>.<png|jpg>?v=<hash>   record, OgCardController
```

`<SeoHead>` (mounted once in `Layouts/MainLayout.tsx`) renders nothing during
SSR. In the browser it takes over the server-printed tags, which carry the
`inertia` attribute, and updates them as the visitor navigates. Pages must not
render their own `<Head>` for title or meta tags.

## Key files

| File | Responsibility |
| --- | --- |
| [`app/Support/Seo/SeoMeta.php`](../../app/Support/Seo/SeoMeta.php) | Resolves metadata per request; `PAGES` holds every fixed page's title and description, `SCHEMA` its JSON-LD type |
| [`app/Support/Seo/Preview/`](../../app/Support/Seo/Preview) | `PreviewResolver` classes, one per kind of record page, registered in `Previews::RESOLVERS` |
| [`app/Support/Seo/Og/`](../../app/Support/Seo/Og) | Card plumbing: `StaticCards` (committed cards), `RecordCard`, `NodeCardRenderer`, `CardImages`, `CardCache` |
| [`app/Http/Controllers/OgCardController.php`](../../app/Http/Controllers/OgCardController.php) | Serves `/og/r/{type}/{key}.{png\|jpg}` |
| [`resources/og/cards.json`](../../resources/og/cards.json) | The card of every fixed page: slug, paths, title, sentence, icon |
| [`scripts/og/`](../../scripts/og) | The renderer: templates (`lib/cards.mjs`), text fitting (`lib/text.mjs`), `build.mjs`, `preview.mjs` |
| [`public/og/`](../../public/og) | Committed fixed-page cards and `manifest.json` |
| [`config/seo.php`](../../config/seo.php) | Canonical host, default title and description, `twitter_site`, card renderer settings |
| [`resources/views/app.blade.php`](../../resources/views/app.blade.php) | Prints the tags |
| [`resources/js/Components/SeoHead.tsx`](../../resources/js/Components/SeoHead.tsx) | Updates the tags during client-side navigation |
| [`app/Services/Sitemap/`](../../app/Services/Sitemap) | `SitemapBuilder` and `SitemapWriter` for `/sitemap.xml` |
| [`public/robots.txt`](../../public/robots.txt) | Disallowed areas and the sitemap address |

## Titles

A page has one name, used two ways:

- **Document title** (`<title>`, search results): the name plus ` | Syrian Zone`
  for fixed pages, or plus the section for records (`… | عداد الوعود`).
- **Preview title** (`og:title`, `twitter:title`): the name alone. The site name
  already travels in `og:site_name`, and chat apps show both.

In `SeoMeta::PAGES` write the bare name; the suffix is added for you. In a
resolver, set `title` (document) and `shareTitle` (preview).

## Adding a fixed page

1. Add the path to `SeoMeta::PAGES` with an Arabic `title` and a `description`
   of roughly 110 to 160 characters. Add a `SCHEMA` entry if it is more specific
   than `WebPage`, and a `PARENT_BREADCRUMBS` entry if it sits under a hub.
2. Add its card to `resources/og/cards.json`: a `slug`, the `paths` that use it,
   a short `title`, one `subtitle` sentence written for the card (not the meta
   description), and an `icon` key from `SITE_ICON_MAP`.
3. Run `npm run og:build` and commit `public/og/<slug>.png` and `manifest.json`.
4. Add `[path, priority, changefreq]` to `SitemapBuilder::STATIC_PAGES`.
5. Give the page a single `<h1>` (use `sr-only` when the design has none).

`tests/Feature/Seo/RouteCoverageTest.php` fails until steps 1 to 3 are done.

## Adding a kind of record page

Write one class in `app/Support/Seo/Preview/Resolvers` and add it to
`Previews::RESOLVERS`:

```php
final class RecipePreview implements CardSource, PreviewResolver
{
    public static function cardType(): string { return 'recipe'; }      // /og/r/recipe/{key}.png
    public static function fallbackCard(): string { return 'recipes'; } // a slug from cards.json

    public function resolve(Request $request, string $path): ?Preview
    {
        // Return null unless this is your page and the record is public.
    }

    public function card(string $key): ?RecordCard
    {
        // The same lookup, by key. Null for unknown or non-public records.
    }
}
```

- Build the `Preview` and the `RecordCard` from the same record, so the text
  and the image cannot disagree.
- Apply the page's own visibility rule in both methods. The card endpoint is
  public; an unpublished record must return `null` there too.
- A record opened through a query string (`/mishwar?place=12`) sets
  `sharePath` to the path with that parameter and `canonicalPath` to the
  section. `og:url` then keeps the parameter, so each record previews as
  itself, while `rel=canonical` and the JSON-LD stay on the section and search
  engines do not index thin duplicates.
- Implement only `PreviewResolver` when a fixed card is enough (see
  `GuessWhoRoomPreview`).

## The cards

All cards are 1200×630 and drawn by `scripts/og` with
[resvg](https://github.com/linebender/resvg) (WebAssembly), so there is no
browser involved and the same code runs at build time and in production.

| Family | `kind` | Used for |
| --- | --- | --- |
| Brand | `brand` | The home page and the fallback of last resort |
| Split | `split` | Fixed pages (module icon), records (pills, person, figure, route line), invitations (`cta`) |
| Photo | `photo` | A place: its photograph with the name over a scrim, served as JPEG |

Design inputs come from the site and are checked by tests:

- **Colours**: `resources/og/tokens.json`, exported from `app.css` by
  `npm run og:tokens`. Cards are drawn in the dark colourway; `theme: "light"`
  is supported by every template.
- **Icons**: `resources/og/icons.json`, exported from `SITE_ICON_MAP` and lucide
  by `npm run og:icons`.
- **Type**: IBM Plex Sans Arabic, the site font.

Text rules, all in `lib/text.mjs`:

- Text is measured from the shaped glyphs, never estimated from its length.
- A title wraps into balanced lines, shrinks to a floor, and ends in an
  ellipsis only when it still does not fit.
- resvg ignores the SVG `direction` attribute, so every line is wrapped in
  Unicode isolate characters to set its direction. Without them mixed Arabic and
  Latin text comes out in the wrong order.
- Untrusted text is cleaned first: characters the font cannot draw (emoji) and
  direction controls are dropped.

Keep a card's background flat. A textured or radial background makes the PNG
several times larger. Fixed-page cards are 36 to 50 KB and record cards stay
near 100 KB, which matters because previews are fetched over slow connections.

### Commands

```bash
npm run og:build     # redraw public/og/*.png and manifest.json
npm run og:check     # fail if they are stale or any copy is cut (also run by the test suite)
npm run og:preview   # contact sheet of every card in storage/app/og-preview
npm run og:tokens    # after changing theme tokens in app.css
npm run og:icons     # after changing a module icon
php artisan og:doctor   # prove the renderer works in this environment
```

### Record cards at runtime

`OgCardController` asks the resolver for the record's `RecordCard`, then:

1. Serves the file from `storage/app/og/` if this version was already drawn.
2. Otherwise draws it under a lock: `CardImages` fetches and shrinks any photo,
   `NodeCardRenderer` runs `node scripts/og/render.mjs`, and `CardCache` stores
   the result and deletes older versions of the same card.
3. Falls back to the section card when the record is unknown or drawing fails.

| Response | `Cache-Control` |
| --- | --- |
| Current version (`?v=` matches) | `public, max-age=31536000, immutable` |
| Older or missing `?v=`, unknown record | `public, max-age=300` |
| Drawing failed | `public, max-age=30` |

The version is a hash of everything the card shows plus the template recipe, so
editing a record or changing the design produces a new URL. The route is outside
the `web` middleware group: a session cookie on the response would stop
Cloudflare caching it.

`CardImages` only fetches photos over HTTPS from the site's own media hosts
(plus `OG_IMAGE_HOSTS`), without following redirects, with a byte limit and a
pixel limit, and re-encodes them before drawing. A photo that fails any check is
left out and the card is drawn without it.

Node must be on the `PATH` of the PHP process (`OG_NODE_BINARY` overrides the
binary). The production image already has it for the Inertia SSR server, and
`docker/10-startup.sh` runs `og:doctor` so a broken renderer shows in the deploy
log.

## Non-indexed routes

Routes under `SeoMeta::NOINDEX_PREFIXES` (`admin`, `superadmin`,
`transit/admin`, `dashboard`, `auth`, `user`, `dev`, `mcp/admin`,
`guesswho/room`, `compass/s`), inactive polls, and 404 responses emit
`<meta name="robots" content="noindex, follow">`. They are also disallowed in
`public/robots.txt` and left out of the sitemap. A non-indexed page can still
have a card: a game room link is meant to be shared.

## Structured data (JSON-LD)

`SeoMeta::jsonLd()` emits one `@graph` per page:

1. `Organization` (`https://syrian.zone/#organization`)
2. `WebSite` (`https://syrian.zone/#website`, `inLanguage: ar`)
3. The page node: `WebPage`, or the type from `SeoMeta::SCHEMA` or the resolver
   (`Article` nodes also get `headline` and `publisher`)
4. `BreadcrumbList`: `الرئيسية → Page`, or `الرئيسية → Hub → Page`

Blade treats `@context` as a directive, so the JSON is built in PHP and printed
raw. Titles can come from visitors, so `<`, `>` and `&` are escaped in it.

## Route inventory

Every fixed page has its own card at `/og/<slug>.png`; the slug is in
`resources/og/cards.json`.

| Path | Preview source | Card | Sitemap |
| --- | --- | --- | --- |
| Fixed pages in `SeoMeta::PAGES` (41) | `PAGES` | committed, one each | `SitemapBuilder::STATIC_PAGES` |
| `/promises/{number}` | `PromisePreview` | `/og/r/promise/{number}.png` | published promises |
| `/polls/{slug}`, `/polls/{slug}/leaderboard` | `PollPreview` | `/og/r/poll/{slug}.png` (the tier list poll uses its page cards) | active polls |
| `/transit/city/{id}` | `TransitCityPreview` | `/og/r/city/{id}.png` | published cities |
| `/transit/city/{id}?route={routeId}` | `TransitRoutePreview` | `/og/r/route/{routeId}.png` | no (canonical is the city) |
| `/mishwar?place={id}` | `PlacePreview` | `/og/r/place/{id}.jpg` | no (canonical is `/mishwar`) |
| `/crossings?c={n}` | `CrossingPreview` | `/og/r/crossing/{n}.png` | no (canonical is `/crossings`) |
| `/priorities?state=…` | `PrioritiesSharePreview` | `priorities-share` | no |
| `/guesswho/room/{code}` | `GuessWhoRoomPreview` | `guesswho-invite` | no (noindex) |
| `/compass/s/{shareId}` | `CompassSharePreview` | `compass-share` | no (noindex) |
| Anything else | site defaults | `home` | no |

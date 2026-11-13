# SEO and share previews

How page metadata, link-preview cards, structured data and `sitemap.xml` work
across Syrian Zone, and what to touch when adding or changing a page.

## The rules

1. **The server prints the tags.** `resources/views/app.blade.php` prints the
   title, description, canonical, robots, Open Graph, Twitter and JSON-LD tags on
   every response. They never depend on the React tree or on the SSR process.
2. **One place decides them.** `App\Support\Seo\SeoMeta` resolves the metadata
   once per request. Every fixed page is one record in
   [`resources/data/seo.json`](../../resources/data/seo.json) (path, title,
   description, share card, og:type, JSON-LD type, breadcrumb parent); each kind
   of database-backed page has one `PreviewResolver` class and registers itself
   in `Previews::RESOLVERS`.
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
             2. Pages table           a fixed page (/promises, /about, ...)
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
| [`resources/data/seo.json`](../../resources/data/seo.json) | The single table of public pages: one record per path (title, description, card, og:type, JSON-LD type, breadcrumb parent), plus the `non_pages` route list |
| [`app/Support/Seo/Pages.php`](../../app/Support/Seo/Pages.php) | The PHP reader of that table; `SeoMeta` and `StaticCards` derive from it |
| [`app/Support/Seo/SeoMeta.php`](../../app/Support/Seo/SeoMeta.php) | Resolves metadata per request from the page table, a resolver, or the site defaults |
| [`app/Support/Seo/Preview/`](../../app/Support/Seo/Preview) | `PreviewResolver` classes, one per kind of record page, registered in `Previews::RESOLVERS` |
| [`app/Support/Seo/Og/`](../../app/Support/Seo/Og) | Card plumbing: `StaticCards` (committed cards), `RecordCard`, `NodeCardRenderer`, `CardImages`, `CardCache` |
| [`app/Http/Controllers/OgCardController.php`](../../app/Http/Controllers/OgCardController.php) | Serves `/og/r/{type}/{key}.{png\|jpg}` |
| [`resources/og/cards.json`](../../resources/og/cards.json) | What each fixed-page card is drawn from: slug, title, sentence, icon. The page a card belongs to is in the page table |
| [`scripts/og/`](../../scripts/og) | The renderer: templates (`lib/cards.mjs`), text fitting (`lib/text.mjs`), `build.mjs`, `preview.mjs` |
| [`public/og/`](../../public/og) | Committed fixed-page cards and `manifest.json` |
| [`config/seo.php`](../../config/seo.php) | Canonical host, default title and description, `twitter_site`, card renderer settings |
| [`resources/views/app.blade.php`](../../resources/views/app.blade.php) | Prints the tags |
| [`resources/js/Components/SeoHead.tsx`](../../resources/js/Components/SeoHead.tsx) | Updates the tags during client-side navigation |
| [`app/Services/Sitemap/`](../../app/Services/Sitemap) | `SitemapBuilder` and `SitemapWriter` for `/sitemap.xml` |
| [`scripts/seo-head.php`](../../scripts/seo-head.php) | Prints the resolved head of every public page route as JSON, for diffing a change to the page table |
| [`app/Support/Seo/LlmsTxt.php`](../../app/Support/Seo/LlmsTxt.php) | The sections and pages of `/llms.txt` |
| [`public/robots.txt`](../../public/robots.txt) | Disallowed areas and the sitemap address |

## Titles

A page has one name, used two ways:

- **Document title** (`<title>`, search results): the name plus ` | Syrian Zone`
  for fixed pages, or plus the section for records (`… | عداد الوعود`).
- **Preview title** (`og:title`, `twitter:title`): the name alone. The site name
  already travels in `og:site_name`, and chat apps show both.

In the page table's `title` write the bare name; the suffix is added for you. In
a resolver, set `title` (document) and `shareTitle` (preview).

## Adding a fixed page

1. Add one record to `resources/data/seo.json`: the `path`, an Arabic `title`,
   a `description` of roughly 110 to 160 characters, the `card` slug, and — when
   they differ from the defaults — `type` (`article`), `schema` (a JSON-LD type
   more specific than `WebPage`), `parent` (the hub's path), `parentLabel`
   (only when the hub's own title is too long to repeat in a breadcrumb) and
   the sitemap's `priority` (default `0.5`) and `changefreq` (default
   `monthly`). A record opts out of the sitemap with `"sitemap": false`.
2. Reuse an existing card from `resources/og/cards.json`, or add one there: a
   `slug`, a short `title`, one `subtitle` sentence written for the card (not the
   meta description), and an `icon` key from `SITE_ICON_MAP`. The page table is
   what says which page uses it, so `cards.json` no longer lists paths.
3. Run `npm run og:build` and commit `public/og/<slug>.png` and `manifest.json`.
4. Give the page a single `<h1>` (use `sr-only` when the design has none),
   present in every state the server can render, including loading and error.
6. If the page is one a reader should be pointed to, add it to a section of
   `LlmsTxt::SECTIONS`.

`tests/Feature/Seo/RouteCoverageTest.php` fails until steps 1 to 3 are done, and
`tests/Feature/Seo/PagesTableTest.php` asserts that the page table, the cards and
the resolvers still agree.

## What the first HTML must contain

Search engines may run JavaScript; AI crawlers and link-preview scrapers do
not. Whatever the server sends is all they read.

- Pass the data a page is about as Inertia props, so SSR renders it. A page
  that fetches its main content in the browser sends an empty or "loading"
  state, or worse a false one: the transit city page used to say "0 routes".
  When the client also refetches, seed the query from the prop (see
  `useRoutes` and `App\Services\Transit\PublishedRoutes`).
- Links a crawler should follow must be `<a href>` elements present in that
  HTML. A menu that mounts its links when opened hides them; keep the panel in
  the document and toggle its visibility instead, as the navbar does.

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
   the result.
3. Falls back to the section card when the record is unknown or drawing fails.

A card whose photo could not be loaded is still drawn, without it, but is kept
as a `.partial` file: it is served with a short cache and drawn again after ten
minutes, so the photo appears once the media host is back. Files of older
versions are deleted ten minutes after they are replaced, not at once, because
a request may already be about to open one.

| Response | `Cache-Control` |
| --- | --- |
| Current version (`?v=` matches), fully drawn | `public, max-age=31536000, immutable` |
| Older or missing `?v=`, unknown record, or drawn without its photo | `public, max-age=300` |
| Drawing failed | `public, max-age=30` |

The version is a hash of everything the card shows plus the template recipe, so
editing a record or changing the design produces a new URL. The route is outside
the `web` middleware group: a session cookie on the response would stop
Cloudflare caching it.

`CardImages` only fetches photos over HTTPS from the site's own media hosts
(plus `OG_IMAGE_HOSTS`), without following redirects, with a byte limit and a
pixel limit, and re-encodes them before drawing. A site-relative path is read
from disk instead: `/storage/...` from the public disk, anything else from
`public/`. A photo that fails any check is left out and the card is drawn
without it.

Node must be on the `PATH` of the PHP process (`OG_NODE_BINARY` overrides the
binary). The production image already has it for the Inertia SSR server, and
`docker/10-startup.sh` runs `og:doctor` so a broken renderer shows in the deploy
log.

## Non-indexed routes

Routes under `SeoMeta::NOINDEX_PREFIXES` (`admin`, `superadmin`,
`transit/admin`, `dashboard`, `auth`, `user`, `dev`, `mcp/admin`,
`guesswho/room`, `compass/s`), inactive polls, and 404 responses emit
`<meta name="robots" content="noindex, follow">`. `public/robots.txt` disallows
`admin`, `superadmin`, `transit/admin`, `dashboard`, `auth`, `user`, `dev`,
`mcp` and `guesswho/room`, and none of these routes is in the sitemap. A
non-indexed page can still have a card: a game room link is meant to be shared.

## Structured data (JSON-LD)

`SeoMeta::jsonLd()` emits one `@graph` per page:

1. `Organization` (`https://syrian.zone/#organization`), with the Arabic name
   as `alternateName` and the project's profiles as `sameAs` (both in
   `config/seo.php`)
2. `WebSite` (`https://syrian.zone/#website`, `inLanguage: ar`)
3. The page node: `WebPage`, or the type the page table (or the resolver) declares.
   `Article` nodes also get `headline`, `image` (the share card), `author` and
   `publisher`. A resolver that sets `published` and `modified` on its
   `Preview` adds `datePublished` and `dateModified`; set them only from the
   record's own timestamps, never from a deploy or request time.
4. `BreadcrumbList`: `الرئيسية → Page`, or `الرئيسية → Hub → Page`

`headline` and the last breadcrumb use the page's own name (`shareTitle`),
without the document-title suffix.

Blade treats `@context` as a directive, so the JSON is built in PHP and printed
raw. Titles can come from visitors, so `<`, `>` and `&` are escaped in it.

## llms.txt

`/llms.txt` is a short Markdown index of the site in the format proposed at
[llmstxt.org](https://llmstxt.org): a title, a one-line summary, and sections
of links with a note each. `LlmsTxt::SECTIONS` lists the pages; their names and
notes come from the page table. Search engines do not read the file. It is
there for coding agents and assistants that are handed the site's address.

`/llms.txt` and `/sitemap.xml` are registered outside the `web` middleware
group, like the card route, so they carry no cookie and the CDN can cache them.

## Route inventory

Every fixed page has its own card at `/og/<slug>.png`; the slug is in
`resources/og/cards.json`.

| Path | Preview source | Card | Sitemap |
| --- | --- | --- | --- |
| Fixed pages in `resources/data/seo.json` (41) | the page table | committed, one each | `Pages::sitemapPages()` — every record, unless it sets `"sitemap": false` |
| `/promises/{number}` | `PromisePreview` | `/og/r/promise/{number}.png` | published promises |
| `/polls/{slug}`, `/polls/{slug}/leaderboard` | `PollPreview` | `/og/r/poll/{slug}.png` (the tier list poll uses its page cards) | active polls |
| `/transit/city/{id}` | `TransitCityPreview` | `/og/r/city/{id}.png` | published cities |
| `/transit/city/{id}?route={routeId}` | `TransitRoutePreview` (accepts routes of any city on the same map, see `City::mapGroup()`) | `/og/r/route/{routeId}.png` | no (canonical is the city) |
| `/mishwar?place={id}` | `PlacePreview` | `/og/r/place/{id}.jpg` | no (canonical is `/mishwar`) |
| `/crossings?c={n}` | `CrossingPreview` | `/og/r/crossing/{n}.png` | no (canonical is `/crossings`) |
| `/priorities?state=…` | `PrioritiesSharePreview` | `priorities-share` | no |
| `/guesswho/room/{code}` | `GuessWhoRoomPreview` | `guesswho-invite` | no (noindex) |
| `/compass/s/{shareId}` | `CompassSharePreview` | `compass-share` | no (noindex) |
| Anything else | site defaults | `home` | no |

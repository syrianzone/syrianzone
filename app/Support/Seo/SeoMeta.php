<?php

namespace App\Support\Seo;

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\Previews;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Resolves the SEO and share-preview metadata of a request: one result that
 * the root Blade view prints into <head> and <SeoHead> keeps current during
 * client-side navigation.
 *
 * Fixed pages are one record each in resources/data/seo.json (see Pages).
 * Database-backed pages (a promise, a poll, a place...) each have a
 * PreviewResolver under Preview/Resolvers. Any other URL gets the site
 * defaults. See docs/guidelines/seo.md.
 */
class SeoMeta
{
    /** Request attribute the resolved metadata is memoised under. */
    private const ATTRIBUTE = 'seo_meta';

    /** Appended to a fixed page's title for the browser tab and search results. */
    private const TITLE_SUFFIX = ' | Syrian Zone';

    /** Path prefixes that must not be indexed even though they are reachable. */
    private const NOINDEX_PREFIXES = [
        'admin',
        'superadmin',
        'transit/admin',
        'dashboard',
        'auth',
        'user',
        'dev',
        'mcp/admin',
        'guesswho/room',
        'compass/s',
    ];

    /**
     * Every fixed page's path, in the order resources/data/seo.json lists them.
     *
     * @return list<string>
     */
    public static function pagePaths(): array
    {
        return Pages::paths();
    }

    /**
     * @return array{title:string,og_title:string,description:string,type:string,image:string,image_type:string,url:string,canonical:string,robots:string,json_ld:string,twitter_site:?string}
     */
    public static function resolve(Request $request): array
    {
        // Resolved once per request: the view composer and the Inertia shared
        // prop both ask for it on a full page load.
        if ($request->attributes->has(self::ATTRIBUTE)) {
            return $request->attributes->get(self::ATTRIBUTE);
        }

        $path = '/'.trim($request->path(), '/');
        // Resolvers go first: a record opened through a query string
        // (/mishwar?place=12) lives on the path of a fixed page.
        $preview = Previews::resolve($request, $path) ?? self::fixedPage($path) ?? self::fallback($path);
        // Structured data describes the canonical page. For such a record that
        // is the page it is a view of, not the record.
        $about = $preview->sharePath === null ? $preview : (self::fixedPage($preview->canonicalPath) ?? $preview);

        $base = rtrim((string) config('seo.base_url'), '/');
        $absolute = fn (string $relative) => $relative === '/' ? $base.'/' : $base.$relative;
        $canonical = $absolute($preview->canonicalPath);
        $twitterSite = config('seo.twitter_site');

        $meta = [
            'title' => $preview->title,
            // The title a link preview shows: the page or record's own name.
            'og_title' => $preview->shareTitle ?? $preview->title,
            'description' => $preview->description,
            'type' => $preview->type,
            'image' => self::absolute($preview->image, $base),
            'image_type' => str_contains($preview->image, '.jpg') ? 'image/jpeg' : 'image/png',
            // What a share points at. Usually the canonical page; for a record
            // opened through a query string it keeps that parameter, so each
            // record previews as itself instead of collapsing into its section.
            'url' => $absolute($preview->sharePath ?? $preview->canonicalPath),
            'canonical' => $canonical,
            'robots' => ($preview->noindex || self::isNoindex($path)) ? 'noindex, follow' : 'index, follow',
            'twitter_site' => is_string($twitterSite) && $twitterSite !== '' ? $twitterSite : null,
            'json_ld' => self::jsonLd($path, $about, $canonical, $base),
        ];

        $request->attributes->set(self::ATTRIBUTE, $meta);

        return $meta;
    }

    /**
     * Hand the page's record to the preview resolvers so they do not fetch it
     * again.
     *
     * The head tags and the shared `seo` prop are resolved while the response
     * renders, after the controller has run. A controller that already loaded
     * the poll, city or promise the URL names passes it here, and its resolver
     * builds the preview from that instance instead of a second query.
     */
    public static function remember(Request $request, string $kind, ?Model $record): void
    {
        if ($record !== null) {
            $request->attributes->set('seo_record_'.$kind, $record);
        }
    }

    public static function remembered(Request $request, string $kind): ?Model
    {
        $record = $request->attributes->get('seo_record_'.$kind);

        return $record instanceof Model ? $record : null;
    }

    /** A page from the table in resources/data/seo.json, with its share card. */
    public static function fixedPage(string $path): ?Preview
    {
        $page = Pages::get($path);
        if ($page === null) {
            return null;
        }

        return new Preview(
            title: $page['title'].(($page['suffix'] ?? true) ? self::TITLE_SUFFIX : ''),
            shareTitle: $page['title'],
            description: $page['description'],
            canonicalPath: $path,
            image: StaticCards::url((string) $page['card']),
            type: Pages::type($path),
            schema: Pages::schema($path),
            parent: Pages::parent($path),
        );
    }

    /** Any other URL: the site's own title, description and card. */
    private static function fallback(string $path): Preview
    {
        return new Preview(
            title: (string) config('seo.default_title'),
            description: (string) config('seo.default_description'),
            canonicalPath: $path,
            image: StaticCards::url(StaticCards::DEFAULT),
        );
    }

    /**
     * Replaces parts of the metadata already resolved for this request, for a
     * response that is not the page its URL names (a 404 above all). The
     * structured data is rebuilt so it never describes the missing page.
     *
     * @param  array{title?:string,og_title?:string,description?:string,robots?:string}  $changes
     */
    public static function override(Request $request, array $changes): void
    {
        if (isset($changes['title'])) {
            $changes['og_title'] ??= str($changes['title'])->beforeLast(self::TITLE_SUFFIX)->toString();
        }
        $meta = array_merge(self::resolve($request), $changes);
        $base = rtrim((string) config('seo.base_url'), '/');
        $meta['json_ld'] = self::jsonLd(
            '/'.trim($request->path(), '/'),
            new Preview(
                title: $meta['title'],
                description: $meta['description'],
                canonicalPath: '/'.trim($request->path(), '/'),
                image: $meta['image'],
                shareTitle: $meta['og_title'],
            ),
            $meta['canonical'],
            $base,
        );

        $request->attributes->set(self::ATTRIBUTE, $meta);
    }

    private static function isNoindex(string $path): bool
    {
        $trimmed = ltrim($path, '/');
        foreach (self::NOINDEX_PREFIXES as $prefix) {
            if ($trimmed === $prefix || str_starts_with($trimmed, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }

    private static function absolute(string $image, string $base): string
    {
        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://')) {
            return $image;
        }

        return $base.'/'.ltrim($image, '/');
    }

    /**
     * Organization + WebSite + a typed page node + (for non-root) a
     * BreadcrumbList.
     *
     * A headline and a breadcrumb carry the page or record's own name, without
     * the document-title suffix: "… | Syrian Zone" there repeats what the
     * WebSite node already says.
     *
     * Returns a ready-to-embed JSON string (the "@context" key must not pass
     * through Blade, which would treat it as a directive).
     */
    private static function jsonLd(string $path, Preview $about, string $canonical, string $base): string
    {
        $organizationId = $base.'/#organization';
        $websiteId = $base.'/#website';
        $breadcrumbId = $canonical.'#breadcrumb';
        $name = $about->shareTitle ?? $about->title;
        $alternateName = config('seo.alternate_name');

        $graph = [
            array_filter([
                '@type' => 'Organization',
                '@id' => $organizationId,
                'name' => config('seo.site_name'),
                'alternateName' => $alternateName,
                'url' => $base.'/',
                'logo' => $base.'/assets/icon-512.png',
                'sameAs' => array_values((array) config('seo.same_as', [])),
            ]),
            array_filter([
                '@type' => 'WebSite',
                '@id' => $websiteId,
                'name' => config('seo.site_name'),
                'alternateName' => $alternateName,
                'url' => $base.'/',
                'inLanguage' => 'ar',
                'publisher' => ['@id' => $organizationId],
            ]),
        ];

        $page = [
            '@type' => $about->schema,
            '@id' => $canonical.'#webpage',
            'url' => $canonical,
            'name' => $about->title,
            'description' => $about->description,
            'inLanguage' => 'ar',
            'isPartOf' => ['@id' => $websiteId],
        ];

        if ($about->schema === 'Article') {
            $page['headline'] = $name;
            $page['image'] = self::absolute($about->image, $base);
            // The site's editors write and maintain these pages; no single
            // person is credited on them.
            $page['author'] = ['@id' => $organizationId];
            $page['publisher'] = ['@id' => $organizationId];
        }

        if ($about->published !== null) {
            $page['datePublished'] = $about->published->format(DATE_ATOM);
        }
        if ($about->modified !== null) {
            $page['dateModified'] = $about->modified->format(DATE_ATOM);
        }

        if ($path !== '/') {
            $page['breadcrumb'] = ['@id' => $breadcrumbId];
            $graph[] = $page;

            $items = [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'الرئيسية', 'item' => $base.'/'],
            ];

            if ($about->parent !== null) {
                [$parentPath, $parentLabel] = $about->parent;
                $items[] = ['@type' => 'ListItem', 'position' => 2, 'name' => $parentLabel, 'item' => $base.$parentPath];
            }

            $items[] = ['@type' => 'ListItem', 'position' => count($items) + 1, 'name' => $name, 'item' => $canonical];

            $graph[] = [
                '@type' => 'BreadcrumbList',
                '@id' => $breadcrumbId,
                'itemListElement' => $items,
            ];
        } else {
            $graph[] = $page;
        }

        // The string is printed raw inside <script> (app.blade.php and
        // SeoHead), and titles can come from visitor submissions, so `<`, `>`
        // and `&` are escaped: a "</script>" in a title must stay data.
        return (string) json_encode(
            ['@context' => 'https://schema.org', '@graph' => $graph],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP,
        );
    }
}

<?php

namespace App\Support\Seo;

use RuntimeException;

/**
 * The one table of public pages: `resources/data/seo.json`.
 *
 * A page is one record there — its path, title, description, share card, og:type,
 * JSON-LD type and breadcrumb parent. `SeoMeta`, `Og\StaticCards` and the share
 * card renderer in `scripts/og` all read the same file, so a page cannot be
 * added to one and forgotten in another. See docs/guidelines/seo.md.
 *
 * A missing or malformed file is a deploy error, not a runtime condition: it
 * would empty every <head> on the site, so it throws instead.
 */
final class Pages
{
    /** @var array<string, mixed>|null */
    private static ?array $data = null;

    /** @var array<string, array<string, mixed>>|null path => record */
    private static ?array $pages = null;

    /**
     * One page's record, or null when the path is not a fixed page.
     *
     * @return array{path:string,title:string,description:string,card:string,type?:string,schema?:string,suffix?:bool,parent?:string,parentLabel?:string}|null
     */
    public static function get(string $path): ?array
    {
        return self::pages()[$path] ?? null;
    }

    /**
     * Every fixed page path, in declaration order.
     *
     * @return list<string>
     */
    public static function paths(): array
    {
        return array_keys(self::pages());
    }

    /** The share-card slug of a fixed page. */
    public static function card(string $path): ?string
    {
        $card = self::get($path)['card'] ?? null;

        return is_string($card) ? $card : null;
    }

    /**
     * The fixed-page cards, as path => slug. This is what the card renderer and
     * `StaticCards::forPath()` read; `resources/og/cards.json` no longer repeats
     * the path list.
     *
     * @return array<string, string>
     */
    public static function cardPaths(): array
    {
        $paths = [];
        foreach (self::pages() as $path => $page) {
            $paths[$path] = (string) $page['card'];
        }

        return $paths;
    }

    /** The JSON-LD type of the page node; a plain WebPage unless the record says otherwise. */
    public static function schema(string $path): string
    {
        return self::get($path)['schema'] ?? 'WebPage';
    }

    /** The og:type of the page; `website` unless the record says otherwise. */
    public static function type(string $path): string
    {
        return self::get($path)['type'] ?? 'website';
    }

    /**
     * The breadcrumb parent of a nested page as [path, label]. The label is the
     * parent page's own name, unless the record overrides it with `parentLabel`
     * (for a parent whose full title is too long to repeat in a breadcrumb).
     *
     * @return array{0:string,1:string}|null
     */
    public static function parent(string $path): ?array
    {
        $page = self::get($path);
        $parent = $page['parent'] ?? null;
        if (! is_string($parent)) {
            return null;
        }

        $label = $page['parentLabel'] ?? self::get($parent)['title'] ?? null;

        return $label === null ? null : [$parent, (string) $label];
    }

    /**
     * The GET routes that answer without being a page (endpoints, shims,
     * infrastructure), as route URIs without the leading slash.
     *
     * @return list<string>
     */
    public static function nonPages(): array
    {
        /** @var list<string> $nonPages */
        $nonPages = self::data()['non_pages'] ?? [];

        return $nonPages;
    }

    /** @return array<string, array<string, mixed>> */
    private static function pages(): array
    {
        if (self::$pages === null) {
            self::$pages = [];
            /** @var array<int, array<string, mixed>> $rows */
            $rows = self::data()['pages'] ?? [];
            foreach ($rows as $row) {
                self::$pages[(string) $row['path']] = $row;
            }
        }

        return self::$pages;
    }

    /** @return array<string, mixed> */
    private static function data(): array
    {
        if (self::$data !== null) {
            return self::$data;
        }

        $file = resource_path('data/seo.json');
        $json = @file_get_contents($file);
        if ($json === false) {
            throw new RuntimeException("Missing SEO page table: {$file}");
        }

        $decoded = json_decode($json, true);
        if (! is_array($decoded) || ! is_array($decoded['pages'] ?? null)) {
            throw new RuntimeException("Malformed SEO page table: {$file}");
        }

        return self::$data = $decoded;
    }
}

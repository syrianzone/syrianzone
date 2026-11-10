<?php

namespace App\Support\Seo\Og;

/**
 * The pre-rendered share cards of the fixed pages.
 *
 * `resources/og/cards.json` lists them (which paths use which card) and
 * `public/og/manifest.json`, written by `npm run og:build`, carries a content
 * hash per card. The hash goes into the URL as `?v=`: the files are served with
 * a year-long immutable cache, so a redrawn card needs a new address to be seen.
 */
final class StaticCards
{
    /** The site's own card: the home page, and the fallback of last resort. */
    public const DEFAULT = 'home';

    /** @var array<string, string>|null path => slug */
    private static ?array $paths = null;

    /** @var array<string, string>|null slug => content hash */
    private static ?array $versions = null;

    /** Site-relative URL of the card a fixed page uses, or null when the path has none. */
    public static function forPath(string $path): ?string
    {
        $slug = self::paths()[$path] ?? null;

        return $slug === null ? null : self::url($slug);
    }

    /** Site-relative, versioned URL of a card by its slug. */
    public static function url(string $slug): string
    {
        $version = self::versions()[$slug] ?? null;

        return '/og/'.$slug.'.png'.($version === null ? '' : '?v='.$version);
    }

    /** Absolute path of a card file on disk. */
    public static function file(string $slug): string
    {
        return public_path('og/'.$slug.'.png');
    }

    /** @return array<string, string> path => slug */
    public static function paths(): array
    {
        if (self::$paths === null) {
            self::$paths = [];
            foreach (self::read(resource_path('og/cards.json'))['cards'] ?? [] as $card) {
                foreach ($card['paths'] ?? [] as $path) {
                    self::$paths[$path] = $card['slug'];
                }
            }
        }

        return self::$paths;
    }

    /** @return array<string, string> slug => content hash */
    public static function versions(): array
    {
        return self::$versions ??= self::read(public_path('og/manifest.json'))['cards'] ?? [];
    }

    /** @return array<string, mixed> */
    private static function read(string $file): array
    {
        $decoded = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        return is_array($decoded) ? $decoded : [];
    }
}

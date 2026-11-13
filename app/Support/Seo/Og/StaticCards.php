<?php

namespace App\Support\Seo\Og;

use App\Support\Seo\Pages;

/**
 * The pre-rendered share cards of the fixed pages.
 *
 * Which page uses which card is one record per page in
 * `resources/data/seo.json` (see Pages). `resources/og/cards.json` holds only
 * what a card is drawn from — slug, wording, icon — and
 * `public/og/manifest.json`, written by `npm run og:build`, carries a content
 * hash per card. The hash goes into the URL as `?v=`: the files are served with
 * a year-long immutable cache, so a redrawn card needs a new address to be seen.
 */
final class StaticCards
{
    /** The site's own card: the home page, and the fallback of last resort. */
    public const DEFAULT = 'home';

    /**
     * The share card's canvas, in pixels. The Node renderer draws exactly this
     * size (`scripts/og/lib/engine.mjs`), a card photo covers this box
     * (`CardImages::SLOTS`), and the `og:image:width`/`height` tags the Blade
     * head and `<SeoHead>` print are these two numbers, sent as
     * `seo.image_width`/`seo.image_height`.
     */
    public const CARD_WIDTH = 1200;

    public const CARD_HEIGHT = 630;

    /** @var array<string, mixed>|null the decoded public/og/manifest.json */
    private static ?array $manifest = null;

    /** Site-relative URL of the card a fixed page uses, or null when the path has none. */
    public static function forPath(string $path): ?string
    {
        $slug = Pages::card($path);

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

    /**
     * The fixed-page cards, as path => slug. The path list lives in the page
     * table; cards.json no longer repeats it.
     *
     * @return array<string, string>
     */
    public static function paths(): array
    {
        return Pages::cardPaths();
    }

    /** @return array<string, string> slug => content hash */
    public static function versions(): array
    {
        return self::manifest()['cards'] ?? [];
    }

    /**
     * Hash of everything a card is drawn from (templates, tokens, icons,
     * fonts, artwork). Part of every on-demand card's version, so a design
     * change redraws those too.
     */
    public static function recipe(): string
    {
        return (string) (self::manifest()['recipe'] ?? '');
    }

    /** @return array<string, mixed> */
    private static function manifest(): array
    {
        return self::$manifest ??= self::read(public_path('og/manifest.json'));
    }

    /** @return array<string, mixed> */
    private static function read(string $file): array
    {
        $decoded = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        return is_array($decoded) ? $decoded : [];
    }
}

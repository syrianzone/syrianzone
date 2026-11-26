<?php

namespace App\Services\Places;

/**
 * The public address of a Mishwar place: /mishwar/{id}-{slug}.
 *
 * The id is what the page is looked up by, so a renamed place keeps working
 * and the old slug 301s to the new one. The slug is the place's Arabic name,
 * kept readable: tashkeel and tatweel are dropped, anything that is not a
 * letter or a digit becomes one hyphen.
 *
 * path() returns the percent-encoded form (what goes into hrefs, canonical
 * tags, sitemaps and IndexNow); browsers show it decoded.
 */
final class PlaceUrls
{
    /** Longest slug kept, in characters; the id alone is enough to resolve. */
    private const MAX_SLUG_CHARS = 60;

    public static function slug(string $name): string
    {
        // tashkeel (U+064B–U+065F, U+0670) and tatweel (U+0640)
        $slug = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $name) ?? $name;
        $slug = preg_replace('/[^\p{L}\p{N}]+/u', '-', $slug) ?? $slug;
        $slug = mb_strtolower(trim($slug, '-'));

        if (mb_strlen($slug) > self::MAX_SLUG_CHARS) {
            $slug = rtrim(mb_substr($slug, 0, self::MAX_SLUG_CHARS), '-');
        }

        return $slug;
    }

    /** Percent-encoded path, e.g. /mishwar/216-%D9%85%D8%AD%D8%B7%D8%A9-... */
    public static function path(int $id, string $name): string
    {
        $slug = self::slug($name);

        return '/mishwar/'.$id.($slug === '' ? '' : '-'.rawurlencode($slug));
    }

    /**
     * The id and decoded slug of a /mishwar/{segment} segment, or null when
     * the segment does not start with a place id.
     *
     * @return array{0: int, 1: string}|null
     */
    public static function parse(string $segment): ?array
    {
        $segment = rawurldecode($segment);
        if (! preg_match('/^([1-9][0-9]{0,9})(?:-(.*))?$/u', $segment, $m)) {
            return null;
        }

        return [(int) $m[1], $m[2] ?? ''];
    }
}

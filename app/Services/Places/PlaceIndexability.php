<?php

namespace App\Services\Places;

use App\Models\Place;

/**
 * Decides whether an approved Mishwar place has enough content to be indexed
 * by search engines (and listed in sitemaps / submitted via IndexNow).
 *
 * Thin rule: fewer than 15 words in the description AND at most 1 photo.
 * Thin pages still render normally for visitors and direct links, but carry
 * `robots: noindex, follow` and stay out of the sitemaps.
 */
final class PlaceIndexability
{
    public const MIN_DESCRIPTION_WORDS = 15;

    public const MAX_THIN_PHOTOS = 1;

    public static function wordCount(?string $description): int
    {
        $trimmed = trim((string) $description);
        if ($trimmed === '') {
            return 0;
        }

        $words = preg_split('/\s+/u', $trimmed, -1, PREG_SPLIT_NO_EMPTY);

        return is_array($words) ? count($words) : 0;
    }

    public static function photoCount(Place $place): int
    {
        if ($place->relationLoaded('photos')) {
            return $place->photos->count();
        }

        if (isset($place->photos_count)) {
            return (int) $place->photos_count;
        }

        return $place->photos()->count();
    }

    public static function isThinContent(?string $description, int $photoCount): bool
    {
        return self::wordCount($description) < self::MIN_DESCRIPTION_WORDS
            && $photoCount <= self::MAX_THIN_PHOTOS;
    }

    public static function isThin(Place $place, ?int $photoCount = null): bool
    {
        $photos = $photoCount ?? self::photoCount($place);

        return self::isThinContent($place->description, $photos);
    }

    public static function isIndexable(Place $place, ?int $photoCount = null): bool
    {
        return $place->status === 'approved' && ! self::isThin($place, $photoCount);
    }
}

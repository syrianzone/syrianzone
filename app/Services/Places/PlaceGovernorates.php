<?php

namespace App\Services\Places;

use App\Models\Place;
use App\Services\Governorates\GovernorateGeometry;
use Illuminate\Support\Facades\Cache;

/**
 * Which governorate each approved Mishwar place falls in, by point-in-polygon
 * on the shipped OCHA admin-1 boundaries. Every approved place is classified
 * in one pass and cached, since place pages, hubs and governorate pages all
 * ask for it.
 */
final class PlaceGovernorates
{
    public const CACHE_KEY = 'places:governorate-by-place:v1';

    public function __construct(private readonly GovernorateGeometry $geometry) {}

    /** @return array<int, string> place id => governorate id (Facts::governorates() key) */
    public function map(): array
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinutes(30), function (): array {
            $map = [];
            $places = Place::query()
                ->where('status', 'approved')
                ->whereNotNull('lat')
                ->whereNotNull('lng')
                ->get(['id', 'lat', 'lng']);

            foreach ($places as $place) {
                $id = $this->geometry->governorateIdForPoint((float) $place->lat, (float) $place->lng);
                if ($id !== null) {
                    $map[(int) $place->id] = $id;
                }
            }

            return $map;
        });
    }

    public function forPlace(Place $place): ?string
    {
        if ($place->status === 'approved' && isset($this->map()[$place->id])) {
            return $this->map()[$place->id];
        }

        // not cached yet (just approved) or not approved: classify directly
        return $place->lat !== null && $place->lng !== null
            ? $this->geometry->governorateIdForPoint((float) $place->lat, (float) $place->lng)
            : null;
    }

    /** Drop the cached map; call after an approval, move or deletion. */
    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}

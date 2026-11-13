<?php

namespace App\Services\Transit;

use App\Models\City;
use Illuminate\Support\Facades\Cache;

/**
 * The transit cache keys, and the invalidation that keeps them together.
 *
 * Every key is composed here so a writer and a forgetter cannot disagree: the
 * route and map keys are derived from `City::mapGroup()`, which is the only
 * definition of "these cities share one map". Adding a city to that group, or
 * reordering it, changes the composed key and the invalidation with it.
 */
class TransitCache
{
    /** The `/transit` page's city list. */
    public const CITIES = 'transit:cities';

    /** The same rows plus governorate icons (the public API's own copy). */
    public const CITIES_API = 'transit:cities:api';

    /**
     * The published route list of a map group.
     *
     * @param  array<int, string>  $cityIds
     */
    public function routesKey(array $cityIds): string
    {
        return 'transit:routes:'.implode('+', $cityIds);
    }

    /** One city's map payload, as requested by its own page or the API. */
    public function mapDataKey(string $cityId): string
    {
        return "transit:map-data:{$cityId}";
    }

    /**
     * Forget everything derived from one governorate's transit data.
     *
     * A city is always drawn with the rest of its map group, so the group is
     * what gets forgotten: a change in either Damascus or Rif Dimashq has to
     * reach the combined map's keys, and a third shared city would be covered
     * without editing this method.
     */
    public function forgetCity(string $cityId): void
    {
        foreach (City::mapGroup($cityId) as $groupMember) {
            Cache::forget($this->mapDataKey($groupMember));
            Cache::forget($this->routesKey(City::mapGroup($groupMember)));
        }

        Cache::forget(self::CITIES);
        // Public API variant: same rows plus governorate icons, so a route
        // count change must not leave it stale for an hour.
        Cache::forget(self::CITIES_API);
    }

    /**
     * For both sides of a move, in that order, so neither governorate is left
     * holding a stale map.
     */
    public function forgetCities(string ...$cityIds): void
    {
        foreach (array_unique($cityIds) as $cityId) {
            $this->forgetCity($cityId);
        }
    }
}

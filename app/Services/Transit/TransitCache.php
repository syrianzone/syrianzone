<?php

namespace App\Services\Transit;

use Illuminate\Support\Facades\Cache;

/**
 * Invalidation for the per-governorate transit map caches.
 *
 * Extracted because the same block was copy-pasted into three places
 * (TransitAdminController, TransitStudioController) and had to stay in lockstep:
 * forgetting one key and not its sibling serves a map that is internally
 * inconsistent, which is much harder to diagnose than a missing cache.
 */
class TransitCache
{
    /**
     * Forget everything derived from one governorate's transit data.
     *
     * Damascus and Rif Dimashq are rendered as a single combined map, so a
     * change in either invalidates the shared keys as well as the per-city ones.
     */
    public function forgetCity(string $cityId): void
    {
        Cache::forget("transit:map-data:{$cityId}");
        Cache::forget("transit:routes:{$cityId}");

        if ($cityId === 'damascus' || $cityId === 'rif-dimashq') {
            Cache::forget('transit:map-data:damascus');
            Cache::forget('transit:map-data:rif-dimashq');
            Cache::forget('transit:routes:damascus');
            Cache::forget('transit:routes:rif-dimashq');
            Cache::forget('transit:routes:damascus+rif-dimashq');
        }

        Cache::forget('transit:cities');
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

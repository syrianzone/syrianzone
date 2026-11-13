<?php

namespace App\Services\Transit;

use App\Models\City;
use App\Models\Route;
use Illuminate\Support\Facades\Cache;

/**
 * The published routes of a city's map, as the public API and the city page
 * list them. One place, so the page's first HTML and the JSON a browser
 * fetches afterwards cannot disagree. The key is `TransitCache::routesKey()`,
 * so `TransitCache::forgetCity()` reaches it.
 */
class PublishedRoutes
{
    public function __construct(private readonly TransitCache $cache) {}

    /**
     * Routes of every city drawn on the same map as `$cityId` (Damascus and
     * Rif Dimashq share one). The caller is responsible for the city existing.
     *
     * @return list<array{id:string,cityId:string,nameAr:string,nameEn:?string,colorIndex:?int,priceOld:mixed,priceNew:mixed,stopsCount:int}>
     */
    public function forCity(string $cityId): array
    {
        $cityIds = City::mapGroup($cityId);

        return Cache::remember($this->cache->routesKey($cityIds), 600, function () use ($cityIds) {
            // NOTE: select() must come before withStopsCount() — a later select()
            // replaces the column list and would drop the count subselect,
            // leaving stops_count null in the public payload.
            return Route::whereIn('city_id', $cityIds)
                ->where('status', 'published')
                ->select('id', 'city_id', 'name_ar', 'name_en', 'color_index', 'price_old', 'price_new')
                ->withStopsCount()
                ->get()
                ->map(fn (Route $r) => [
                    'id' => $r->id,
                    'cityId' => $r->city_id,
                    'nameAr' => $r->name_ar,
                    'nameEn' => $r->name_en,
                    'colorIndex' => $r->color_index,
                    'priceOld' => $r->price_old,
                    'priceNew' => $r->price_new,
                    'stopsCount' => $r->stops_count,
                ])
                ->all();
        });
    }
}

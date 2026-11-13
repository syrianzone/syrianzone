<?php

namespace App\Services\Transit;

use App\Models\City;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The public city list: one query and one cache owner.
 *
 * `/transit` and `GET /api/v1/cities` used to build the same rows twice, in two
 * copies of the same query that disagreed on null handling. The API's version
 * adds the governorate icon; everything else is this file.
 */
class TransitCities
{
    /** The rows are cheap but the page is hot; both copies live for an hour. */
    private const TTL = 3600;

    public function __construct(
        private readonly TransitPresenter $presenter,
        private readonly GovernorateIconService $icons,
    ) {}

    /**
     * The page's copy: names, bounds and counts, no icons (the browser draws
     * them from its own SVG bundle).
     *
     * @return array<int, array<string, mixed>>
     */
    public function forPage(): array
    {
        return Cache::remember(TransitCache::CITIES, self::TTL, fn () => $this->rows());
    }

    /**
     * The API's copy: the same rows, each with the governorate outline an
     * external client cannot draw by itself.
     *
     * @return array<int, array<string, mixed>>
     */
    public function forApi(): array
    {
        return Cache::remember(TransitCache::CITIES_API, self::TTL, fn () => $this->rows(withIcons: true));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function rows(bool $withIcons = false): array
    {
        $cities = City::select(
            'id', 'name_ar', 'name_en', 'zoom', 'status',
            DB::raw('ST_AsGeoJSON(center) as center_geojson'),
            DB::raw('ST_AsGeoJSON(bounds) as bounds_geojson')
        )->withCount(['routes as routeCount' => fn ($q) => $q->where('status', 'published')])->get();

        return $cities
            ->map(fn (City $city) => $this->presenter->city(
                $city,
                $withIcons ? $this->icons->forCity((string) $city->id) : null,
            ))
            ->values()
            ->all();
    }
}

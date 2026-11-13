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
     * The card fields only: names, status and the live published-route count,
     * without the map geometry.
     *
     * The 404 page draws the same city cards as the landing page, so it needs
     * the same live counts — but it is rendered by the exception handler, on a
     * path that may not be a transit one, and the two payloads above are
     * MySQL-only (`ST_AsGeoJSON`). This query is plain SQL and is deliberately
     * not cached: a 404 is not a hot page, and its counts come from the table.
     *
     * @return array<int, array{id: string, nameAr: string, nameEn: string, status: string, routeCount: int}>
     */
    public function forCards(): array
    {
        return City::query()
            ->select('id', 'name_ar', 'name_en', 'status')
            ->withCount(['routes as routeCount' => fn ($q) => $q->where('status', 'published')])
            ->orderBy('id')
            ->get()
            ->map(fn (City $city) => [
                'id' => (string) $city->id,
                'nameAr' => (string) $city->name_ar,
                'nameEn' => (string) $city->name_en,
                'status' => (string) $city->status,
                'routeCount' => (int) ($city->routeCount ?? 0),
            ])
            ->values()
            ->all();
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

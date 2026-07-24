<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class TransitRouteDetailService
{
    /** @return array<string, mixed>|null */
    public function find(string $cityId, string $routeId): ?array
    {
        $city = $this->city($cityId);
        if ($city === null) {
            return null;
        }

        $route = DB::table('routes')
            ->where('id', $routeId)
            ->where('city_id', $cityId)
            ->where('status', 'published')
            ->first();

        if ($route === null) {
            return null;
        }

        $geometry = DB::connection()->getDriverName() === 'sqlite'
          ? 'stops.geometry as geojson'
          : DB::raw('ST_AsGeoJSON(stops.geometry) as geojson');

        $stops = DB::table('route_stop')
            ->join('stops', 'route_stop.stop_id', '=', 'stops.id')
            ->where('route_stop.route_id', $routeId)
            ->orderBy('route_stop.order')
            ->select('stops.id', 'stops.name_ar', 'stops.name_en', $geometry)
            ->get()
            ->map(fn (object $stop): array => [
                'properties' => [
                    'id' => $stop->id,
                    'nameAr' => $stop->name_ar,
                    'nameEn' => $stop->name_en,
                ],
                'coordinates' => $this->coordinates($stop->geojson),
            ])
            ->all();

        return [
            'id' => $cityId,
            'city' => $city,
            'route' => [
                'id' => $route->id,
                'nameAr' => $route->name_ar,
                'nameEn' => $route->name_en,
                'colorIndex' => (int) $route->color_index,
                'priceOld' => $route->price_old === null ? null : (int) $route->price_old,
                'priceNew' => $route->price_new === null ? null : (int) $route->price_new,
            ],
            'stops' => $stops,
        ];
    }

    /** @return array<string, mixed>|null */
    private function city(string $cityId): ?array
    {
        $cities = Cache::remember('mobile:transit:cities-config', 3600, function (): array {
            $path = resource_path('js/Pages/Transit/_data/cities.json');
            if (! is_file($path)) {
                return [];
            }

            $decoded = json_decode((string) file_get_contents($path), true);

            return is_array($decoded) ? $decoded : [];
        });

        foreach ($cities as $city) {
            if (is_array($city) && ($city['id'] ?? null) === $cityId) {
                return $city;
            }
        }

        return null;
    }

    /** @return array{0: int|float, 1: int|float} */
    private function coordinates(mixed $geojson): array
    {
        $geometry = is_string($geojson) ? json_decode($geojson, true) : null;
        $coordinates = is_array($geometry) ? ($geometry['coordinates'] ?? null) : null;
        if (! is_array($coordinates) || count($coordinates) < 2) {
            return [0, 0];
        }

        return [(float) $coordinates[0], (float) $coordinates[1]];
    }
}

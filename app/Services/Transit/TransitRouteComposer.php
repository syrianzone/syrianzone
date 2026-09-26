<?php

namespace App\Services\Transit;

use App\Exceptions\Transit\TransitActionException;
use App\Models\Route;
use App\Models\TransitRouteLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Structural route surgery: combining two routes, and splitting one in two.
 *
 * NOT exposed through the agent MCP surface. This is the only part of transit
 * administration that is neither spatial-free nor already covered by tests, and
 * it is the part that rewrites several live routes per call. Both operations
 * need MySQL's ST_AsGeoJSON()/ST_GeomFromGeoJSON(), which the SQLite test
 * database does not provide, so a regression here would not be caught in CI.
 * Keep it behind the human dashboard until it has real coverage.
 *
 * The logic is unchanged from TransitAdminController apart from two fixes noted
 * on split(), both of which are called out inline.
 */
class TransitRouteComposer
{
    public function __construct(private readonly TransitCache $cache) {}

    /**
     * Merge two routes of the same governorate into a new one, disapproving
     * both originals.
     *
     * @param  array{name_ar: string, name_en?: string|null, price?: int|null}  $input
     *
     * @throws TransitActionException when the two routes are in different cities
     */
    public function combine(Route $routeA, Route $routeB, array $input, ?int $actorId): CombineResult
    {
        if ($routeA->city_id !== $routeB->city_id) {
            throw TransitActionException::crossCity('Routes must belong to the same city');
        }

        $cityId = $routeA->city_id;
        $cityName = $this->cityName($cityId, 'name_en') ?? 'transit';

        return DB::transaction(function () use ($routeA, $routeB, $input, $cityId, $cityName, $actorId) {
            $newRouteId = 'route-'.Str::slug($cityName).'-'.Str::uuid();

            $newRoute = Route::create([
                'id' => $newRouteId,
                'city_id' => $cityId,
                'name_ar' => $input['name_ar'],
                'name_en' => $input['name_en'] ?? null,
                'price_old' => null,
                'price_new' => $input['price'] ?? max($routeA->price_new ?? 0, $routeB->price_new ?? 0),
                'status' => 'published',
            ]);

            $coords = array_merge(
                $this->lineCoordinates($routeA->id),
                $this->lineCoordinates($routeB->id),
            );

            if ($coords !== []) {
                $this->insertLine($newRouteId, $coords);
            }

            $this->copyStops($routeA, $newRouteId);
            $this->copyStops($routeB, $newRouteId);

            $routeA->status = 'disapproved';
            $routeA->save();
            $routeB->status = 'disapproved';
            $routeB->save();

            TransitRouteLog::create([
                'route_id' => $newRoute->id,
                'action' => 'combined',
                'description' => "دمج الخطين '{$routeA->name_ar}' و '{$routeB->name_ar}' في خط جديد باسم '{$newRoute->name_ar}'",
                'user_id' => $actorId,
            ]);

            $this->cache->forgetCity($cityId);

            return new CombineResult($newRoute, [$routeA->id, $routeB->id]);
        });
    }

    /**
     * Split a route at one of its interior stops into two new routes,
     * disapproving the original.
     *
     * @param  array{name_a_ar: string, name_a_en?: string|null, name_b_ar: string, name_b_en?: string|null}  $names
     *
     * @throws TransitActionException when the split stop is not an interior stop
     */
    public function split(Route $route, string $splitStopId, array $names, ?int $actorId): SplitResult
    {
        $cityId = $route->city_id;
        $cityName = $this->cityName($cityId, 'name_en') ?? 'transit';

        $stops = $route->stops()->orderBy('pivot_order')->get();

        $splitIndex = -1;
        foreach ($stops as $index => $stop) {
            if ($stop->id === $splitStopId) {
                $splitIndex = $index;
                break;
            }
        }

        // Checked before the transaction opens. The original opened a
        // transaction, then returned this 400 from inside the try block without
        // committing or rolling back, which leaked the open transaction onto
        // the connection for the rest of the request.
        if ($splitIndex === -1 || $splitIndex === 0 || $splitIndex === $stops->count() - 1) {
            throw TransitActionException::invalidSplitStop();
        }

        $coords = $this->lineCoordinates($route->id);
        $splitStopCoords = $this->pointCoordinates($splitStopId) ?? [0, 0];

        $closestIndex = 0;
        $minDistance = PHP_FLOAT_MAX;
        foreach ($coords as $index => $coord) {
            $distance = ($coord[0] - $splitStopCoords[0]) ** 2 + ($coord[1] - $splitStopCoords[1]) ** 2;

            if ($distance < $minDistance) {
                $minDistance = $distance;
                $closestIndex = $index;
            }
        }

        $coordsA = array_slice($coords, 0, $closestIndex + 1);
        $coordsB = array_slice($coords, $closestIndex);

        return DB::transaction(function () use ($route, $stops, $splitIndex, $coordsA, $coordsB, $names, $cityId, $cityName, $actorId) {
            $routeA = Route::create([
                'id' => 'route-'.Str::slug($cityName).'-'.Str::uuid(),
                'city_id' => $cityId,
                'name_ar' => $names['name_a_ar'],
                'name_en' => $names['name_a_en'] ?? null,
                'price_old' => null,
                'price_new' => $route->price_new,
                'status' => 'published',
            ]);

            if (count($coordsA) > 1) {
                $this->insertLine($routeA->id, $coordsA);
            }

            $routeB = Route::create([
                'id' => 'route-'.Str::slug($cityName).'-'.Str::uuid(),
                'city_id' => $cityId,
                'name_ar' => $names['name_b_ar'],
                'name_en' => $names['name_b_en'] ?? null,
                'price_old' => null,
                'price_new' => $route->price_new,
                'status' => 'published',
            ]);

            if (count($coordsB) > 1) {
                $this->insertLine($routeB->id, $coordsB);
            }

            // The split stop is deliberately a member of both halves: it is the
            // point the two halves share.
            $orderA = 1;
            for ($i = 0; $i <= $splitIndex; $i++) {
                $this->attachStop($routeA->id, $stops[$i]->id, $orderA++);
            }

            $orderB = 1;
            for ($i = $splitIndex; $i < $stops->count(); $i++) {
                $this->attachStop($routeB->id, $stops[$i]->id, $orderB++);
            }

            $route->status = 'disapproved';
            $route->save();

            TransitRouteLog::create([
                'route_id' => $route->id,
                'action' => 'split',
                'description' => "تقسيم الخط '{$route->name_ar}' إلى خطين: '{$routeA->name_ar}' و '{$routeB->name_ar}' عند موقف '{$stops[$splitIndex]->name_ar}'",
                'user_id' => $actorId,
            ]);

            $this->cache->forgetCity($cityId);

            return new SplitResult($routeA, $routeB, $route->id);
        });
    }

    /**
     * Coordinates of a route's single geometry row, flattened for a LineString.
     *
     * @return array<int, array{0: float, 1: float}>
     */
    protected function lineCoordinates(string $routeId): array
    {
        $geoJson = DB::table('route_geometries')
            ->selectRaw('ST_AsGeoJSON(geometry) as geojson')
            ->where('route_id', $routeId)
            ->value('geojson');

        if (! $geoJson) {
            return [];
        }

        $geometry = json_decode($geoJson, true);
        $coordinates = $geometry['coordinates'] ?? [];

        if (($geometry['type'] ?? '') === 'MultiLineString') {
            $coordinates = array_merge(...$coordinates);
        }

        return $coordinates;
    }

    /**
     * @return array{0: float, 1: float}|null
     */
    protected function pointCoordinates(string $stopId): ?array
    {
        $geoJson = DB::table('stops')
            ->selectRaw('ST_AsGeoJSON(geometry) as geojson')
            ->where('id', $stopId)
            ->value('geojson');

        if (! $geoJson) {
            return null;
        }

        return json_decode($geoJson, true)['coordinates'] ?? null;
    }

    /**
     * @param  array<int, array{0: float, 1: float}>  $coordinates
     */
    protected function insertLine(string $routeId, array $coordinates): void
    {
        DB::statement(
            'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
            [$routeId, json_encode(['type' => 'LineString', 'coordinates' => $coordinates]), now(), now()]
        );
    }

    /**
     * Copy a route's stops onto the combined route, skipping any stop the other
     * half already contributed so a shared stop is not listed twice.
     */
    protected function copyStops(Route $source, string $targetRouteId): void
    {
        $order = 1 + (int) DB::table('route_stop')->where('route_id', $targetRouteId)->max('order');

        foreach ($source->stops()->orderBy('pivot_order')->get() as $stop) {
            $alreadyAttached = DB::table('route_stop')
                ->where('route_id', $targetRouteId)
                ->where('stop_id', $stop->id)
                ->exists();

            if ($alreadyAttached) {
                continue;
            }

            $this->attachStop($targetRouteId, $stop->id, $order++);
        }
    }

    protected function attachStop(string $routeId, string $stopId, int $order): void
    {
        DB::table('route_stop')->insert([
            'route_id' => $routeId,
            'stop_id' => $stopId,
            'order' => $order,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function cityName(string $cityId, string $column): ?string
    {
        return DB::table('cities')->where('id', $cityId)->value($column);
    }
}
